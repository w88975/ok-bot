/** 工具函数 */

/** 生成随机短 id */
export function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * 根据字符串哈希生成颜色（用于 Agent 头像）
 * 返回 Tailwind bg-* 色类字符串
 */
const AVATAR_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-orange-500',
  'bg-rose-500',
  'bg-pink-500',
  'bg-indigo-500',
];

export function agentColor(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash * 31 + agentId.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** 解析消息中的 @mention（格式：@agentId） */
export function parseMentions(content: string): string[] {
  const matches = content.match(/@(\w[\w-]*)/g) ?? [];
  return matches.map((m) => m.slice(1));
}
