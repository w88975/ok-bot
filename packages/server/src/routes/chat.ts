/**
 * Chat API 路由
 * POST /agents/:agentId/chat        发送消息并同步等待 agent 回复（JSON）
 * POST /agents/:agentId/chat/stream 发送消息，以 SSE 流式返回 token
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AgentManager } from '@ok-bot/core';

export function chatRouter(manager: AgentManager): Hono {
  const router = new Hono();

  /**
   * 发送消息（非流式）
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

  /**
   * 发送消息（SSE 流式）
   * Body: { content: string, sessionKey?: string, channel?: string, chatId?: string }
   * Response: text/event-stream
   *   - event: token  — LLM 逐 token 输出
   *   - event: done   — 最终完整内容
   *   - event: error  — 错误信息
   */
  router.post('/:agentId/chat/stream', async (c) => {
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

    return streamSSE(c, async (stream) => {
      try {
        const response = await manager.chat({
          agentId,
          content: body.content!,
          sessionKey,
          channel: body.channel ?? 'http',
          chatId: body.chatId ?? sessionKey,
          media: body.media,
          onToken: async (token) => {
            await stream.writeSSE({ event: 'token', data: token });
          },
          onProgress: async (hint) => {
            await stream.writeSSE({ event: 'progress', data: hint });
          },
        });

        // 最终完整内容（含工具调用后的全文）
        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({ content: response.content, sessionKey }),
        });
      } catch (err) {
        await stream.writeSSE({
          event: 'error',
          data: err instanceof Error ? err.message : '未知错误',
        });
      }
    });
  });

  return router;
}
