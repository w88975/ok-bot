/**
 * @packageDocumentation
 * @module @ok-bot/core
 *
 * ok-bot 核心库 — 多 agent AI 助理框架
 *
 * 主要模块：
 * - {@link AgentManager}：多 agent 编排（Worker Thread 隔离）
 * - {@link AgentLoop}：核心 agent 迭代循环
 * - {@link ContextBuilder}：分层 system prompt 构建
 * - {@link SkillsLoader}：SKILL.md 文件加载与管理
 * - {@link MemoryStore}：两层记忆系统
 * - {@link SessionManager}：JSONL 对话历史持久化
 * - {@link CronService}：定时任务调度
 * - {@link HeartbeatService}：周期性任务检查
 * - {@link ToolRegistry}：工具注册与执行中心
 * - {@link VercelAIProvider}：Vercel AI SDK LLM provider
 */

// ─── Agent ────────────────────────────────────────────────────────────────────
export { AgentManager, AgentNotFoundError } from './agent/AgentManager.js';
export { AgentLoop } from './agent/AgentLoop.js';
export { SubagentManager } from './agent/SubagentManager.js';

// ─── Context ──────────────────────────────────────────────────────────────────
export { ContextBuilder, RUNTIME_CONTEXT_TAG } from './context/ContextBuilder.js';
export { FileBootstrapLoader } from './context/FileBootstrapLoader.js';

// ─── Skills ───────────────────────────────────────────────────────────────────
export { SkillsLoader } from './skills/SkillsLoader.js';
export type { SkillMeta, SkillEntry } from './skills/SkillsLoader.js';

// ─── Memory ───────────────────────────────────────────────────────────────────
export { MemoryStore } from './memory/MemoryStore.js';
export { SessionManager, Session } from './memory/SessionManager.js';
export type { StoredMessage } from './memory/SessionManager.js';

// ─── Tools ────────────────────────────────────────────────────────────────────
export { ToolRegistry } from './tools/ToolRegistry.js';
export type { ToolDefinition, ContextAwareTool } from './tools/ToolRegistry.js';
export { createFileSystemTools } from './tools/builtin/FileSystemTools.js';
export { createShellTool } from './tools/builtin/ShellTool.js';
export { createWebSearchTool, createWebFetchTool } from './tools/builtin/WebTools.js';
export { MessageTool } from './tools/builtin/MessageTool.js';
export { SpawnTool } from './tools/builtin/SpawnTool.js';

// ─── MCP ──────────────────────────────────────────────────────────────────────
export { McpClient } from './mcp/McpClient.js';

// ─── Scheduler ────────────────────────────────────────────────────────────────
export { CronService } from './scheduler/CronService.js';
export type { CronJob, CronSchedule, CronPayload, OnJobExecute } from './scheduler/CronService.js';
export { HeartbeatService } from './scheduler/HeartbeatService.js';
export type { HeartbeatServiceConfig } from './scheduler/HeartbeatService.js';

// ─── Channels ─────────────────────────────────────────────────────────────────
export { TelegramChannel, ChannelManager } from './channels/telegram/TelegramChannel.js';
export type { TelegramChannelConfig } from './channels/telegram/TelegramChannel.js';

// ─── Bus ──────────────────────────────────────────────────────────────────────
export { MessageBus } from './bus/MessageBus.js';
export type { InboundMessage, OutboundMessage } from './bus/events.js';
export { getSessionKey } from './bus/events.js';

// ─── Providers ────────────────────────────────────────────────────────────────
export { VercelAIProvider, sanitizeEmptyContent } from './providers/VercelAIProvider.js';
export type { ILLMProvider, LLMResponse, ToolCallRequest, ChatOptions } from './providers/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  AgentConfig,
  AgentInfo,
  AgentStatus,
  ProviderConfig,
  ExecConfig,
  McpServerConfig,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from './types.js';
