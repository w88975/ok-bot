/**
 * ok-bot server 入口
 * 启动 Hono HTTP server，绑定到 AgentManager
 */

import { serve } from '@hono/node-server';
import { AgentManager } from '@ok-bot/core';
import { createApp } from './app.js';

const PORT = Number(process.env['PORT'] ?? 3000);

const manager = new AgentManager();
const app = createApp(manager);

serve(
  { fetch: app.fetch, port: PORT },
  (info) => {
    console.info(`[ok-bot server] 已启动，监听端口 ${info.port}`);
    console.info(`  健康检查：http://localhost:${info.port}/health`);
    console.info(`  API 文档：http://localhost:${info.port}/docs（需另行部署）`);
  },
);

// 优雅关闭
const shutdown = async () => {
  console.info('[ok-bot server] 正在关闭...');
  await manager.shutdown();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
