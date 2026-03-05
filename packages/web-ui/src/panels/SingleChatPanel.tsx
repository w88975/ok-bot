import { useState } from 'react';
import type { AgentInfo, Message } from '../types.js';
import { useChatStore } from '../store/chatStore.js';
import { useWsStore } from '../store/wsStore.js';
import { ChatHeader } from '../components/Chat/ChatHeader.js';
import { MessageList } from '../components/Chat/MessageList.js';
import { InputBar } from '../components/Chat/InputBar.js';

/** 稳定的空数组引用，避免每次渲染返回新 [] 导致 Zustand 无限循环 */
const EMPTY_MESSAGES: Message[] = [];

interface SingleChatPanelProps {
  agent: AgentInfo;
}

export function SingleChatPanel({ agent }: SingleChatPanelProps) {
  const [sessionKey, setSessionKey] = useState(`web:${agent.id}`);

  // 直接访问 Map，用稳定常量兜底，避免 getMessages 每次返回新 [] 导致无限渲染
  const messages = useChatStore((s) => s.messages.get(sessionKey) ?? EMPTY_MESSAGES);
  const loading = useChatStore((s) => s.loadingKeys.has(sessionKey));
  const appendMessage = useChatStore((s) => s.appendMessage);
  const setLoading = useChatStore((s) => s.setLoading);
  const clearSession = useChatStore((s) => s.clearSession);
  const send = useWsStore((s) => s.send);

  const handleSend = (content: string) => {
    // 支持 /new 指令重置会话
    if (content.trim() === '/new') {
      const newKey = `web:${agent.id}:${Date.now()}`;
      clearSession(sessionKey);
      setSessionKey(newKey);
      return;
    }

    // 追加用户消息
    appendMessage(sessionKey, { role: 'user', content });
    setLoading(sessionKey, true);

    // 发送到 WebSocket
    send({
      type: 'chat',
      agentId: agent.id,
      content,
      sessionKey,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <ChatHeader type="agent" agent={agent} />
      <MessageList messages={messages} loading={loading} />
      <InputBar
        disabled={loading}
        placeholder={`向 ${agent.id} 发送消息…（/new 开启新会话）`}
        onSend={handleSend}
      />
    </div>
  );
}
