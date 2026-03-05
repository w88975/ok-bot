/**
 * ok-bot server 入口
 *
 * 启动流程：
 * 1. 加载配置（ok-bot.config.json 或 OK_BOT_CONFIG 环境变量）
 * 2. 创建 AgentManager
 * 3. 预创建配置中定义的所有 agent
 * 4. 启动 Hono HTTP server
 * 5. 注册 SIGINT/SIGTERM 优雅关闭
 *
 * 使用方式：
 *   node dist/index.js                              # 使用当前目录的 ok-bot.config.json
 *   OK_BOT_CONFIG=/path/to/config.json node dist/index.js
 */

import { serve } from '@hono/node-server';
import { AgentManager } from '@ok-bot/core';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

async function main() {
  const config = loadConfig();

  // 创建 AgentManager
  const manager = new AgentManager(config.managerOptions ?? {});

  // 预创建配置中定义的所有 agent
  const presets = config.agents ?? [];
  if (presets.length > 0) {
    console.info(`[Server] 正在创建 ${presets.length} 个预配置 agent...`);
    const results = await Promise.allSettled(
      presets.map((preset) =>
        manager.createAgent(preset).then((info) => {
          console.info(`[Server] ✅ Agent "${info.id}" 已启动（${preset.workspace}）`);
          return info;
        }),
      ),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      for (const f of failed) {
        console.error(`[Server] ❌ Agent 启动失败：`, (f as PromiseRejectedResult).reason);
      }
    }
  }

  // 创建 Hono app
  const app = createApp(manager, config);

  // 启动 HTTP server
  const port = config.port ?? 3000;
  const hostname = config.hostname ?? '0.0.0.0';

  serve({ fetch: app.fetch, port, hostname }, (info) => {
    const base = `http://${info.address === '0.0.0.0' ? 'localhost' : info.address}:${info.port}`;
    console.info('');
    console.info('┌────────────────────────────────────────┐');
    console.info('│           ok-bot server 已启动          │');
    console.info('├────────────────────────────────────────┤');
    console.info(`│  地址：${base.padEnd(31)}│`);
    console.info(`│  健康：${(base + '/health').padEnd(31)}│`);
    if (config.authToken) {
      console.info('│  认证：Bearer Token 已启用              │');
    }
    if (presets.length > 0) {
      console.info(`│  Agent：${String(presets.length + ' 个已就绪').padEnd(30)}│`);
    }
    console.info('└────────────────────────────────────────┘');
    console.info('');
    console.info('  API 示例：');
    console.info(`  GET  ${base}/health`);
    console.info(`  GET  ${base}/agents`);
    console.info(`  POST ${base}/agents`);
    console.info(`  POST ${base}/agents/:id/chat`);
    console.info('');
  });

  // 优雅关闭
  const shutdown = async (signal: string) => {
    console.info(`\n[Server] 收到 ${signal}，正在关闭...`);
    await manager.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[Server] 启动失败：', err);
  process.exit(1);
});
