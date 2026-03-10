/**
 * SubagentManager — 后台子 agent 管理器
 *
 * 主 agent 通过 spawn 工具委托长任务给子 agent 异步执行。
 * 子 agent 拥有受限工具集（无 message/spawn），完成后通过 system channel 通知主 agent。
 */

import type { CoreMessage } from 'ai';
import type { ILLMProvider } from '../providers/types.js';
import type { MessageBus } from '../bus/MessageBus.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { createFileSystemTools } from '../tools/builtin/FileSystemTools.js';
import { createShellTool } from '../tools/builtin/ShellTool.js';
import { createWebSearchTool, createWebFetchTool } from '../tools/builtin/WebTools.js';
import type { ExecConfig } from '../types.js';

/** 子 agent 运行中的任务记录 */
interface SubagentTask {
  taskId: string;
  sessionKey?: string;
  promise: Promise<void>;
  cancelled: boolean;
}

/**
 * SubagentManager 配置
 */
export interface SubagentManagerConfig {
  provider: ILLMProvider;
  workspace: string;
  bus: MessageBus;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  braveApiKey?: string;
  execConfig?: ExecConfig;
  restrictToWorkspace?: boolean;
}

/**
 * SubagentManager — 管理所有后台子 agent 任务
 */
export class SubagentManager {
  private readonly config: Required<SubagentManagerConfig>;
  /** 运行中的任务：taskId → SubagentTask */
  private readonly runningTasks = new Map<string, SubagentTask>();
  /** session 关联的 task id 集合 */
  private readonly sessionTasks = new Map<string, Set<string>>();

  constructor(config: SubagentManagerConfig) {
    this.config = {
      model: config.provider.getDefaultModel(),
      temperature: 0.1,
      maxTokens: 4096,
      braveApiKey: '',
      execConfig: {},
      restrictToWorkspace: false,
      ...config,
    };
  }

  /**
   * 派生一个子 agent 在后台执行任务
   *
   * @returns 立即返回的确认消息（含 task id）
   */
  async spawn(options: {
    task: string;
    label?: string;
    originChannel: string;
    originChatId: string;
    sessionKey?: string;
  }): Promise<string> {
    const taskId = Math.random().toString(36).slice(2, 10);
    const label = options.label ?? options.task.slice(0, 30) + (options.task.length > 30 ? '...' : '');

    let cancelled = false;
    const promise = this._runSubagent(taskId, options.task, label, {
      channel: options.originChannel,
      chatId: options.originChatId,
    }).catch(() => {
      // 错误已在 _runSubagent 内部处理
    });

    const taskRecord: SubagentTask = { taskId, sessionKey: options.sessionKey, promise, cancelled };
    this.runningTasks.set(taskId, taskRecord);

    if (options.sessionKey) {
      const ids = this.sessionTasks.get(options.sessionKey) ?? new Set();
      ids.add(taskId);
      this.sessionTasks.set(options.sessionKey, ids);
    }

    promise.finally(() => {
      this.runningTasks.delete(taskId);
      if (options.sessionKey) {
        this.sessionTasks.get(options.sessionKey)?.delete(taskId);
      }
    });

    console.info(`[SubagentManager] 派生子 agent [${taskId}]：${label}`);
    return `子 agent [${label}] 已在后台启动（id: ${taskId}），完成后会通知你。`;
  }

  /**
   * 取消指定 session 下所有运行中的子 agent
   * @returns 取消的任务数量
   */
  async cancelBySession(sessionKey: string): Promise<number> {
    const ids = this.sessionTasks.get(sessionKey) ?? new Set();
    let count = 0;

    for (const taskId of ids) {
      const task = this.runningTasks.get(taskId);
      if (task && !task.cancelled) {
        task.cancelled = true;
        count++;
      }
    }

    return count;
  }

  /** 获取当前运行中的子 agent 数量 */
  getRunningCount(): number {
    return this.runningTasks.size;
  }

  // ─── 私有方法 ──────────────────────────────────────────────────────────────

  /** 执行子 agent 主循环 */
  private async _runSubagent(
    taskId: string,
    task: string,
    label: string,
    origin: { channel: string; chatId: string },
  ): Promise<void> {
    console.info(`[SubagentManager] 子 agent [${taskId}] 开始任务：${label}`);

    try {
      // 子 agent 受限工具集（无 message/spawn）
      const tools = new ToolRegistry();
      const allowedDir = this.config.restrictToWorkspace ? this.config.workspace : undefined;

      for (const toolDef of createFileSystemTools({ workspace: this.config.workspace, allowedDir })) {
        tools.register(toolDef);
      }
      tools.register(
        createShellTool({
          workingDir: this.config.workspace,
          timeout: this.config.execConfig?.timeout,
          pathAppend: this.config.execConfig?.pathAppend,
        }),
      );
      // tools.register(createWebSearchTool(this.config.braveApiKey || undefined));
      tools.register(createWebFetchTool());

      const systemPrompt = this._buildSubagentPrompt(task);
      let messages: CoreMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: task },
      ];

      const maxIterations = 15;
      let finalResult: string | null = null;

      for (let i = 0; i < maxIterations; i++) {
        // 检查是否已被取消
        const taskRecord = this.runningTasks.get(taskId);
        if (taskRecord?.cancelled) {
          finalResult = '任务已被取消。';
          break;
        }

        const response = await this.config.provider.chat(
          messages,
          tools.getDefinitions(),
          {
            model: this.config.model,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
          },
        );

        if (response.toolCalls.length > 0) {
          // 追加 assistant 工具调用消息
          messages.push({
            role: 'assistant',
            content: [
              ...(response.content ? [{ type: 'text' as const, text: response.content }] : []),
              ...response.toolCalls.map((tc) => ({
                type: 'tool-call' as const,
                toolCallId: tc.id,
                toolName: tc.name,
                args: tc.arguments,
              })),
            ],
          });

          // 执行工具并追加结果
          for (const tc of response.toolCalls) {
            const result = await tools.execute(tc.name, tc.arguments);
            messages.push({
              role: 'tool',
              content: [{ type: 'tool-result', toolCallId: tc.id, toolName: tc.name, result }],
            });
          }
        } else {
          finalResult = response.content;
          break;
        }
      }

      const result = finalResult ?? '任务完成，但未生成最终响应。';
      console.info(`[SubagentManager] 子 agent [${taskId}] 完成`);
      await this._announceResult(taskId, label, task, result, origin, 'ok');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SubagentManager] 子 agent [${taskId}] 失败：${errorMsg}`);
      await this._announceResult(taskId, label, task, `错误：${errorMsg}`, origin, 'error');
    }
  }

  /** 将子 agent 结果通过 system channel 注回主 agent */
  private async _announceResult(
    taskId: string,
    label: string,
    task: string,
    result: string,
    origin: { channel: string; chatId: string },
    status: 'ok' | 'error',
  ): Promise<void> {
    const statusText = status === 'ok' ? '成功完成' : '执行失败';

    const content =
      `[子 agent '${label}' ${statusText}]\n\n` +
      `任务：${task}\n\n` +
      `结果：\n${result}\n\n` +
      `请用 1-2 句话自然地向用户汇报。不要提及"子 agent"或任务 ID 等技术细节。`;

    await this.config.bus.publishInbound({
      channel: 'system',
      senderId: 'subagent',
      chatId: `${origin.channel}:${origin.chatId}`,
      content,
    });
  }

  /** 构建子 agent 专用 system prompt */
  private _buildSubagentPrompt(task: string): string {
    const now = new Date().toLocaleString('zh-CN');
    return `# 子 Agent

## 当前时间
${now}

你是由主 agent 派生的子 agent，负责完成一个特定任务。

## 规则
1. 专注于完成分配的任务，不做其他事情
2. 你的最终回复将被报告给主 agent
3. 不主动发起对话，不承接额外任务
4. 简洁但信息完整地描述发现和结果

## 可用能力
- 读写 workspace 文件
- 执行 shell 命令
- 搜索和抓取网页
- 完整完成指定任务

## 限制
- 无法直接向用户发送消息
- 无法再次派生子 agent
- 无法访问主 agent 的对话历史

## Workspace
${this.config.workspace}

完成任务后，请清晰地描述你的发现或执行结果。`;
  }
}
