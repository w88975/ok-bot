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
     │  ├── onToken 未提供 → generateText（非流式）
     │  └── onToken 已提供 → streamText（SSE 流式，逐 token 回调）
     │
     ├── text response → OutboundMessage
     └── tool calls ──┐
                       ▼
               ToolRegistry.execute(tool)
                       │
                       └─ loop again (迭代，继续透传 onToken)
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
  | { type: 'response'; payload: OutboundMessage; requestId?: string }
  | { type: 'error'; error: string; requestId?: string }
```
