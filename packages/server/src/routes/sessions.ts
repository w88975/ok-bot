/**
 * Session 管理路由
 * GET    /agents/:agentId/sessions                     列出所有会话
 * DELETE /agents/:agentId/sessions/:sessionKey         清空指定会话
 */

import { Hono } from 'hono';
import { SessionManager } from '@ok-bot/core';
import type { AgentManager } from '@ok-bot/core';

/** 从 AgentManager 获取 agent workspace（通过 listAgents） */
function getWorkspace(manager: AgentManager, agentId: string): string | null {
  const agent = manager.listAgents().find((a: { id: string }) => a.id === agentId);
  return (agent as { workspace?: string } | undefined)?.workspace ?? null;
}

export function sessionsRouter(manager: AgentManager): Hono {
  const router = new Hono();

  /** 列出 agent 的所有会话 */
  router.get('/:agentId/sessions', (c) => {
    const { agentId } = c.req.param();
    const workspace = getWorkspace(manager, agentId);
    if (!workspace) {
      return c.json({ error: `Agent "${agentId}" 不存在` }, 404);
    }

    const sm = new SessionManager(workspace);
    const sessions = sm.listSessions();
    return c.json({ sessions });
  });

  /** 清空指定会话 */
  router.delete('/:agentId/sessions/:sessionKey', (c) => {
    const { agentId, sessionKey } = c.req.param();
    const workspace = getWorkspace(manager, agentId);
    if (!workspace) {
      return c.json({ error: `Agent "${agentId}" 不存在` }, 404);
    }

    const sm = new SessionManager(workspace);
    const session = sm.getOrCreate(decodeURIComponent(sessionKey));
    session.clear();
    sm.save(session);
    return c.body(null, 204);
  });

  return router;
}
