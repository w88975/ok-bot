/**
 * AgentWorker — 在 Worker Thread 内运行的 agent 实体
 *
 * 每个 AgentInstance 在独立的 Worker Thread 中运行此文件。
 * 通过 parentPort 接收 WorkerInboundMessage，处理后发回 WorkerOutboundMessage。
 * 整合 AgentLoop、CronService、HeartbeatService 的完整生命周期。
 */

import { workerData, parentPort } from 'node:worker_threads';
import { MessageBus } from '../bus/MessageBus.js';
import { AgentLoop } from './AgentLoop.js';
import { VercelAIProvider } from '../providers/VercelAIProvider.js';
import { CronService } from '../scheduler/CronService.js';
import { HeartbeatService } from '../scheduler/HeartbeatService.js';
import { McpClient } from '../mcp/McpClient.js';
import type { AgentConfig, WorkerInboundMessage, WorkerOutboundMessage } from '../types.js';

if (!parentPort) {
  throw new Error('AgentWorker 必须在 Worker Thread 中运行');
}

const config = workerData as AgentConfig;

// 创建消息总线
const bus = new MessageBus();

// 创建 LLM provider
const provider = new VercelAIProvider({
  model: config.provider.model,
  apiKey: config.provider.apiKey,
  baseURL: config.provider.baseURL,
  thinking: config.provider.thinking,
});

// 创建 AgentLoop（从 config 中解构，排除 ProviderConfig，改为传入 ILLMProvider 实例）
const { provider: _providerConfig, ...agentConfigRest } = config;
const agentLoop = new AgentLoop({
  ...agentConfigRest,
  provider,
  bus,
});

// 创建 CronService
const cronService = new CronService(config.workspace, async (job) => {
  const result = await agentLoop.processMessage({
    channel: 'system',
    senderId: 'cron',
    chatId: `${job.payload.channel ?? 'cli'}:${job.payload.to ?? 'direct'}`,
    content: job.payload.message,
  });
  return result?.content ?? null;
});

// 创建 HeartbeatService
const heartbeatService = new HeartbeatService({
  workspace: config.workspace,
  provider,
  model: config.provider.model,
  onExecute: async (tasks) => {
    const result = await agentLoop.processMessage({
      channel: 'system',
      senderId: 'heartbeat',
      chatId: 'cli:direct',
      content: tasks,
    });
    return result?.content ?? '';
  },
  intervalSeconds: config.heartbeatIntervalSeconds,
});

// MCP 客户端（lazy 连接）
const mcpClient = config.mcpServers
  ? new McpClient(config.mcpServers)
  : null;

// 订阅出站消息，转发给主线程
bus.onOutbound(async (msg) => {
  const response: WorkerOutboundMessage = {
    type: 'response',
    payload: msg,
    requestId: (msg.metadata?.['_requestId'] as string) ?? undefined,
  };
  parentPort!.postMessage(response);
});

// 启动服务
cronService.start();
heartbeatService.start();

// 通知主线程 Worker 已就绪
parentPort.postMessage({ type: 'ready' } satisfies WorkerOutboundMessage);

// 监听主线程消息
parentPort.on('message', async (msg: WorkerInboundMessage) => {
  if (msg.type === 'shutdown') {
    // 有序关闭
    cronService.stop();
    heartbeatService.stop();
    if (mcpClient) await mcpClient.close();
    process.exit(0);
  }

  if (msg.type === 'message' && msg.payload) {
    try {
      // Lazy 连接 MCP（首次消息时）
      if (mcpClient) {
        // 通过 AgentLoop 的 tools 注册 MCP 工具（需要暴露接口，暂简化）
        // 实际实现中 AgentLoop 会持有 McpClient 引用
      }

      const inbound = msg.payload;
      if (msg.requestId) {
        // 将 requestId 附加到 metadata，用于响应匹配
        inbound.metadata = { ...inbound.metadata, _requestId: msg.requestId };
      }

      // 若请求携带 requestId，创建 onEvent 回调把结构化事件实时转发给主线程
      const onEvent = msg.requestId
        ? (event: import('./AgentEvent.js').AgentEvent) => {
            parentPort!.postMessage({
              type: 'event',
              event,
              requestId: msg.requestId,
            } satisfies WorkerOutboundMessage);
          }
        : undefined;

      const response = await agentLoop.processMessage(inbound, onEvent);

      if (response) {
        const outMsg: WorkerOutboundMessage = {
          type: 'response',
          payload: response,
          requestId: msg.requestId,
        };
        parentPort!.postMessage(outMsg);
      }
    } catch (error) {
      const errMsg: WorkerOutboundMessage = {
        type: 'error',
        requestId: msg.requestId,
        error: error instanceof Error ? error.message : String(error),
      };
      parentPort!.postMessage(errMsg);
    }
  }
});
