import { type HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        {
          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300': variant === 'default',
          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400':
            variant === 'success',
          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400':
            variant === 'warning',
          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400': variant === 'error',
          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400': variant === 'info',
        },
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
