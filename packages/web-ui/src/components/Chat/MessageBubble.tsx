import { clsx } from 'clsx';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../../types.js';
import { Avatar } from '../ui/Avatar.js';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-indigo-600 text-white text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      {message.agentId && <Avatar agentId={message.agentId} size="sm" />}
      <div className="flex-1 min-w-0">
        {message.agentId && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{message.agentId}</p>
        )}
        <div
          className={clsx(
            'max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm',
            'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100',
            'markdown-content',
          )}
        >
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
