/**
 * 消息发送工具（message）
 * 允许 agent 主动向指定 channel/chatId 发送消息
 * 追踪本轮是否已通过此工具发送消息（用于避免双重响应）
 */

import { z } from 'zod';
import type { ToolDefinition, ContextAwareTool } from '../ToolRegistry.js';
import type { OutboundMessage } from '../../bus/events.js';

/** 发布出站消息的回调函数类型 */
export type PublishOutbound = (msg: OutboundMessage) => Promise<void>;

/**
 * MessageTool — 消息发送工具
 *
 * 实现 ContextAwareTool 接口，每轮对话前注入当前会话的 channel/chatId。
 * 通过 sentInTurn 标记追踪本轮是否已主动发送消息。
 */
export class MessageTool implements ContextAwareTool {
  /** 当前会话 channel */
  private channel: string = 'cli';
  /** 当前会话 chatId */
  private chatId: string = 'direct';
  /** 当前消息 ID（可选，用于回复） */
  private messageId?: string;
  /** 本轮是否已通过此工具发送消息 */
  private _sentInTurn: boolean = false;

  constructor(private readonly publishOutbound: PublishOutbound) {}

  /**
   * 注入当前轮次的会话上下文
   * @param channel 来源渠道
   * @param chatId 会话 ID
   * @param messageId 可选的消息 ID
   */
  setContext(channel: string, chatId: string, messageId?: string): void {
    this.channel = channel;
    this.chatId = chatId;
    this.messageId = messageId;
  }

  /** 重置本轮发送标记（每轮对话开始前调用） */
  startTurn(): void {
    this._sentInTurn = false;
  }

  /** 本轮是否已通过工具主动发送消息 */
  get sentInTurn(): boolean {
    return this._sentInTurn;
  }

  /**
   * 转换为 ToolDefinition，用于注册到 ToolRegistry
   */
  toDefinition(): ToolDefinition {
    return {
      name: 'message',
      description:
        '向指定 channel/chatId 发送消息。用于主动发起通知或将回复发送到不同会话。' +
        '若不指定 channel 和 chatId，则默认发送到当前会话。',
      parameters: z.object({
        content: z.string().describe('要发送的消息内容'),
        channel: z.string().optional().describe('目标渠道（默认当前会话渠道）'),
        chat_id: z.string().optional().describe('目标会话 ID（默认当前会话）'),
      }),
      execute: async ({ content, channel, chat_id }) => {
        const targetChannel = channel ?? this.channel;
        const targetChatId = chat_id ?? this.chatId;

        await this.publishOutbound({
          channel: targetChannel,
          chatId: targetChatId,
          content,
          metadata: this.messageId ? { replyToMessageId: this.messageId } : {},
        });

        this._sentInTurn = true;
        return `消息已发送到 ${targetChannel}:${targetChatId}`;
      },
    };
  }
}
