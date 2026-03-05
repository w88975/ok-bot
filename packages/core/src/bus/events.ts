/**
 * 消息总线事件类型定义
 * 定义 agent 内部通信的入站和出站消息格式
 */

/**
 * 入站消息 — 从外部 channel 或内部系统流入 agent 的消息
 */
export interface InboundMessage {
  /** 来源渠道（如 "telegram"、"cli"、"http"、"system"） */
  channel: string;
  /** 消息发送者 ID（用户 ID 或系统标识） */
  senderId: string;
  /** 目标会话 ID（如 Telegram chat_id） */
  chatId: string;
  /** 消息文本内容 */
  content: string;
  /** 附带的媒体文件路径列表（图片等） */
  media?: string[];
  /** 附加元数据（如 message_id 等 channel 专属字段） */
  metadata?: Record<string, unknown>;
}

/**
 * 出站消息 — 从 agent 发出到外部 channel 的消息
 */
export interface OutboundMessage {
  /** 目标渠道 */
  channel: string;
  /** 目标会话 ID */
  chatId: string;
  /** 回复内容 */
  content: string;
  /** 附加元数据（如进度标记、工具提示等） */
  metadata?: Record<string, unknown>;
}

/**
 * 计算入站消息的唯一 session key
 * 格式："{channel}:{chatId}"
 */
export function getSessionKey(msg: InboundMessage): string {
  return `${msg.channel}:${msg.chatId}`;
}
