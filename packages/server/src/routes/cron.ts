/**
 * Cron 管理路由
 * GET    /agents/:agentId/cron          列出定时任务
 * POST   /agents/:agentId/cron          添加定时任务
 * DELETE /agents/:agentId/cron/:jobId   删除定时任务
 */

import { Hono } from 'hono';
import { CronService } from '@ok-bot/core';
import type { AgentManager } from '@ok-bot/core';

function getWorkspace(manager: AgentManager, agentId: string): string | null {
  const agent = manager.listAgents().find((a: { id: string }) => a.id === agentId);
  return (agent as { workspace?: string } | undefined)?.workspace ?? null;
}

export function cronRouter(manager: AgentManager): Hono {
  const router = new Hono();

  /** 列出 agent 的所有定时任务 */
  router.get('/:agentId/cron', (c) => {
    const { agentId } = c.req.param();
    const workspace = getWorkspace(manager, agentId);
    if (!workspace) return c.json({ error: `Agent "${agentId}" 不存在` }, 404);

    // 创建只读 CronService 实例（不启动 timer）
    const cron = new CronService(workspace);
    cron.start();
    const jobs = cron.listJobs();
    cron.stop();
    return c.json({ jobs });
  });

  /** 添加定时任务 */
  router.post('/:agentId/cron', async (c) => {
    const { agentId } = c.req.param();
    const workspace = getWorkspace(manager, agentId);
    if (!workspace) return c.json({ error: `Agent "${agentId}" 不存在` }, 404);

    const body = (await c.req.json()) as Record<string, unknown>;
    const cron = new CronService(workspace);
    cron.start();

    const job = cron.addJob({
      name: String(body['name'] ?? '未命名任务'),
      schedule: body['schedule'] as never,
      message: String(body['message'] ?? ''),
      deliver: Boolean(body['deliver']),
      channel: body['channel'] as string | undefined,
      to: body['to'] as string | undefined,
      deleteAfterRun: Boolean(body['deleteAfterRun']),
    });

    cron.stop();
    return c.json({ job }, 201);
  });

  /** 删除定时任务 */
  router.delete('/:agentId/cron/:jobId', (c) => {
    const { agentId, jobId } = c.req.param();
    const workspace = getWorkspace(manager, agentId);
    if (!workspace) return c.json({ error: `Agent "${agentId}" 不存在` }, 404);

    const cron = new CronService(workspace);
    cron.start();
    const removed = cron.removeJob(jobId);
    cron.stop();

    if (!removed) return c.json({ error: `任务 "${jobId}" 不存在` }, 404);
    return c.body(null, 204);
  });

  return router;
}
