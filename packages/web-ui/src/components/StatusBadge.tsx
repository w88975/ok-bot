import type { AgentStatus } from '../types.js';
import { Badge } from './ui/Badge.js';

interface StatusBadgeProps {
  status: AgentStatus;
}

const STATUS_MAP: Record<AgentStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
  running: { label: '运行中', variant: 'success' },
  starting: { label: '启动中', variant: 'warning' },
  stopped: { label: '已停止', variant: 'default' },
  error: { label: '错误', variant: 'error' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, variant } = STATUS_MAP[status] ?? STATUS_MAP.error;
  return <Badge variant={variant}>{label}</Badge>;
}
