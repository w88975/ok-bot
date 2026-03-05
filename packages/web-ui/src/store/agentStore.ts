/**
 * agentStore — agent 列表与群组状态管理
 */

import { create } from 'zustand';
import type { AgentInfo, GroupInfo, SelectedSession } from '../types.js';

interface AgentState {
  /** 当前所有 agent */
  agents: AgentInfo[];
  /** 当前所有群组 */
  groups: GroupInfo[];
  /** 当前选中的会话（agent 单聊 或 群组聊天） */
  selectedSession: SelectedSession | null;

  /** 更新 agent 列表（全量替换） */
  setAgents: (agents: AgentInfo[]) => void;
  /** 更新或新增单个 agent */
  upsertAgent: (agent: AgentInfo) => void;
  /** 更新或新增群组 */
  upsertGroup: (group: GroupInfo) => void;
  /** 移除群组 */
  removeGroup: (groupId: string) => void;
  /** 选中会话 */
  selectSession: (session: SelectedSession | null) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  groups: [],
  selectedSession: null,

  setAgents: (agents) => set({ agents }),

  upsertAgent: (agent) =>
    set((state) => {
      const exists = state.agents.find((a) => a.id === agent.id);
      if (exists) {
        return { agents: state.agents.map((a) => (a.id === agent.id ? agent : a)) };
      }
      return { agents: [...state.agents, agent] };
    }),

  upsertGroup: (group) =>
    set((state) => {
      const exists = state.groups.find((g) => g.id === group.id);
      if (exists) {
        return { groups: state.groups.map((g) => (g.id === group.id ? group : g)) };
      }
      return { groups: [...state.groups, group] };
    }),

  removeGroup: (groupId) =>
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
      selectedSession:
        state.selectedSession?.type === 'group' && state.selectedSession.groupId === groupId
          ? null
          : state.selectedSession,
    })),

  selectSession: (session) => set({ selectedSession: session }),
}));
