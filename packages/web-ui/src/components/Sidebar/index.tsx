import { useState } from 'react';
import { useAgentStore } from '../../store/agentStore.js';
import { ConnectionStatus } from '../ConnectionStatus.js';
import { AgentItem } from './AgentItem.js';
import { GroupItem } from './GroupItem.js';
import { CreateAgentButton } from './CreateAgentButton.js';
import { CreateGroupButton } from './CreateGroupButton.js';
import { Modal } from '../ui/Modal.js';
import { CreateAgentForm } from '../../forms/CreateAgentForm.js';
import { CreateGroupForm } from '../../forms/CreateGroupForm.js';

export function Sidebar() {
  const agents = useAgentStore((s) => s.agents);
  const groups = useAgentStore((s) => s.groups);
  const selectedSession = useAgentStore((s) => s.selectedSession);
  const selectSession = useAgentStore((s) => s.selectSession);

  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  return (
    <aside className="flex flex-col h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* 顶部品牌 + 连接状态 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          ok-bot
        </h1>
        <ConnectionStatus />
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Agents 列表 */}
        <section className="mb-1">
          <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Agents
          </p>
          <div className="px-2 space-y-0.5">
            {agents.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">暂无 agent</p>
            ) : (
              agents.map((agent) => (
                <AgentItem
                  key={agent.id}
                  agent={agent}
                  selected={
                    selectedSession?.type === 'agent' && selectedSession.agentId === agent.id
                  }
                  onClick={() => selectSession({ type: 'agent', agentId: agent.id })}
                />
              ))
            )}
            <CreateAgentButton onClick={() => setAgentModalOpen(true)} />
          </div>
        </section>

        {/* 群组列表 */}
        {(groups.length > 0 || true) && (
          <section className="mt-2">
            <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              群组
            </p>
            <div className="px-2 space-y-0.5">
              {groups.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">暂无群组</p>
              ) : (
                groups.map((group) => (
                  <GroupItem
                    key={group.id}
                    group={group}
                    selected={
                      selectedSession?.type === 'group' && selectedSession.groupId === group.id
                    }
                    onClick={() => selectSession({ type: 'group', groupId: group.id })}
                  />
                ))
              )}
              <CreateGroupButton onClick={() => setGroupModalOpen(true)} />
            </div>
          </section>
        )}
      </div>

      {/* 创建 Agent 弹窗 */}
      <Modal open={agentModalOpen} onClose={() => setAgentModalOpen(false)} title="新建 Agent" maxWidth="lg">
        <CreateAgentForm onSuccess={() => setAgentModalOpen(false)} />
      </Modal>

      {/* 创建群组弹窗 */}
      <Modal open={groupModalOpen} onClose={() => setGroupModalOpen(false)} title="新建群组">
        <CreateGroupForm onSuccess={() => setGroupModalOpen(false)} />
      </Modal>
    </aside>
  );
}
