import { type TextareaHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        )}
        <textarea
          ref={ref}
          className={clsx(
            'rounded-lg border px-3 py-2 text-sm outline-none transition-colors resize-y min-h-[80px]',
            'border-gray-300 dark:border-gray-600',
            'bg-white dark:bg-gray-800',
            'text-gray-900 dark:text-gray-100',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
