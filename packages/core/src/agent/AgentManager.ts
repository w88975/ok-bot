/**
 * AgentManager — 多 agent 编排器（主线程）
 *
 * 每个 AgentInstance 在独立的 Worker Thread 中运行（隔离故障）。
 * 主线程通过 MessageChannel (postMessage) 与 Worker 通信。
 * 支持动态创建、删除、查询 agent，以及全局有序关闭。
 */

import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type {
  AgentConfig,
  AgentInfo,
  AgentStatus,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from '../types.js';
import type { InboundMessage, OutboundMessage } from '../bus/events.js';
import type { AgentEvent, OnEvent } from './AgentEvent.js';

/** Agent 未找到时的错误 */
export class AgentNotFoundError extends Error {
  constructor(agentId: string) {
    super(`Agent "${agentId}" 不存在`);
    this.name = 'AgentNotFoundError';
  }
}

/** 等待中的请求 */
interface PendingRequest {
  resolve: (msg: OutboundMessage) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  /** 结构化 agent 事件回调（可选） */
  onEvent?: OnEvent;
}

/** 内部 agent 实例记录 */
interface AgentInstance {
  id: string;
  workspace: string;
  status: AgentStatus;
  worker: Worker;
  /** 等待响应的请求 Map：requestId → PendingRequest */
  pendingRequests: Map<string, PendingRequest>;
}

/** Worker 文件路径（编译后的 JS） */
const WORKER_FILE = fileURLToPath(new URL('./AgentWorker.js', import.meta.url));

/**
 * AgentManager — 主线程多 agent 管理器
 *
 * @example
 * ```ts
 * const manager = new AgentManager();
 * await manager.createAgent({
 *   id: 'my-agent',
 *   workspace: '/path/to/workspace',
 *   provider: { model: 'openai:gpt-4o' },
 * });
 * const response = await manager.chat({ agentId: 'my-agent', content: '你好' });
 * ```
 */
export class AgentManager {
  private readonly agents = new Map<string, AgentInstance>();
  /** 请求超时毫秒数（默认 5 分钟） */
  private readonly requestTimeoutMs: number;

  constructor(options: { requestTimeoutMs?: number } = {}) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5 * 60 * 1000;
  }

  /**
   * 创建并启动一个新的 agent
   *
   * @param config agent 配置（含 id、workspace、provider 等）
   * @throws 若同名 agent 已存在则抛出错误
   */
  async createAgent(config: AgentConfig): Promise<AgentInfo> {
    if (this.agents.has(config.id)) {
      throw new Error(`Agent "${config.id}" 已存在`);
    }

    const worker = new Worker(WORKER_FILE, {
      workerData: config,
      // 在 Worker 中启用 ESM
      execArgv: [],
    });

    const instance: AgentInstance = {
      id: config.id,
      workspace: config.workspace,
      status: 'starting',
      worker,
      pendingRequests: new Map(),
    };

    this.agents.set(config.id, instance);

    // 等待 Worker 就绪（ready 信号或错误）
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Agent "${config.id}" 启动超时`));
      }, 30_000);

      worker.once('message', (msg: WorkerOutboundMessage) => {
        if (msg.type === 'ready') {
          clearTimeout(timeout);
          instance.status = 'running';
          resolve();
        }
      });

      worker.once('error', (err) => {
        clearTimeout(timeout);
        instance.status = 'error';
        reject(err);
      });
    });

    // 持续监听 Worker 消息（响应 + 主动推送）
    worker.on('message', (msg: WorkerOutboundMessage) => {
      this._handleWorkerMessage(instance, msg);
    });

    worker.on('error', (err) => {
      console.error(`[AgentManager] Agent "${config.id}" Worker 错误：`, err);
      instance.status = 'error';
    });

    worker.on('exit', (code) => {
      console.info(`[AgentManager] Agent "${config.id}" Worker 退出，code=${code}`);
      instance.status = 'stopped';
      this.agents.delete(config.id);
    });

    console.info(`[AgentManager] Agent "${config.id}" 已启动（workspace: ${config.workspace}）`);
    return { id: config.id, workspace: config.workspace, status: 'running' };
  }

  /**
   * 向指定 agent 发送消息并等待回复
   *
   * @param options 消息选项
   * @returns agent 的回复
   * @throws AgentNotFoundError 若 agent 不存在
   */
  async chat(options: {
    agentId: string;
    content: string;
    sessionKey?: string;
    channel?: string;
    chatId?: string;
    media?: string[];
    metadata?: Record<string, unknown>;
    /**
     * 结构化 agent 事件回调
     * 提供时，Worker 每产生一个 AgentEvent 即调用一次，最终仍 resolve 完整 OutboundMessage
     */
    onEvent?: OnEvent;
  }): Promise<OutboundMessage> {
    const instance = this._getAgent(options.agentId);
    const requestId = Math.random().toString(36).slice(2, 18);

    const channel = options.channel ?? 'http';
    const chatId = options.chatId ?? options.sessionKey ?? 'default';

    const inbound: InboundMessage = {
      channel,
      senderId: 'user',
      chatId,
      content: options.content,
      media: options.media,
      metadata: { ...options.metadata, _requestId: requestId },
    };

    return new Promise<OutboundMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        instance.pendingRequests.delete(requestId);
        reject(new Error(`Agent "${options.agentId}" 请求超时（${this.requestTimeoutMs}ms）`));
      }, this.requestTimeoutMs);

      instance.pendingRequests.set(requestId, { resolve, reject, timer, onEvent: options.onEvent });

      const workerMsg: WorkerInboundMessage = {
        type: 'message',
        payload: inbound,
        requestId,
      };
      instance.worker.postMessage(workerMsg);
    });
  }

  /**
   * 停止并移除指定 agent
   * @param agentId agent id
   */
  async removeAgent(agentId: string): Promise<void> {
    const instance = this._getAgent(agentId);

    // 拒绝所有等待中的请求
    for (const [, req] of instance.pendingRequests) {
      clearTimeout(req.timer);
      req.reject(new Error(`Agent "${agentId}" 已被移除`));
    }
    instance.pendingRequests.clear();

    // 发送关闭信号
    instance.worker.postMessage({ type: 'shutdown' } satisfies WorkerInboundMessage);

    // 等待 Worker 退出（最多 10 秒）
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        void instance.worker.terminate();
        resolve();
      }, 10_000);
      instance.worker.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.agents.delete(agentId);
    console.info(`[AgentManager] Agent "${agentId}" 已移除`);
  }

  /**
   * 列出所有 agent 的状态信息
   */
  listAgents(): AgentInfo[] {
    return [...this.agents.values()].map((a) => ({
      id: a.id,
      workspace: a.workspace,
      status: a.status,
    }));
  }

  /**
   * 有序关闭所有 agent
   */
  async shutdown(): Promise<void> {
    const ids = [...this.agents.keys()];
    await Promise.all(ids.map((id) => this.removeAgent(id).catch(() => {})));
    console.info('[AgentManager] 所有 agent 已关闭');
  }

  // ─── 私有方法 ──────────────────────────────────────────────────────────────

  private _getAgent(agentId: string): AgentInstance {
    const instance = this.agents.get(agentId);
    if (!instance) throw new AgentNotFoundError(agentId);
    return instance;
  }

  /** 处理 Worker 发来的消息（响应 or token or 主动推送） */
  private _handleWorkerMessage(instance: AgentInstance, msg: WorkerOutboundMessage): void {
    if (msg.type === 'ready') return; // 已在 createAgent 处理

    if (msg.requestId) {
      const pending = instance.pendingRequests.get(msg.requestId);
      if (pending) {
        // 结构化 agent 事件：转发给调用方回调，不结束 pending
        if (msg.type === 'event' && msg.event !== undefined) {
          void (pending.onEvent?.(msg.event as AgentEvent));
          return;
        }

        clearTimeout(pending.timer);
        instance.pendingRequests.delete(msg.requestId);

        if (msg.type === 'error') {
          pending.reject(new Error(msg.error ?? '未知错误'));
        } else if (msg.type === 'response' && msg.payload) {
          pending.resolve(msg.payload);
        }
        return;
      }
    }

    // 无 requestId：主动推送消息（如子 agent 结果、progress），暂时忽略或记录日志
    if (msg.type === 'response' && msg.payload) {
      const meta = msg.payload.metadata ?? {};
      if (!meta['_progress']) {
        console.info(
          `[AgentManager] Agent "${instance.id}" 主动推送：${msg.payload.content.slice(0, 80)}`,
        );
      }
    }
  }
}
