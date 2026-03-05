import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar/index.js';
import { SingleChatPanel } from './panels/SingleChatPanel.js';
import { GroupChatPanel } from './panels/GroupChatPanel.js';
import { useAgentStore } from './store/agentStore.js';
import { useWsStore } from './store/wsStore.js';

export default function App() {
  const connect = useWsStore((s) => s.connect);
  const disconnect = useWsStore((s) => s.disconnect);

  const selectedSession = useAgentStore((s) => s.selectedSession);
  const agents = useAgentStore((s) => s.agents);
  const groups = useAgentStore((s) => s.groups);

  // 挂载时连接 WebSocket，卸载时断开
  useEffect(() => {
    connect();
    return () => disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听系统暗色模式偏好
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (dark: boolean) => {
      document.documentElement.classList.toggle('dark', dark);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // 渲染主面板
  const renderMainPanel = () => {
    if (!selectedSession) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              选择一个 Agent 开始对话
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              从左侧侧边栏选择 Agent 或群组，或点击「新建 Agent」创建
            </p>
          </div>
        </div>
      );
    }

    if (selectedSession.type === 'agent') {
      const agent = agents.find((a) => a.id === selectedSession.agentId);
      if (!agent) {
        return (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Agent 不存在
          </div>
        );
      }
      return <SingleChatPanel agent={agent} />;
    }

    if (selectedSession.type === 'group') {
      const group = groups.find((g) => g.id === selectedSession.groupId);
      if (!group) {
        return (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            群组不存在
          </div>
        );
      }
      return <GroupChatPanel group={group} agents={agents} />;
    }

    return null;
  };

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900">
        {renderMainPanel()}
      </main>
    </div>
  );
}
