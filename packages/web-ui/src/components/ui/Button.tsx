import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500':
              variant === 'primary',
            'bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-gray-400':
              variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500': variant === 'danger',
          },
          {
            'px-2.5 py-1.5 text-sm gap-1.5': size === 'sm',
            'px-4 py-2 text-sm gap-2': size === 'md',
          },
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
