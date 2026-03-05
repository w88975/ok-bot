/**
 * Spawn 子 agent 工具（spawn）
 * 允许主 agent 将长任务委托给后台 SubagentManager 执行
 */

import { z } from 'zod';
import type { ToolDefinition, ContextAwareTool } from '../ToolRegistry.js';

/** SubagentManager 的最小接口（避免循环依赖） */
export interface SpawnableManager {
  spawn(options: {
    task: string;
    label?: string;
    originChannel: string;
    originChatId: string;
    sessionKey?: string;
  }): Promise<string>;
}

/**
 * SpawnTool — 派生子 agent 工具
 *
 * 实现 ContextAwareTool，每轮注入当前会话上下文，
 * 确保子 agent 完成后能将结果回报到正确的会话。
 */
export class SpawnTool implements ContextAwareTool {
  private channel: string = 'cli';
  private chatId: string = 'direct';
  private sessionKey?: string;

  constructor(private readonly manager: SpawnableManager) {}

  /** 注入当前轮次会话上下文 */
  setContext(channel: string, chatId: string): void {
    this.channel = channel;
    this.chatId = chatId;
    this.sessionKey = `${channel}:${chatId}`;
  }

  /**
   * 转换为 ToolDefinition，用于注册到 ToolRegistry
   */
  toDefinition(): ToolDefinition {
    return {
      name: 'spawn',
      description:
        '在后台派生一个子 agent 执行独立任务。子 agent 完成后会通知主 agent。' +
        '适合耗时较长或不需要即时结果的任务。',
      parameters: z.object({
        task: z.string().describe('子 agent 需要完成的任务描述（详细说明）'),
        label: z.string().optional().describe('任务简短标签（用于状态显示，默认取 task 前 30 字符）'),
      }),
      execute: async ({ task, label }) => {
        return this.manager.spawn({
          task,
          label,
          originChannel: this.channel,
          originChatId: this.chatId,
          sessionKey: this.sessionKey,
        });
      },
    };
  }
}
