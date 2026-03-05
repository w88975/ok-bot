/**
 * Hono app 工厂
 * 组装所有路由、中间件和静态文件服务
 *
 * 注意：WebSocket channel 的初始化必须在外部完成（见 index.ts），
 * 因为 @hono/node-ws 的 createNodeWebSocket 需要传入最终的 app 实例。
 */

import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { AgentManager, AgentNotFoundError } from '@ok-bot/core';
import { agentsRouter } from './routes/agents.js';
import { chatRouter } from './routes/chat.js';
import { sessionsRouter } from './routes/sessions.js';
import { cronRouter } from './routes/cron.js';
import { requestLogger, bearerAuth } from './middleware.js';
import type { ServerConfig } from './config.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * web-ui 构建产物目录
 * import.meta.url 在编译后 = packages/server/dist/app.js
 * new URL('..', ...) = packages/server/
 * ../web-ui/dist = packages/web-ui/dist
 */
const WEB_UI_DIST = path.resolve(
  fileURLToPath(new URL('..', import.meta.url)),
  '../web-ui/dist',
);

/**
 * 创建并配置 Hono app 实例
 *
 * WebSocket channel 不在此处初始化，调用方（index.ts）负责：
 * 1. 调用此函数得到 app
 * 2. 对 app 执行 createNodeWebSocket({ app })
 * 3. 将 upgradeWebSocket 传给 WebChannel.attach(app, upgradeWebSocket)
 * 4. serve(app) 后调用 injectWebSocket(server)
 *
 * @param manager - AgentManager 实例
 * @param config - 服务器配置
 */
export function createApp(manager: AgentManager, config: ServerConfig = {}): Hono {
  const app = new Hono();

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
      webChannel: config.webChannel !== false,
      webUI: config.webUI !== false,
    });
  });

  // API 路由
  app.route('/agents', agentsRouter(manager));
  app.route('/agents', chatRouter(manager));
  app.route('/agents', sessionsRouter(manager));
  app.route('/agents', cronRouter(manager));

  // Web UI 静态文件服务（默认启用）
  const webUIEnabled = config.webUI !== false;
  if (webUIEnabled) {
    if (existsSync(WEB_UI_DIST)) {
      // 根路径重定向到 /app/
      app.get('/', (c) => c.redirect('/app/'));
      // 静态文件服务：/app/* → dist/*
      app.use(
        '/app/*',
        serveStatic({
          root: WEB_UI_DIST,
          rewriteRequestPath: (p) => p.replace(/^\/app/, ''),
        }),
      );
      console.info('[Server] Web UI 已启用：http://localhost/app/');
    } else {
      app.get('/', (c) =>
        c.html(`<h2>Web UI 未构建</h2><p>请先运行 <code>pnpm build:ui</code></p>`, 503),
      );
      app.get('/app/*', (c) =>
        c.json({ error: 'Web UI 未构建，请先运行 pnpm build:ui', dist: WEB_UI_DIST }, 503),
      );
      console.warn(`[Server] Web UI dist 目录不存在（${WEB_UI_DIST}），返回 503 降级提示`);
    }
  }

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
