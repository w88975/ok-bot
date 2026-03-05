import { clsx } from 'clsx';
import { agentColor } from '../../utils.js';

interface AvatarProps {
  agentId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ agentId, size = 'md', className }: AvatarProps) {
  const letter = agentId.charAt(0).toUpperCase();
  const color = agentColor(agentId);

  return (
    <div
      className={clsx(
        'flex items-center justify-center rounded-lg font-semibold text-white flex-shrink-0',
        color,
        {
          'w-6 h-6 text-xs': size === 'sm',
          'w-8 h-8 text-sm': size === 'md',
          'w-10 h-10 text-base': size === 'lg',
        },
        className,
      )}
      title={agentId}
    >
      {letter}
    </div>
  );
}
