import { type KeyboardEvent, useRef, useState } from 'react';

interface InputBarProps {
  disabled?: boolean;
  placeholder?: string;
  onSend: (content: string) => void;
}

export function InputBar({ disabled, placeholder = '输入消息…', onSend }: InputBarProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    // 重置高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 发送（Shift+Enter 换行）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    // 自适应高度（最大 8 行）
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  return (
    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="flex items-end gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none leading-5"
          style={{ maxHeight: '200px' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          aria-label="发送"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 px-1">
        Enter 发送 · Shift+Enter 换行
      </p>
    </div>
  );
}
