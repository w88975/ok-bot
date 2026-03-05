import { clsx } from 'clsx';
import type { GroupInfo } from '../../types.js';

interface GroupItemProps {
  group: GroupInfo;
  selected?: boolean;
  onClick: () => void;
}

export function GroupItem({ group, selected, onClick }: GroupItemProps) {
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
      {/* 群组图标 */}
      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{group.name}</p>
      </div>
      <span className="text-xs text-gray-400">{group.agentIds.length}人</span>
    </button>
  );
}
