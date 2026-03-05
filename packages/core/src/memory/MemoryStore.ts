/**
 * 两层记忆系统
 * - MEMORY.md：长期事实记忆（由 LLM 维护更新）
 * - HISTORY.md：追加式日志（grep-searchable，每条以 [YYYY-MM-DD HH:MM] 开头）
 * - LLM consolidation：通过 save_memory 虚拟工具，异步后台归档旧消息
 */

import fs from 'node:fs';
import path from 'node:path';
import { tool, generateText, type LanguageModelV1, type CoreMessage } from 'ai';
import { z } from 'zod';
import type { Session } from './SessionManager.js';
import type { ILLMProvider } from '../providers/types.js';
import { RUNTIME_CONTEXT_TAG } from '../context/ContextBuilder.js';

/**
 * MemoryStore — 管理 MEMORY.md 和 HISTORY.md
 */
export class MemoryStore {
  /** workspace/memory/ 目录路径 */
  private readonly memoryDir: string;
  /** 长期记忆文件路径 */
  private readonly memoryFile: string;
  /** 历史日志文件路径 */
  private readonly historyFile: string;

  constructor(workspace: string) {
    this.memoryDir = path.join(workspace, 'memory');
    this.memoryFile = path.join(this.memoryDir, 'MEMORY.md');
    this.historyFile = path.join(this.memoryDir, 'HISTORY.md');
  }

  /**
   * 读取长期记忆内容
   * @returns MEMORY.md 内容；文件不存在时返回空字符串
   */
  readLongTerm(): string {
    if (!fs.existsSync(this.memoryFile)) return '';
    return fs.readFileSync(this.memoryFile, 'utf-8');
  }

  /**
   * 写入长期记忆内容
   * @param content 新的记忆内容
   */
  writeLongTerm(content: string): void {
    this._ensureDir();
    fs.writeFileSync(this.memoryFile, content, 'utf-8');
  }

  /**
   * 向历史日志追加一条条目
   * 每条条目末尾追加空行分隔，保持 grep-searchable 格式
   *
   * @param entry 历史条目（应以 [YYYY-MM-DD HH:MM] 开头）
   */
  appendHistory(entry: string): void {
    this._ensureDir();
    fs.appendFileSync(this.historyFile, entry.trimEnd() + '\n\n', 'utf-8');
  }

  /**
   * 获取格式化的记忆上下文字符串（供 ContextBuilder 注入）
   * @returns "## 长期记忆\n{content}" 或空字符串
   */
  getMemoryContext(): string {
    const content = this.readLongTerm().trim();
    return content ? `## 长期记忆\n${content}` : '';
  }

  /**
   * LLM 驱动的记忆 consolidation
   *
   * 通过 save_memory 虚拟工具让 LLM 归档旧消息到 MEMORY.md 和 HISTORY.md。
   * 异步执行，不阻塞主 agent loop。
   *
   * @param session 要归档的 session
   * @param provider LLM provider 实例
   * @param modelString 使用的模型字符串
   * @param options consolidation 选项
   * @returns true 表示成功，false 表示 LLM 未调用工具或发生错误
   */
  async consolidate(
    session: Session,
    provider: ILLMProvider,
    modelString: string,
    options: {
      /** 是否归档全部消息（/new 命令时为 true） */
      archiveAll?: boolean;
      /** 记忆窗口大小 */
      memoryWindow?: number;
    } = {},
  ): Promise<boolean> {
    const { archiveAll = false, memoryWindow = 100 } = options;

    // 确定要归档的消息范围
    let messagesToArchive: Session['messages'];
    let keepCount = 0;

    if (archiveAll) {
      messagesToArchive = session.messages;
      keepCount = 0;
    } else {
      keepCount = Math.floor(memoryWindow / 2);
      if (session.messages.length <= keepCount) return true;
      const toProcess = session.messages.slice(session.lastConsolidated, -keepCount);
      if (toProcess.length === 0) return true;
      messagesToArchive = toProcess;
    }

    // 格式化消息为可读文本
    const lines: string[] = [];
    for (const msg of messagesToArchive) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      // 过滤 runtime context tag（不归档）
      if (typeof content === 'string' && content.startsWith(RUNTIME_CONTEXT_TAG)) continue;
      if (!content) continue;
      const timestamp = typeof msg['timestamp'] === 'string' ? msg['timestamp'].slice(0, 16) : '?';
      lines.push(`[${timestamp}] ${String(msg.role).toUpperCase()}: ${content}`);
    }

    if (lines.length === 0) return true;

    const currentMemory = this.readLongTerm();

    const prompt = `处理以下对话并调用 save_memory 工具完成记忆归档。

## 当前长期记忆
${currentMemory || '（空）'}

## 待归档对话
${lines.join('\n')}`;

    try {
      // 定义 save_memory 虚拟工具
      const saveMemoryTool = tool({
        description: '保存记忆 consolidation 结果到持久存储',
        parameters: z.object({
          history_entry: z
            .string()
            .describe('2-5 句话的对话摘要。以 [YYYY-MM-DD HH:MM] 开头，包含 grep 可搜索的详细信息'),
          memory_update: z
            .string()
            .describe('完整的更新后长期记忆（markdown 格式）。包含所有现有事实和新事实。无新内容时返回原样'),
        }),
        execute: async (args) => {
          // 工具执行：写入 MEMORY.md 和 HISTORY.md
          if (args.history_entry) {
            this.appendHistory(args.history_entry);
          }
          if (args.memory_update && args.memory_update !== currentMemory) {
            this.writeLongTerm(args.memory_update);
          }
          return 'saved';
        },
      });

      // 通过 provider 调用（使用 CoreMessage 格式）
      const messages: CoreMessage[] = [
        {
          role: 'system',
          content:
            '你是记忆归档 agent。调用 save_memory 工具完成对话归档。',
        },
        { role: 'user', content: prompt },
      ];

      const response = await provider.chat(
        messages,
        { save_memory: saveMemoryTool },
        { model: modelString },
      );

      if (!response.toolCalls || response.toolCalls.length === 0) {
        console.warn('[MemoryStore] LLM 未调用 save_memory，跳过 consolidation');
        return false;
      }

      // 更新 session.lastConsolidated 指针
      session.lastConsolidated = archiveAll ? 0 : session.messages.length - keepCount;
      return true;
    } catch (error) {
      console.error('[MemoryStore] consolidation 失败:', error);
      return false;
    }
  }

  // ─── 私有方法 ──────────────────────────────────────────────────────────────

  /** 确保 memory 目录存在 */
  private _ensureDir(): void {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
  }
}
