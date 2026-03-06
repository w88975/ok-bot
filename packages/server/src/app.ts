/**
 * Hono app 工厂
 * 组装所有路由、中间件
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AgentManager, AgentNotFoundError } from '@ok-bot/core';
import { agentsRouter } from './routes/agents.js';
import { chatRouter } from './routes/chat.js';
import { sessionsRouter } from './routes/sessions.js';
import { cronRouter } from './routes/cron.js';
import { requestLogger, bearerAuth } from './middleware.js';
import type { ServerConfig } from './config.js';

/**
 * 创建并配置 Hono app 实例
 *
 * @param manager - AgentManager 实例
 * @param config - 服务器配置
 */
export function createApp(manager: AgentManager, config: ServerConfig = {}): Hono {
  const app = new Hono();

  // CORS（最先执行，确保 preflight 请求也能通过）
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposeHeaders: ['Content-Type'],
    maxAge: 86400,
  }));

  // 请求日志（最先执行）
  app.use('*', requestLogger());

  // Bearer Token 认证（可选）
  if (config.authToken) {
    app.use('*', bearerAuth(config.authToken));
    console.info('[Server] 已启用 Bearer Token 认证');
  }

  // 健康检查
  app.get('/health', (c) => {
    const agents = manager.listAgents();
    return c.json({
      status: 'ok',
      agents: agents.length,
      uptime: Math.floor(process.uptime()),
      version: '0.1.0',
    });
  });

  // API 路由
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
  app.notFound((c) =>
    c.json(
      {
        error: `路由不存在：${c.req.method} ${c.req.path}`,
        hint: 'GET /health 查看服务状态，GET /agents 列出所有 agent',
      },
      404,
    ),
  );

  return app;
}
