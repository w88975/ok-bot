/**
 * ok-bot server 入口
 *
 * 启动流程：
 * 1. 加载配置
 * 2. 创建 AgentManager
 * 3. 预创建配置中定义的所有 agent
 * 4. 创建 Hono app（HTTP 路由 + Web UI）
 * 5. 对同一个 app 调用 createNodeWebSocket，获取 upgradeWebSocket / injectWebSocket
 * 6. 把 WebChannel 附加到 app（使用同一 upgradeWebSocket）
 * 7. serve(app) 启动 HTTP server
 * 8. injectWebSocket(server) 激活 WebSocket 升级支持
 *
 * 关键约束：createNodeWebSocket({ app }) 和 channel.attach(app, upgradeWebSocket) 必须使用
 * 同一个 Hono app 实例，否则 WebSocket 升级时找不到 /ws 路由。
 */

import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { AgentManager, WebChannel } from '@ok-bot/core';
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
    for (const f of failed) {
      console.error(`[Server] ❌ Agent 启动失败：`, (f as PromiseRejectedResult).reason);
    }
  }

  // 创建 Hono app（HTTP 路由 + Web UI 静态文件）
  const app = createApp(manager, config);

  // WebSocket channel：必须在同一个 app 实例上调用 createNodeWebSocket
  // 这样 injectWebSocket 才能正确拦截升级请求并找到 /ws 路由
  const webChannelEnabled = config.webChannel !== false;
  const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

  if (webChannelEnabled) {
    const channel = new WebChannel({
      manager,
      authToken: config.authToken,
    });
    channel.attach(app, upgradeWebSocket);
    console.info('[Server] WebSocket channel 已启用：ws://localhost/ws');
  }

  // 启动 HTTP server
  const port = config.port ?? 3000;
  const hostname = config.hostname ?? '0.0.0.0';

  const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
    const base = `http://${info.address === '0.0.0.0' ? 'localhost' : info.address}:${info.port}`;
    const wsBase = `ws://${info.address === '0.0.0.0' ? 'localhost' : info.address}:${info.port}`;
    console.info('');
    console.info('┌────────────────────────────────────────┐');
    console.info('│           ok-bot server 已启动          │');
    console.info('├────────────────────────────────────────┤');
    console.info(`│  地址：${base.padEnd(31)}│`);
    console.info(`│  健康：${(base + '/health').padEnd(31)}│`);
    if (webChannelEnabled) {
      console.info(`│  WS：${(wsBase + '/ws').padEnd(33)}│`);
    }
    if (config.webUI !== false) {
      console.info(`│  UI：${(base + '/app/').padEnd(33)}│`);
    }
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
    if (webChannelEnabled) {
      console.info(`  WS   ${wsBase}/ws`);
    }
    console.info('');
  });

  // 激活 WebSocket 升级支持（必须在 serve 之后调用）
  injectWebSocket(server);

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
