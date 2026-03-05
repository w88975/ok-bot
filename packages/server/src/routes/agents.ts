/**
 * Agent CRUD 路由
 * GET    /agents          列出所有 agent
 * POST   /agents          创建 agent
 * DELETE /agents/:agentId 停止并移除 agent
 */

import { Hono } from 'hono';
import type { AgentManager } from '@ok-bot/core';

export function agentsRouter(manager: AgentManager): Hono {
  const router = new Hono();

  /** 列出所有 agent */
  router.get('/', (c) => {
    return c.json({ agents: manager.listAgents() });
  });

  /** 创建 agent */
  router.post('/', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !body.id || !body.workspace || !body.provider) {
      return c.json({ error: '缺少必填字段：id、workspace、provider' }, 400);
    }

    const info = await manager.createAgent(body);
    return c.json({ agent: info }, 201);
  });

  /** 删除 agent */
  router.delete('/:agentId', async (c) => {
    const { agentId } = c.req.param();
    await manager.removeAgent(agentId);
    return c.body(null, 204);
  });

  return router;
}
