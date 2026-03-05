import { clsx } from 'clsx';
import { useWsStore } from '../store/wsStore.js';
import type { ConnectionStatus } from '../types.js';

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string }> = {
  connected: { label: '已连接', color: 'bg-emerald-400' },
  connecting: { label: '连接中…', color: 'bg-amber-400 animate-pulse' },
  disconnected: { label: '已断开', color: 'bg-gray-400' },
};

export function ConnectionStatus() {
  const status = useWsStore((s) => s.status);
  const connect = useWsStore((s) => s.connect);
  const { label, color } = STATUS_CONFIG[status];

  return (
    <button
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      onClick={() => {
        if (status === 'disconnected') connect();
      }}
      title={status === 'disconnected' ? '点击重连' : label}
    >
      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', color)} />
      <span>{label}</span>
    </button>
  );
}
