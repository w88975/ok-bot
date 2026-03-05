/**
 * Hono app 工厂
 * 组装所有路由和中间件
 */

import { Hono } from 'hono';
import { AgentManager, AgentNotFoundError } from '@ok-bot/core';
import { agentsRouter } from './routes/agents.js';
import { chatRouter } from './routes/chat.js';
import { sessionsRouter } from './routes/sessions.js';
import { cronRouter } from './routes/cron.js';

/**
 * 创建 Hono app 实例
 * @param manager AgentManager 实例（由调用方创建和管理）
 */
export function createApp(manager: AgentManager): Hono {
  const app = new Hono();

  // 健康检查
  app.get('/health', (c) => {
    const agents = manager.listAgents();
    return c.json({ status: 'ok', agents: agents.length, uptime: process.uptime() });
  });

  // 路由挂载
  app.route('/agents', agentsRouter(manager));
  app.route('/agents', chatRouter(manager));
  app.route('/agents', sessionsRouter(manager));
  app.route('/agents', cronRouter(manager));

  // 统一错误处理
  app.onError((err, c) => {
    if (err instanceof AgentNotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    console.error('[Server] 未处理的错误：', err);
    return c.json({ error: '服务器内部错误' }, 500);
  });

  // 404 处理
  app.notFound((c) => c.json({ error: `路由不存在：${c.req.path}` }, 404));

  return app;
}
