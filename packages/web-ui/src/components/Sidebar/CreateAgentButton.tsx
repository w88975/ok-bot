interface CreateAgentButtonProps {
  onClick: () => void;
}

export function CreateAgentButton({ onClick }: CreateAgentButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
    >
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v16m8-8H4"
        />
      </svg>
      <span>新建 Agent</span>
    </button>
  );
}
