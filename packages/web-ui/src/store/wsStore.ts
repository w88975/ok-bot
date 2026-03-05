/**
 * wsStore — WebSocket 连接管理
 *
 * 负责：连接/断开/发送、消息分发到 agentStore/chatStore、断线自动重连。
 */

import { create } from 'zustand';
import type { ConnectionStatus } from '../types.js';
import { useAgentStore } from './agentStore.js';
import { useChatStore } from './chatStore.js';

/** 最大自动重连次数 */
const MAX_RECONNECT = 5;
/** 重连间隔（毫秒） */
const RECONNECT_INTERVAL = 3000;

interface WsState {
  /** 连接状态 */
  status: ConnectionStatus;
  /** WebSocket 实例 */
  ws: WebSocket | null;
  /** 已重连次数 */
  reconnectCount: number;
  /** 重连定时器 id */
  reconnectTimer: ReturnType<typeof setTimeout> | null;

  /** 连接到指定 URL（默认 ws://当前 host/ws） */
  connect: (url?: string) => void;
  /** 断开连接（不再自动重连） */
  disconnect: () => void;
  /** 发送 JSON 消息（连接未就绪时静默忽略） */
  send: (msg: Record<string, unknown>) => void;
}

export const useWsStore = create<WsState>((set, get) => ({
  status: 'disconnected',
  ws: null,
  reconnectCount: 0,
  reconnectTimer: null,

  connect: (url?: string) => {
    const { ws, reconnectTimer } = get();

    // 清除旧重连定时器
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      set({ reconnectTimer: null });
    }

    // 避免重复连接
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }

    const wsUrl = url ?? `ws://${window.location.host}/ws`;
    set({ status: 'connecting' });

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      set({ status: 'connected', ws: socket, reconnectCount: 0 });
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as Record<string, unknown>;
        _dispatch(msg);
      } catch {
        console.warn('[wsStore] 无法解析消息：', event.data);
      }
    };

    socket.onclose = () => {
      const { reconnectCount, disconnect } = get();
      set({ status: 'disconnected', ws: null });

      // 自动重连
      if (reconnectCount < MAX_RECONNECT) {
        const timer = setTimeout(() => {
          set((s) => ({ reconnectCount: s.reconnectCount + 1, reconnectTimer: null }));
          get().connect(wsUrl);
        }, RECONNECT_INTERVAL);
        set({ reconnectTimer: timer });
      } else {
        console.warn('[wsStore] 已达到最大重连次数，停止重连');
        // 重置计数以允许手动重连
        disconnect();
      }
    };

    socket.onerror = (err) => {
      console.error('[wsStore] WebSocket 错误：', err);
    };

    set({ ws: socket });
  },

  disconnect: () => {
    const { ws, reconnectTimer } = get();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    ws?.close();
    set({ status: 'disconnected', ws: null, reconnectCount: 0, reconnectTimer: null });
  },

  send: (msg) => {
    const { ws } = get();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      console.warn('[wsStore] WebSocket 未连接，消息已丢弃：', msg);
    }
  },
}));

/** 将服务器消息分发到对应 store */
function _dispatch(msg: Record<string, unknown>) {
  const type = msg['type'] as string;

  switch (type) {
    case 'connected':
      // 连接成功，状态已在 onopen 更新
      break;

    case 'agent-status': {
      const agents = msg['agents'] as Array<{ id: string; workspace: string; status: string }>;
      if (Array.isArray(agents)) {
        useAgentStore.getState().setAgents(
          agents.map((a) => ({ id: a.id, workspace: a.workspace, status: a.status as never })),
        );
      }
      break;
    }

    case 'agent-created': {
      const agent = msg['agent'] as { id: string; workspace: string; status: string };
      if (agent) {
        useAgentStore.getState().upsertAgent({ ...agent, status: agent.status as never });
      }
      break;
    }

    case 'message': {
      const { agentId, content, sessionKey, groupId } = msg as {
        agentId: string;
        content: string;
        sessionKey: string;
        groupId?: string;
      };
      // 停止对应 sessionKey 的 loading
      useChatStore.getState().setLoading(sessionKey, false);
      useChatStore.getState().appendMessage(sessionKey, {
        role: 'agent',
        agentId,
        content,
        groupId,
      });
      break;
    }

    case 'group-created':
    case 'group-status': {
      const group = msg['group'] as {
        id: string;
        name: string;
        agentIds: string[];
        createdAt: number;
      };
      if (group) {
        useAgentStore.getState().upsertGroup(group);
      }
      break;
    }

    case 'group-dissolved': {
      const groupId = msg['groupId'] as string;
      if (groupId) {
        useAgentStore.getState().removeGroup(groupId);
      }
      break;
    }

    case 'error': {
      const message = msg['message'] as string;
      console.error('[wsStore] 服务器错误：', message);
      // 全局 toast 可在此扩展
      break;
    }
  }
}
