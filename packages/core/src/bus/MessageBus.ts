/**
 * 消息总线 — 管理 agent 内部的入站/出站消息队列
 * 采用基于 Promise 的等待机制，支持异步消费
 */

import type { InboundMessage, OutboundMessage } from './events.js';

/** 出站消息订阅回调类型 */
export type OutboundHandler = (msg: OutboundMessage) => Promise<void> | void;

/**
 * MessageBus — agent 内部消息总线
 *
 * 入站消息通过 publishInbound 投递，AgentLoop 通过 consumeInbound 消费。
 * 出站消息通过 publishOutbound 发布，channel adapter 通过 onOutbound 订阅。
 */
export class MessageBus {
  /** 入站消息队列 */
  private readonly inboundQueue: InboundMessage[] = [];

  /** 等待入站消息的 resolve 函数列表 */
  private readonly inboundWaiters: Array<(msg: InboundMessage) => void> = [];

  /** 出站消息订阅处理器列表 */
  private readonly outboundHandlers: OutboundHandler[] = [];

  /**
   * 发布入站消息
   * 若有正在等待的消费者，立即推送；否则入队
   */
  async publishInbound(msg: InboundMessage): Promise<void> {
    const waiter = this.inboundWaiters.shift();
    if (waiter) {
      waiter(msg);
    } else {
      this.inboundQueue.push(msg);
    }
  }

  /**
   * 消费一条入站消息（阻塞等待，直到有消息到达）
   * @returns 下一条入站消息的 Promise
   */
  consumeInbound(): Promise<InboundMessage> {
    const queued = this.inboundQueue.shift();
    if (queued) {
      return Promise.resolve(queued);
    }
    return new Promise<InboundMessage>((resolve) => {
      this.inboundWaiters.push(resolve);
    });
  }

  /**
   * 发布出站消息，通知所有已注册的 channel 处理器
   */
  async publishOutbound(msg: OutboundMessage): Promise<void> {
    await Promise.all(this.outboundHandlers.map((h) => h(msg)));
  }

  /**
   * 订阅出站消息
   * @param handler 出站消息处理函数
   * @returns 取消订阅的函数
   */
  onOutbound(handler: OutboundHandler): () => void {
    this.outboundHandlers.push(handler);
    return () => {
      const idx = this.outboundHandlers.indexOf(handler);
      if (idx !== -1) this.outboundHandlers.splice(idx, 1);
    };
  }

  /** 清空所有队列和订阅（用于测试重置） */
  clear(): void {
    this.inboundQueue.length = 0;
    this.inboundWaiters.length = 0;
    this.outboundHandlers.length = 0;
  }
}
