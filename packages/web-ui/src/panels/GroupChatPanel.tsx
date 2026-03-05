import type { GroupInfo, AgentInfo, Message } from '../types.js';
import { useChatStore } from '../store/chatStore.js';
import { useWsStore } from '../store/wsStore.js';

/** 稳定的空数组引用，避免 Zustand 无限渲染循环 */
const EMPTY_MESSAGES: Message[] = [];
import { ChatHeader } from '../components/Chat/ChatHeader.js';
import { MessageList } from '../components/Chat/MessageList.js';
import { InputBar } from '../components/Chat/InputBar.js';
import { parseMentions } from '../utils.js';

interface GroupChatPanelProps {
  group: GroupInfo;
  agents: AgentInfo[];
}

export function GroupChatPanel({ group, agents }: GroupChatPanelProps) {
  const sessionKey = `web-group:${group.id}`;

  // 直接访问 Map，用稳定常量兜底，避免每次返回新 [] 导致无限渲染
  const allMessages = useChatStore((s) => s.messages.get(sessionKey) ?? EMPTY_MESSAGES);
  const loading = useChatStore((s) => {
    // 任意成员的 loading 为 true 则整体 loading
    for (const agentId of group.agentIds) {
      if (s.loadingKeys.has(`web-group:${group.id}:${agentId}`)) return true;
    }
    return false;
  });
  const appendMessage = useChatStore((s) => s.appendMessage);
  const setLoading = useChatStore((s) => s.setLoading);
  const send = useWsStore((s) => s.send);

  const handleSend = (content: string) => {
    // 解析 @mention
    const mentions = parseMentions(content);

    // 追加用户消息到群组 session
    appendMessage(sessionKey, { role: 'user', content, groupId: group.id });

    // 设置目标 agent 的 loading 状态
    const targetIds = mentions.length > 0
      ? mentions.filter((id) => group.agentIds.includes(id))
      : group.agentIds;

    for (const agentId of targetIds) {
      setLoading(`web-group:${group.id}:${agentId}`, true);
    }

    send({
      type: 'group-chat',
      groupId: group.id,
      content,
      mentions: mentions.length > 0 ? mentions : undefined,
    });
  };

  const memberCount = group.agentIds.length;
  const placeholder =
    memberCount > 0
      ? `向群组发消息… （@${group.agentIds[0]} 可定向发送）`
      : '向群组发消息…';

  return (
    <div className="flex flex-col h-full">
      <ChatHeader type="group" group={group} agents={agents} />
      <MessageList messages={allMessages} loading={loading} />
      <InputBar placeholder={placeholder} onSend={handleSend} />
    </div>
  );
}
