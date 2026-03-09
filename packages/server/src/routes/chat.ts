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
   *
   * SSE event name 直接对应 AgentEvent.type：
   *   - event: message_start    — LLM 开始处理
   *   - event: think_start      — 深度思考开始（仅支持 reasoning 的模型）
   *   - event: think_delta      — 推理内容增量（data: {"type":"think_delta","content":"..."}）
   *   - event: think_end        — 深度思考结束
   *   - event: text_delta       — 文本 token 增量（data: {"type":"text_delta","content":"..."}）
   *   - event: tool_start       — 工具调用开始（data: {"type":"tool_start","callId":"...","name":"...","arguments":{...}}）
   *   - event: tool_stdout      — 工具实时输出（data: {"type":"tool_stdout","callId":"...","data":"..."}）
   *   - event: tool_end         — 工具调用结束（data: {"type":"tool_end","callId":"...","result":"..."}）
   *   - event: message_end      — LLM 处理完毕（data: {"type":"message_end","content":"..."}）
   *   - event: error            — 错误（data: {"type":"error","message":"..."}）
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
        await manager.chat({
          agentId,
          content: body.content!,
          sessionKey,
          channel: body.channel ?? 'http',
          chatId: body.chatId ?? sessionKey,
          media: body.media,
          onEvent: async (event) => {
            await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
          },
        });
      } catch (err) {
        // 兜底：AgentLoop 遇到异常时已通过 onEvent 发送 error 事件
        // 此处捕获的是 AgentLoop 之外的意外错误（如网络、序列化等）
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : '未知错误' }),
        });
      }
    });
  });

  return router;
}
