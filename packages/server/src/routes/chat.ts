/**
 * Chat API 路由
 * POST /agents/:agentId/chat  发送消息并同步等待 agent 回复
 */

import { Hono } from 'hono';
import type { AgentManager } from '@ok-bot/core';

export function chatRouter(manager: AgentManager): Hono {
  const router = new Hono();

  /**
   * 发送消息
   * Body: { content: string, sessionKey?: string, channel?: string, chatId?: string }
   * Response: { content: string, sessionKey: string }
   */
  router.post('/:agentId/chat', async (c) => {
    const { agentId } = c.req.param();
    const body = await c.req.json().catch(() => null) as {
      content?: string;
      sessionKey?: string;
      channel?: string;
      chatId?: string;
      media?: string[];
    } | null;

    if (!body?.content) {
      return c.json({ error: '缺少必填字段：content' }, 400);
    }

    const sessionKey = body.sessionKey ?? `http:${agentId}`;
    const response = await manager.chat({
      agentId,
      content: body.content,
      sessionKey,
      channel: body.channel ?? 'http',
      chatId: body.chatId ?? sessionKey,
      media: body.media,
    });

    return c.json({ content: response.content, sessionKey });
  });

  return router;
}
