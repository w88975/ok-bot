/**
 * WebChannel 消息协议类型定义
 * 所有 WebSocket 消息均为 JSON 格式
 */

import type { AgentConfig, AgentInfo } from '../../types.js';

export type { AgentInfo };

// ─── 客户端 → 服务器 ────────────────────────────────────────────────────────

/** 单聊消息 */
export interface ChatMessage {
  type: 'chat';
  agentId: string;
  content: string;
  sessionKey?: string;
}

/** 群组消息（广播或 @mention） */
export interface GroupChatMessage {
  type: 'group-chat';
  groupId: string;
  content: string;
  /** 指定 agent id 列表（@mention），为空则广播群组内所有 agent */
  mentions?: string[];
}

/** 创建 agent */
export interface CreateAgentMessage {
  type: 'create-agent';
  config: Omit<AgentConfig, 'id'> & { id: string };
  bootstrap?: {
    agents?: string;
    soul?: string;
    user?: string;
    tools?: string;
  };
}

/** 获取 agent 列表 */
export interface ListAgentsMessage {
  type: 'list-agents';
}

/** 创建群组 */
export interface CreateGroupMessage {
  type: 'create-group';
  groupId: string;
  name?: string;
  agentIds: string[];
}

/** 更新群组成员 */
export interface UpdateGroupMessage {
  type: 'update-group';
  groupId: string;
  addAgentIds?: string[];
  removeAgentIds?: string[];
}

/** 所有客户端发送的消息类型 */
export type ClientMessage =
  | ChatMessage
  | GroupChatMessage
  | CreateAgentMessage
  | ListAgentsMessage
  | CreateGroupMessage
  | UpdateGroupMessage;

// ─── 服务器 → 客户端 ────────────────────────────────────────────────────────

/** 连接成功 */
export interface ConnectedMessage {
  type: 'connected';
  clientId: string;
}

/** Agent 状态广播 */
export interface AgentStatusMessage {
  type: 'agent-status';
  agents: AgentInfo[];
}

/** Agent 消息回复 */
export interface AgentMessage {
  type: 'message';
  agentId: string;
  content: string;
  sessionKey: string;
  /** 所属群组 id（单聊时为 undefined） */
  groupId?: string;
}

/** Agent 创建成功 */
export interface AgentCreatedMessage {
  type: 'agent-created';
  agent: AgentInfo;
}

/** 群组创建成功 */
export interface GroupCreatedMessage {
  type: 'group-created';
  group: GroupInfo;
}

/** 群组状态更新（成员变更） */
export interface GroupStatusMessage {
  type: 'group-status';
  group: GroupInfo;
}

/** 群组解散 */
export interface GroupDissolvedMessage {
  type: 'group-dissolved';
  groupId: string;
}

/** 错误通知 */
export interface ErrorMessage {
  type: 'error';
  message: string;
  requestId?: string;
}

/** 所有服务器发送的消息类型 */
export type ServerMessage =
  | ConnectedMessage
  | AgentStatusMessage
  | AgentMessage
  | AgentCreatedMessage
  | GroupCreatedMessage
  | GroupStatusMessage
  | GroupDissolvedMessage
  | ErrorMessage;

// ─── 共享数据类型 ────────────────────────────────────────────────────────────

/** 群组信息 */
export interface GroupInfo {
  id: string;
  name: string;
  agentIds: string[];
  createdAt: number;
}
