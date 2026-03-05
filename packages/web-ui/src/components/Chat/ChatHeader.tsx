import type { AgentInfo, GroupInfo } from '../../types.js';
import { Avatar } from '../ui/Avatar.js';
import { StatusBadge } from '../StatusBadge.js';

interface SingleChatHeaderProps {
  type: 'agent';
  agent: AgentInfo;
}

interface GroupChatHeaderProps {
  type: 'group';
  group: GroupInfo;
  agents: AgentInfo[];
}

type ChatHeaderProps = SingleChatHeaderProps | GroupChatHeaderProps;

export function ChatHeader(props: ChatHeaderProps) {
  if (props.type === 'agent') {
    const { agent } = props;
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <Avatar agentId={agent.id} size="md" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{agent.id}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{agent.workspace}</p>
        </div>
        <StatusBadge status={agent.status} />
      </div>
    );
  }

  const { group, agents } = props;
  const members = agents.filter((a) => group.agentIds.includes(a.id));

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.name}</h2>
        <div className="flex items-center gap-1 mt-0.5">
          {members.slice(0, 5).map((agent) => (
            <Avatar key={agent.id} agentId={agent.id} size="sm" />
          ))}
          {members.length > 5 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">+{members.length - 5}</span>
          )}
        </div>
      </div>
      <span className="text-xs text-gray-400 dark:text-gray-500">{group.agentIds.length} 成员</span>
    </div>
  );
}
