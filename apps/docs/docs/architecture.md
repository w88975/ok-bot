---
id: architecture
title: 架构设计
sidebar_position: 3
---

# 架构设计

## 系统整体架构

```
┌─────────────────────────────────────────────────────┐
│                   主线程（Main Thread）                │
│  ┌─────────────────┐   ┌───────────────────────────┐│
│  │   AgentManager   │   │     ChannelManager        ││
│  │  (createAgent,  │   │  TelegramChannel (polling) ││
│  │   chat, list)   │   │  HTTP API (Hono)           ││
│  └────────┬────────┘   └───────────┬───────────────┘│
└───────────│──────────────────────── │────────────────┘
            │ postMessage              │ (chat → manager)
     ┌──────▼──────┐
     │  Worker #1   │
     │  AgentWorker │ ←─ AgentLoop + CronService
     │              │    HeartbeatService + McpClient
     └─────────────┘
     ┌─────────────┐
     │  Worker #2   │
     └─────────────┘
         ...
```

## AgentLoop 迭代流程

```
InboundMessage
     │
     ▼
ContextBuilder.buildMessages()
     │  (system prompt: identity → bootstrap → memory → skills)
     ▼
provider.chat(LLM)
     │  ├── onEvent 未提供 → generateText（非流式）
     │  └── onEvent 已提供 → fullStream（流式，按 chunk 类型 emit AgentEvent）
     │      事件顺序：message_start → think_* / text_delta / tool_* → message_end
     │
     ├── text response → OutboundMessage
     └── tool calls ──┐
                       ▼
               ToolRegistry.execute(tool, context?)
                       │  context.onStdout 可选，用于 Shell 等工具的实时 stdout
                       └─ loop again (迭代，继续透传 onEvent)
```

## 分层 System Prompt

```
[1] Identity Block（AGENTS.md）
[2] Bootstrap Files（SOUL.md, USER.md, TOOLS.md）
[3] MEMORY.md（长期记忆）
[4] Always-on Skills（always: true）
[5] Skills Summary（列出所有可用 SKILL.md 的摘要）
────────────────────────────────
[Runtime] 时间、channel、chat_id 注入（不持久化）
```

## 两层记忆

| 层级 | 文件 | 用途 |
|------|------|------|
| 长期记忆 | `MEMORY.md` | LLM 驱动的结构化事实存储 |
| 历史日志 | `HISTORY.md` | 可 grep 的时间线日志 |
| 会话历史 | `sessions/*.jsonl` | 每个 session 的完整对话记录 |

## 工具系统

```
ToolRegistry
├── FileSystem（read_file, write_file, edit_file, list_dir）
├── Shell（exec）
├── Web（web_search, web_fetch）
├── Message（message，向用户发消息）
├── Spawn（spawn，启动 subagent）
└── MCP 动态工具（${serverName}__${toolName}）
```

## Worker Thread 通信协议

```typescript
// 主线程 → Worker
WorkerInboundMessage:
  | { type: 'message'; payload: InboundMessage; requestId: string }
  | { type: 'shutdown' }

// Worker → 主线程
WorkerOutboundMessage:
  | { type: 'ready' }
  | { type: 'event'; event: AgentEvent; requestId?: string }   // 流式：message_start / text_delta / tool_* / think_* / message_end 等
  | { type: 'response'; payload: OutboundMessage; requestId?: string }
  | { type: 'error'; error: string; requestId?: string }
```

## 结构化事件（AgentEvent）

流式场景下，Core 与 Server 统一使用 `AgentEvent` 联合类型，SSE 的 `event` 名即 `AgentEvent.type`：

| 类型 | 说明 |
|------|------|
| `message_start` / `message_end` | 单次 processMessage 的生命周期 |
| `think_start` / `think_delta` / `think_end` | 深度思考（仅支持 reasoning 的模型） |
| `text_delta` | LLM 文本 token 增量 |
| `tool_start` / `tool_stdout` / `tool_end` | 工具调用及实时 stdout |
| `error` | 错误信息 |
