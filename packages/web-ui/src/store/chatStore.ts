/**
 * chatStore — 按 sessionKey 分组的聊天消息状态
 */

import { create } from 'zustand';
import type { Message } from '../types.js';
import { randomId } from '../utils.js';

interface ChatState {
  /** sessionKey → 消息列表 */
  messages: Map<string, Message[]>;
  /** 正在 loading 的 sessionKey 集合 */
  loadingKeys: Set<string>;

  /** 追加消息 */
  appendMessage: (sessionKey: string, msg: Omit<Message, 'id' | 'timestamp'>) => void;
  /** 设置 loading 状态 */
  setLoading: (sessionKey: string, loading: boolean) => void;
  /** 获取某个 session 的消息（不存在则返回空数组） */
  getMessages: (sessionKey: string) => Message[];
  /** 清空某个 session */
  clearSession: (sessionKey: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: new Map(),
  loadingKeys: new Set(),

  appendMessage: (sessionKey, msg) => {
    set((state) => {
      const prev = state.messages.get(sessionKey) ?? [];
      const newMsg: Message = {
        ...msg,
        id: randomId(),
        timestamp: Date.now(),
      };
      const next = new Map(state.messages);
      next.set(sessionKey, [...prev, newMsg]);
      return { messages: next };
    });
  },

  setLoading: (sessionKey, loading) => {
    set((state) => {
      const next = new Set(state.loadingKeys);
      if (loading) {
        next.add(sessionKey);
      } else {
        next.delete(sessionKey);
      }
      return { loadingKeys: next };
    });
  },

  getMessages: (sessionKey) => {
    return get().messages.get(sessionKey) ?? [];
  },

  clearSession: (sessionKey) => {
    set((state) => {
      const next = new Map(state.messages);
      next.delete(sessionKey);
      return { messages: next };
    });
  },
}));
