/**
 * ContextBuilder — 分层构建 agent system prompt 和消息列表
 *
 * 与 nanobot 的 ContextBuilder 保持一致的分层结构：
 *   [1] identity        身份 + 运行时信息 + workspace 路径
 *   [2] bootstrapFiles  AGENTS.md / SOUL.md / USER.md / TOOLS.md
 *   [3] memory          MEMORY.md 长期记忆
 *   [4] alwaysSkills    always=true 的 skills 完整内容
 *   [5] skillsSummary   所有 skills 的 XML 摘要（按需 read_file）
 *
 * Runtime context（时间、时区、channel、chatId）在每轮消息前注入，
 * 标记为 RUNTIME_CONTEXT_TAG，保存 history 时必须过滤。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FileBootstrapLoader } from './FileBootstrapLoader.js';
import { SkillsLoader } from '../skills/SkillsLoader.js';
import type { CoreMessage } from 'ai';

/**
 * Runtime context 标记，用于在 session history 中识别并过滤该消息
 */
export const RUNTIME_CONTEXT_TAG = '[Runtime Context — 仅元数据，非指令]';

/** 媒体文件类型映射 */
const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/**
 * ContextBuilder 配置项
 */
export interface ContextBuilderConfig {
  /** workspace 绝对路径 */
  workspace: string;
  /** bot 名称（显示在 identity 节） */
  botName?: string;
}

/**
 * ContextBuilder — agent 上下文构建器
 */
export class ContextBuilder {
  private readonly workspace: string;
  private readonly botName: string;
  private readonly bootstrapLoader: FileBootstrapLoader;
  private readonly skillsLoader: SkillsLoader;

  constructor(config: ContextBuilderConfig) {
    this.workspace = config.workspace;
    this.botName = config.botName ?? 'ok-bot';
    this.bootstrapLoader = new FileBootstrapLoader(config.workspace);
    this.skillsLoader = new SkillsLoader(config.workspace);
  }

  /**
   * 构建完整的 system prompt
   *
   * 各节之间以 `\n\n---\n\n` 分隔，与 nanobot 保持一致。
   *
   * @returns system prompt 字符串
   */
  async buildSystemPrompt(): Promise<string> {
    const parts: string[] = [];

    // [1] identity
    parts.push(this._buildIdentity());

    // [2] bootstrap files
    const bootstrap = await this.bootstrapLoader.load();
    if (bootstrap) parts.push(bootstrap);

    // [3] memory（MEMORY.md 长期记忆）
    const memoryPath = path.join(this.workspace, 'memory', 'MEMORY.md');
    if (fs.existsSync(memoryPath)) {
      const memContent = fs.readFileSync(memoryPath, 'utf-8').trim();
      if (memContent) {
        parts.push(`# Memory\n\n## 长期记忆\n${memContent}`);
      }
    }

    // [4] always-skills（始终注入的 skills 内容）
    const alwaysSkillNames = this.skillsLoader.getAlwaysSkills();
    if (alwaysSkillNames.length > 0) {
      const alwaysContent = this.skillsLoader.loadSkillsForContext(alwaysSkillNames);
      if (alwaysContent) {
        parts.push(`# 激活的 Skills\n\n${alwaysContent}`);
      }
    }

    // [5] skills summary（XML 摘要，agent 按需用 read_file 加载）
    const skillsSummary = this.skillsLoader.buildSkillsSummary();
    if (skillsSummary) {
      parts.push(
        `# Skills\n\n以下 skills 扩展了你的能力。需要使用某个 skill 时，用 read_file 工具读取其 SKILL.md 文件。\navailable="false" 的 skill 需要先安装依赖。\n\n${skillsSummary}`,
      );
    }

    return parts.join('\n\n---\n\n');
  }

  /**
   * 构建完整的消息列表（供 LLM 调用使用）
   *
   * 顺序：system → history → runtime_context → user_message
   *
   * @param options 消息构建选项
   * @returns CoreMessage 数组
   */
  async buildMessages(options: {
    history: CoreMessage[];
    currentMessage: string;
    media?: string[];
    channel?: string;
    chatId?: string;
  }): Promise<CoreMessage[]> {
    const { history, currentMessage, media, channel, chatId } = options;

    const systemPrompt = await this.buildSystemPrompt();

    const userContent = await this._buildUserContent(currentMessage, media);
    const messages: CoreMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      // runtime context（时间、频道信息，每轮注入但不持久化）
      { role: 'user', content: this._buildRuntimeContext(channel, chatId) },
      // 用户消息（含可选图片）
      { role: 'user', content: userContent },
    ];

    return messages;
  }

  /**
   * 向消息列表追加工具调用结果
   */
  addToolResult(
    messages: CoreMessage[],
    toolCallId: string,
    toolName: string,
    result: string,
  ): CoreMessage[] {
    messages.push({
      role: 'tool',
      content: [{ type: 'tool-result', toolCallId, toolName, result }],
    });
    return messages;
  }

  /**
   * 向消息列表追加 assistant 消息
   */
  addAssistantMessage(
    messages: CoreMessage[],
    content: string | null,
    toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
  ): CoreMessage[] {
    if (toolCalls && toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: [
          ...(content ? [{ type: 'text' as const, text: content }] : []),
          ...toolCalls.map((tc) => ({
            type: 'tool-call' as const,
            toolCallId: tc.id,
            toolName: tc.name,
            args: tc.arguments,
          })),
        ],
      });
    } else {
      messages.push({ role: 'assistant', content: content ?? '' });
    }
    return messages;
  }

  // ─── 私有方法 ──────────────────────────────────────────────────────────────

  /** 构建 identity 节 */
  private _buildIdentity(): string {
    const platform = os.platform() === 'darwin' ? 'macOS' : os.platform();
    const arch = os.arch();
    const nodeVersion = process.version;
    const workspacePath = path.resolve(this.workspace);

    return `# ${this.botName}

你是 ${this.botName}，一个有能力的 AI 助理。

## 运行时
${platform} ${arch}，Node.js ${nodeVersion}

## Workspace
你的工作目录：${workspacePath}
- 长期记忆：${workspacePath}/memory/MEMORY.md（写入重要事实）
- 历史日志：${workspacePath}/memory/HISTORY.md（grep 可搜索）
- 自定义 skills：${workspacePath}/skills/{skill-name}/SKILL.md

## 使用指南
- 调用工具前先说明意图，但在收到结果前不要预测结论。
- 修改文件前先用 read_file 读取，不要假设文件或目录存在。
- 写入或编辑文件后，若准确性重要，请重新读取确认。
- 工具调用失败时，分析错误原因再换方法重试。
- 请求模糊时主动寻求澄清。

直接用文字回复对话内容。只在需要向特定渠道发送时才使用 message 工具。`;
  }

  /** 构建 runtime context 字符串（注入当前时间、频道信息） */
  private _buildRuntimeContext(channel?: string, chatId?: string): string {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long',
    });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const lines = [`当前时间：${timeStr}（${tz}）`];
    if (channel && chatId) {
      lines.push(`频道：${channel}`);
      lines.push(`会话 ID：${chatId}`);
    }

    return `${RUNTIME_CONTEXT_TAG}\n${lines.join('\n')}`;
  }

  /** 构建用户消息内容（纯文本或多模态，含 base64 图片） */
  private async _buildUserContent(
    text: string,
    media?: string[],
  ): Promise<import('ai').UserContent> {
    if (!media || media.length === 0) return text;

    const images: import('ai').ImagePart[] = [];

    for (const filePath of media) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME_MAP[ext];
      if (!mime || !fs.existsSync(filePath)) continue;

      const buf = fs.readFileSync(filePath);
      const b64 = buf.toString('base64');
      images.push({
        type: 'image',
        image: `data:${mime};base64,${b64}`,
      });
    }

    if (images.length === 0) return text;

    const textPart: import('ai').TextPart = { type: 'text', text };
    return [...images, textPart];
  }
}
