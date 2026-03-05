/** 前端共享类型定义 */

/** Agent 状态 */
export type AgentStatus = 'starting' | 'running' | 'stopped' | 'error';

/** Agent 信息 */
export interface AgentInfo {
  id: string;
  workspace: string;
  status: AgentStatus;
}

/** 群组信息 */
export interface GroupInfo {
  id: string;
  name: string;
  agentIds: string[];
  createdAt: number;
}

/** 聊天消息 */
export interface Message {
  id: string;
  role: 'user' | 'agent';
  agentId?: string;
  content: string;
  timestamp: number;
  groupId?: string;
}

/** WebSocket 连接状态 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

/** 选中的会话（agent 单聊或群组聊天） */
export type SelectedSession =
  | { type: 'agent'; agentId: string }
  | { type: 'group'; groupId: string };
