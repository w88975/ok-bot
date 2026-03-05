/**
 * HeartbeatService — 周期性心跳检查服务
 *
 * 两阶段设计（对标 nanobot）：
 * Phase 1（决策）：读取 HEARTBEAT.md，通过 LLM 的 heartbeat 虚拟工具决定 skip/run
 * Phase 2（执行）：仅当 Phase 1 返回 run 时，调用 onExecute 回调进入完整 agent loop
 *
 * 使用 LLM tool-call 决策而非文本解析，更加可靠。
 */

import fs from 'node:fs';
import path from 'node:path';
import { tool, generateText } from 'ai';
import { z } from 'zod';
import type { ILLMProvider } from '../providers/types.js';

/**
 * HeartbeatService 配置
 */
export interface HeartbeatServiceConfig {
  /** workspace 路径（用于定位 HEARTBEAT.md） */
  workspace: string;
  /** LLM provider */
  provider: ILLMProvider;
  /** 使用的模型字符串 */
  model: string;
  /** Phase 2 执行回调：接收任务描述，返回执行结果 */
  onExecute?: (tasks: string) => Promise<string>;
  /** 执行结果通知回调（如发送消息到用户） */
  onNotify?: (result: string) => Promise<void>;
  /** 检查间隔秒数（默认 1800 = 30 分钟） */
  intervalSeconds?: number;
  /** 是否启用（默认 true） */
  enabled?: boolean;
}

/**
 * HeartbeatService — 周期性任务检查服务
 */
export class HeartbeatService {
  private readonly workspace: string;
  private readonly provider: ILLMProvider;
  private readonly model: string;
  readonly onExecute?: (tasks: string) => Promise<string>;
  readonly onNotify?: (result: string) => Promise<void>;
  private readonly intervalMs: number;
  private readonly enabled: boolean;

  private running = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(config: HeartbeatServiceConfig) {
    this.workspace = config.workspace;
    this.provider = config.provider;
    this.model = config.model;
    this.onExecute = config.onExecute;
    this.onNotify = config.onNotify;
    this.intervalMs = (config.intervalSeconds ?? 1800) * 1000;
    this.enabled = config.enabled ?? true;
  }

  /** HEARTBEAT.md 文件路径 */
  get heartbeatFile(): string {
    return path.join(this.workspace, 'HEARTBEAT.md');
  }

  /** 启动心跳服务 */
  start(): void {
    if (!this.enabled) {
      console.info('[HeartbeatService] 已禁用');
      return;
    }
    if (this.running) return;

    this.running = true;
    this._armTimer();
    console.info(`[HeartbeatService] 已启动（每 ${this.intervalMs / 1000}s 检查一次）`);
  }

  /** 停止心跳服务 */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 手动立即触发一次心跳检查
   * @returns 执行结果（若有），或 null
   */
  async triggerNow(): Promise<string | null> {
    const content = this._readHeartbeatFile();
    if (!content) return null;

    const { action, tasks } = await this._decide(content);
    if (action !== 'run' || !this.onExecute) return null;

    return this.onExecute(tasks);
  }

  // ─── 私有方法 ──────────────────────────────────────────────────────────────

  private _armTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    if (!this.running) return;

    this.timer = setTimeout(() => void this._tick(), this.intervalMs);
  }

  private async _tick(): Promise<void> {
    if (!this.running) return;

    const content = this._readHeartbeatFile();
    if (!content) {
      console.debug('[HeartbeatService] HEARTBEAT.md 不存在或为空，跳过');
      this._armTimer();
      return;
    }

    console.info('[HeartbeatService] 检查任务...');

    try {
      const { action, tasks } = await this._decide(content);

      if (action !== 'run') {
        console.info('[HeartbeatService] 无活跃任务，跳过');
      } else {
        console.info('[HeartbeatService] 发现任务，开始执行...');
        if (this.onExecute) {
          const result = await this.onExecute(tasks);
          if (result && this.onNotify) {
            await this.onNotify(result);
          }
        }
      }
    } catch (error) {
      console.error('[HeartbeatService] 执行出错：', error);
    }

    this._armTimer();
  }

  /**
   * Phase 1：通过 LLM heartbeat 虚拟工具决定 skip/run
   * 不依赖文本解析，使用 tool call 保证可靠性
   */
  private async _decide(content: string): Promise<{ action: 'skip' | 'run'; tasks: string }> {
    const heartbeatTool = tool({
      description: '报告心跳决策：是否有需要执行的活跃任务',
      parameters: z.object({
        action: z
          .enum(['skip', 'run'])
          .describe('skip = 无任务需要执行；run = 存在活跃任务'),
        tasks: z
          .string()
          .optional()
          .describe('活跃任务的自然语言描述（action=run 时必填）'),
      }),
      execute: async (args) => args.action,
    });

    try {
      const result = await generateText({
        model: this.provider as never, // 使用 provider 内部的 model
        messages: [
          {
            role: 'system',
            content: '你是心跳检查 agent。阅读 HEARTBEAT.md 内容后，调用 heartbeat 工具报告决策。',
          },
          {
            role: 'user',
            content: `请检查以下 HEARTBEAT.md，判断是否存在需要执行的活跃任务：\n\n${content}`,
          },
        ],
        tools: { heartbeat: heartbeatTool },
        maxSteps: 1,
      });

      const tc = result.toolCalls[0];
      if (!tc || tc.toolName !== 'heartbeat') {
        return { action: 'skip', tasks: '' };
      }

      const args = tc.args as { action: 'skip' | 'run'; tasks?: string };
      return { action: args.action, tasks: args.tasks ?? '' };
    } catch {
      return { action: 'skip', tasks: '' };
    }
  }

  private _readHeartbeatFile(): string | null {
    if (!fs.existsSync(this.heartbeatFile)) return null;
    try {
      const content = fs.readFileSync(this.heartbeatFile, 'utf-8').trim();
      return content || null;
    } catch {
      return null;
    }
  }
}
