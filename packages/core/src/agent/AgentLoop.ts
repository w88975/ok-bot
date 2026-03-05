/**
 * AgentLoop — 核心 agent 迭代循环
 *
 * 职责：
 * 1. 接收 InboundMessage，构建上下文消息列表
 * 2. 调用 LLM（通过 ILLMProvider）
 * 3. 执行工具调用，将结果追加到消息列表
 * 4. 重复直到 LLM 返回纯文本回复或达到最大迭代次数
 * 5. 保存对话历史，触发记忆 consolidation
 */

import type { CoreMessage } from 'ai';
import type { ILLMProvider } from '../providers/types.js';
import type { MessageBus } from '../bus/MessageBus.js';
import type { InboundMessage, OutboundMessage } from '../bus/events.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { ContextBuilder, RUNTIME_CONTEXT_TAG } from '../context/ContextBuilder.js';
import { SessionManager } from '../memory/SessionManager.js';
import { MemoryStore } from '../memory/MemoryStore.js';
import { SubagentManager } from './SubagentManager.js';
import { createFileSystemTools } from '../tools/builtin/FileSystemTools.js';
import { createShellTool } from '../tools/builtin/ShellTool.js';
import { createWebSearchTool, createWebFetchTool } from '../tools/builtin/WebTools.js';
import { MessageTool } from '../tools/builtin/MessageTool.js';
import { SpawnTool } from '../tools/builtin/SpawnTool.js';
import type { AgentConfig } from '../types.js';

/** 工具结果最大字符数（超出截断存入 history） */
const TOOL_RESULT_MAX_CHARS = 500;

/**
 * 进度回调类型
 * @param content 进度内容
 * @param options 附加选项
 */
export type OnProgress = (content: string, options?: { toolHint?: boolean }) => Promise<void> | void;

/**
 * SSE 流式 token 回调类型
 * 每个文本 delta 触发一次，用于实时输出 LLM 生成的字符
 */
export type OnToken = (token: string) => void;

/**
 * AgentLoop — 单个 agent 的核心处理引擎
 */
export class AgentLoop {
  private readonly provider: ILLMProvider;
  private readonly bus: MessageBus;
  private readonly model: string;
  private readonly maxIterations: number;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly memoryWindow: number;

  private readonly contextBuilder: ContextBuilder;
  private readonly sessionManager: SessionManager;
  private readonly memoryStore: MemoryStore;
  private readonly tools: ToolRegistry;
  private readonly subagentManager: SubagentManager;
  private readonly messageTool: MessageTool;

  /** 每个 session 的活跃任务列表（用于 /stop 取消） */
  private readonly activeTasks = new Map<string, Set<Promise<void>>>();
  /** 正在 consolidation 的 session key 集合（避免并发） */
  private readonly consolidatingKeys = new Set<string>();

  constructor(config: Omit<AgentConfig, 'provider'> & { bus: MessageBus; provider: ILLMProvider }) {
    this.provider = config.provider;
    this.bus = config.bus;
    this.model = config.provider.getDefaultModel();
    this.maxIterations = config.maxIterations ?? 40;
    this.temperature = config.temperature ?? 0.1;
    this.maxTokens = config.maxTokens ?? 4096;
    this.memoryWindow = config.memoryWindow ?? 100;

    this.contextBuilder = new ContextBuilder({ workspace: config.workspace, botName: 'ok-bot' });
    this.sessionManager = new SessionManager(config.workspace);
    this.memoryStore = new MemoryStore(config.workspace);

    this.tools = new ToolRegistry();
    const allowedDir = config.restrictToWorkspace ? config.workspace : undefined;

    // 注册内置工具
    for (const t of createFileSystemTools({ workspace: config.workspace, allowedDir })) {
      this.tools.register(t);
    }
    this.tools.register(
      createShellTool({
        workingDir: config.workspace,
        timeout: config.execConfig?.timeout,
        pathAppend: config.execConfig?.pathAppend,
      }),
    );
    this.tools.register(createWebSearchTool(config.braveApiKey));
    this.tools.register(createWebFetchTool());

    this.messageTool = new MessageTool((msg) => this.bus.publishOutbound(msg));
    this.tools.register(this.messageTool.toDefinition());

    this.subagentManager = new SubagentManager({
      provider: this.provider,
      workspace: config.workspace,
      bus: this.bus,
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      braveApiKey: config.braveApiKey,
      execConfig: config.execConfig,
      restrictToWorkspace: config.restrictToWorkspace,
    });

    const spawnTool = new SpawnTool(this.subagentManager);
    this.tools.register(spawnTool.toDefinition());
  }

  /**
   * 处理一条入站消息，返回出站消息
   *
   * @param msg 入站消息
   * @param onProgress 进度回调（工具提示、中间内容，可选）
   * @param onToken SSE 流式 token 回调（可选）；提供时使用 streamText 实时输出
   * @returns 出站消息；无需额外回复时返回 null
   */
  async processMessage(
    msg: InboundMessage,
    onProgress?: OnProgress,
    onToken?: OnToken,
  ): Promise<OutboundMessage | null> {
    // system channel：子 agent 结果注回
    if (msg.channel === 'system') {
      return this._processSystemMessage(msg);
    }

    const sessionKey = `${msg.channel}:${msg.chatId}`;
    const cmd = msg.content.trim().toLowerCase();

    // 处理 slash 命令
    if (cmd === '/stop') return this._handleStop(msg, sessionKey);
    if (cmd === '/new') return this._handleNew(msg, sessionKey);
    if (cmd === '/help') return this._handleHelp(msg);

    // 正常消息处理
    const session = this.sessionManager.getOrCreate(sessionKey);

    // 触发后台记忆 consolidation（若未 consolidate 消息数达到阈值）
    const unconsolidated = session.messages.length - session.lastConsolidated;
    if (unconsolidated >= this.memoryWindow && !this.consolidatingKeys.has(sessionKey)) {
      this._triggerConsolidation(sessionKey, session);
    }

    // 注入工具上下文
    this.messageTool.setContext(msg.channel, msg.chatId, msg.metadata?.['messageId'] as string);
    this.messageTool.startTurn();

    const history = session.getHistory(this.memoryWindow) as CoreMessage[];
    const messages = await this.contextBuilder.buildMessages({
      history,
      currentMessage: msg.content,
      media: msg.media,
      channel: msg.channel,
      chatId: msg.chatId,
    });

    const progressCb: OnProgress = onProgress ?? (async (content, opts) => {
      await this.bus.publishOutbound({
        channel: msg.channel,
        chatId: msg.chatId,
        content,
        metadata: { _progress: true, _toolHint: opts?.toolHint ?? false },
      });
    });

    const { finalContent, allMessages } = await this._runLoop(messages, progressCb, onToken);

    // 保存本轮消息到 session history
    this._saveTurn(session, allMessages, 1 + history.length);
    this.sessionManager.save(session);

    // 若 message 工具已主动发送，不再重复回复
    if (this.messageTool.sentInTurn) return null;

    return {
      channel: msg.channel,
      chatId: msg.chatId,
      content: finalContent ?? '处理完成，但无回复内容。',
      metadata: msg.metadata,
    };
  }

  // ─── 核心循环 ──────────────────────────────────────────────────────────────

  /**
   * 执行 LLM → 工具调用迭代循环
   *
   * @param onToken 提供时透传给每次 provider.chat() 调用，启用 SSE 流式输出
   */
  private async _runLoop(
    initialMessages: CoreMessage[],
    onProgress: OnProgress,
    onToken?: OnToken,
  ): Promise<{ finalContent: string | null; allMessages: CoreMessage[] }> {
    let messages = initialMessages;
    let finalContent: string | null = null;

    for (let i = 0; i < this.maxIterations; i++) {
      const response = await this.provider.chat(messages, this.tools.getDefinitions(), {
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        onToken,
      });

      if (response.toolCalls.length > 0) {
        // 流式模式下中间内容已经由 onToken 输出，跳过 onProgress 避免重复打印
        if (response.content && !onToken) await onProgress(response.content);
        const hint = response.toolCalls
          .map((tc) => {
            const firstArg = Object.values(tc.arguments)[0];
            const argStr = typeof firstArg === 'string' ? firstArg.slice(0, 40) : '';
            return `${tc.name}("${argStr}")`;
          })
          .join(', ');
        await onProgress(hint, { toolHint: true });

        // 追加 assistant 消息（含工具调用）
        messages = this.contextBuilder.addAssistantMessage(messages, response.content, response.toolCalls);

        // 顺序执行所有工具调用
        for (const tc of response.toolCalls) {
          console.info(`[AgentLoop] 工具调用：${tc.name}(${JSON.stringify(tc.arguments).slice(0, 100)})`);
          const result = await this.tools.execute(tc.name, tc.arguments);
          messages = this.contextBuilder.addToolResult(messages, tc.id, tc.name, result);
        }
      } else {
        // 无工具调用，得到最终回复
        messages = this.contextBuilder.addAssistantMessage(messages, response.content);
        finalContent = response.content;
        break;
      }
    }

    if (finalContent === null) {
      console.warn(`[AgentLoop] 达到最大迭代次数（${this.maxIterations}），强制终止`);
      finalContent =
        `已达到最大工具调用次数（${this.maxIterations}）。请尝试将任务拆分为更小的步骤。`;
    }

    return { finalContent, allMessages: messages };
  }

  // ─── Slash 命令处理 ────────────────────────────────────────────────────────

  private async _handleStop(msg: InboundMessage, sessionKey: string): Promise<OutboundMessage> {
    const tasks = this.activeTasks.get(sessionKey) ?? new Set();
    const subCount = await this.subagentManager.cancelBySession(sessionKey);
    const total = tasks.size + subCount;

    return {
      channel: msg.channel,
      chatId: msg.chatId,
      content: total > 0 ? `⏹ 已停止 ${total} 个任务。` : '当前没有正在执行的任务。',
    };
  }

  private async _handleNew(msg: InboundMessage, sessionKey: string): Promise<OutboundMessage> {
    const session = this.sessionManager.getOrCreate(sessionKey);

    if (session.messages.length > 0) {
      const success = await this.memoryStore.consolidate(session, this.provider, this.model, {
        archiveAll: true,
        memoryWindow: this.memoryWindow,
      });

      if (!success) {
        return {
          channel: msg.channel,
          chatId: msg.chatId,
          content: '记忆归档失败，会话未清空。请重试。',
        };
      }
    }

    session.clear();
    this.sessionManager.save(session);
    this.sessionManager.invalidate(sessionKey);

    return { channel: msg.channel, chatId: msg.chatId, content: '新会话已开始。' };
  }

  private _handleHelp(msg: InboundMessage): OutboundMessage {
    return {
      channel: msg.channel,
      chatId: msg.chatId,
      content:
        '**ok-bot 命令：**\n' +
        '/new — 开始新会话（归档当前历史）\n' +
        '/stop — 停止当前正在执行的任务\n' +
        '/help — 显示此帮助信息',
    };
  }

  // ─── System Channel（子 agent 结果） ────────────────────────────────────────

  private async _processSystemMessage(msg: InboundMessage): Promise<OutboundMessage | null> {
    // chat_id 格式："channel:chatId"
    const [channel, ...rest] = msg.chatId.split(':');
    const chatId = rest.join(':');
    if (!channel || !chatId) return null;

    const sessionKey = `${channel}:${chatId}`;
    const session = this.sessionManager.getOrCreate(sessionKey);
    const history = session.getHistory(this.memoryWindow) as CoreMessage[];

    const messages = await this.contextBuilder.buildMessages({
      history,
      currentMessage: msg.content,
      channel,
      chatId,
    });

    const { finalContent, allMessages } = await this._runLoop(messages, async () => {});

    this._saveTurn(session, allMessages, 1 + history.length);
    this.sessionManager.save(session);

    return {
      channel,
      chatId,
      content: finalContent ?? '后台任务已完成。',
    };
  }

  // ─── Session History 保存 ─────────────────────────────────────────────────

  /**
   * 将本轮新增消息保存到 session history
   * - 截断过长的工具结果（超过 TOOL_RESULT_MAX_CHARS）
   * - 过滤 runtime context tag 消息（不持久化）
   * - 将图片 base64 替换为 "[image]" 占位符
   */
  private _saveTurn(
    session: SessionManager extends { getOrCreate(key: string): infer S } ? S : never,
    allMessages: CoreMessage[],
    skipCount: number,
  ): void {
    const now = new Date().toISOString();
    for (const msg of allMessages.slice(skipCount)) {
      // 过滤 runtime context tag
      if (
        msg.role === 'user' &&
        typeof msg.content === 'string' &&
        msg.content.startsWith(RUNTIME_CONTEXT_TAG)
      ) {
        continue;
      }

      let content = msg.content;

      // 截断过长的工具结果
      if (msg.role === 'tool' && typeof content === 'string' && content.length > TOOL_RESULT_MAX_CHARS) {
        content = content.slice(0, TOOL_RESULT_MAX_CHARS) + '\n... (已截断)';
      }

      // 将 base64 图片替换为占位符
      if (Array.isArray(content)) {
        const sanitized = (content as unknown as Array<Record<string, unknown>>).map((item) => {
          if (typeof item === 'object' && item !== null && item['type'] === 'image') {
            return { type: 'text' as const, text: '[image]' };
          }
          return item;
        });
        content = sanitized as unknown as typeof content;
      }

      (session as { messages: Array<Record<string, unknown>> }).messages.push({
        ...msg,
        content,
        timestamp: now,
      } as Record<string, unknown>);
    }
    (session as { updatedAt: Date }).updatedAt = new Date();
  }

  // ─── 后台 consolidation ────────────────────────────────────────────────────

  private _triggerConsolidation(sessionKey: string, session: ReturnType<SessionManager['getOrCreate']>): void {
    this.consolidatingKeys.add(sessionKey);
    this.memoryStore
      .consolidate(session, this.provider, this.model, { memoryWindow: this.memoryWindow })
      .finally(() => this.consolidatingKeys.delete(sessionKey));
  }
}
