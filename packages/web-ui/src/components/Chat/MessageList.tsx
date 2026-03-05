import { useEffect, useRef } from 'react';
import type { Message } from '../../types.js';
import { MessageBubble } from './MessageBubble.js';
import { TypingIndicator } from './TypingIndicator.js';

interface MessageListProps {
  messages: Message[];
  loading?: boolean;
}

export function MessageList({ messages, loading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 新消息到达时自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        暂无消息，开始对话吧
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {loading && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
