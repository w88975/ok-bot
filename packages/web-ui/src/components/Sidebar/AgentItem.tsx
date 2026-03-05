import { clsx } from 'clsx';
import type { AgentInfo } from '../../types.js';
import { Avatar } from '../ui/Avatar.js';
import { StatusBadge } from '../StatusBadge.js';

interface AgentItemProps {
  agent: AgentInfo;
  selected?: boolean;
  onClick: () => void;
}

export function AgentItem({ agent, selected, onClick }: AgentItemProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors',
        selected
          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300',
      )}
    >
      <Avatar agentId={agent.id} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{agent.id}</p>
      </div>
      <StatusBadge status={agent.status} />
    </button>
  );
}
