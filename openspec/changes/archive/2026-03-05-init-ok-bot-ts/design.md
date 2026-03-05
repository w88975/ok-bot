## 上下文

ok-bot 是对 Python 版 nanobot 的 TypeScript 重新实现。nanobot 的核心价值在于其精心设计的 agent 架构：分层 system prompt 构建、两层记忆系统、heartbeat/cron 机制、subagent 模式。ok-bot 在继承这些设计的基础上，新增多 agent 并行支持（Worker Thread 隔离），并通过 Vercel AI SDK 统一 LLM provider 接入。项目采用 pnpm monorepo 结构，同时作为可发布 npm package 和独立 HTTP server 交付。

**约束：**
- 代码注释全部使用中文
- 不依赖 Python 生态，使用 Node.js 原生能力
- Skills 系统与 nanobot 保持兼容（SKILL.md 格式、XML 摘要）
- Vercel AI SDK 的 `CoreMessage` 格式替代 OpenAI raw format

## 目标 / 非目标

**目标：**
- 完整实现 nanobot 核心能力（agent loop、subagent、heartbeat、cron、memory、skills）
- 支持多 agent 并行（每个 agent 独立 Worker Thread + workspace）
- 通过 Vercel AI SDK 支持 OpenAI、Anthropic、Google、Groq、DeepSeek 等主流 provider
- 提供 Hono HTTP API + Telegram channel（polling）
- `@ok-bot/core` 可作为 npm package 独立发布给外部系统集成
- 完整的 TypeDoc API 文档 + Docusaurus 文档站
- Vitest 测试体系，含 MockLanguageModelV1 LLM 行为测试

**非目标：**
- 不实现 Telegram 以外的 channel（Slack、Discord、WhatsApp 等后续扩展）
- 不实现 DatabaseBootstrapLoader / HttpBootstrapLoader（当前只支持文件）
- 不支持流式（streaming）响应（当前用 `generateText`，非 `streamText`）
- 不做跨 agent 共享记忆

## 决策

### D1: 多 Agent 隔离 — Worker Threads

**选择**：每个 AgentInstance 运行在独立的 `worker_threads.Worker` 中，通过 `MessageChannel` 双向通信。

**理由**：
- 一个 agent 崩溃不影响其他 agent 和主进程
- Node.js Worker Thread 共享内存地址空间但 JS 执行独立，比进程轻量
- `MessageChannel` 是 Node.js 原生 API，序列化成本低

**替代方案**：
- 同一线程内多实例 → 一个崩溃影响全局，无法隔离
- `child_process.fork` → 更重，序列化成本高

**通信协议**：

```
主线程 AgentManager
  └── worker.postMessage({ type: 'message', payload: InboundMessageDTO })
  └── worker.on('message', { type: 'response' | 'error', payload: OutboundMessageDTO })

Worker 内 AgentWorker
  └── parentPort.postMessage({ type: 'response', payload: OutboundMessageDTO })
  └── parentPort.on('message', ...)
```

---

### D2: LLM Provider — Vercel AI SDK `generateText`

**选择**：统一使用 Vercel AI SDK 的 `generateText`，tools 用 `tool()` helper 定义。

**理由**：
- 原生支持 OpenAI、Anthropic、Google、Groq、Mistral、DeepSeek 等，无需手写各家适配
- `CoreMessage` 格式统一，不需要处理各家 message 格式差异
- `MockLanguageModelV1` 原生支持，测试友好

**替代方案**：
- 像 nanobot 一样自定义 `LLMProvider` 抽象层 → 维护成本高，重复造轮子
- 直接用 OpenAI SDK → 无法统一多 provider

**关键设计**：`VercelAIProvider` 类封装 `generateText`，将 `ToolRegistry` 的工具定义转为 Vercel AI SDK 的 `tools` 参数格式（zod schema）。

---

### D3: ContextBuilder — System Prompt 分层组合

完全对标 nanobot 的分层结构，用 `---` 分隔各节：

```
[1] identity()           身份 + runtime（OS、Node 版本）+ workspace 路径 + 使用指南
[2] bootstrapFiles()     AGENTS.md / SOUL.md / USER.md / TOOLS.md
[3] memory()             MEMORY.md 长期记忆
[4] alwaysSkills()       always=true 的 skills 内容（strip frontmatter）
[5] skillsSummary()      所有 skills 的 XML 摘要
```

Runtime context（当前时间、channel、chat_id）以特殊 tag 注入每轮 user message 前，**不持久化到 history**（对标 nanobot 的 `_RUNTIME_CONTEXT_TAG`）。

---

### D4: Skills — SKILL.md 文件系统

**Frontmatter 格式**（YAML + gray-matter 解析）：

```yaml
---
name: cron
description: Schedule reminders and recurring tasks.
ok-bot:
  always: false
  requires:
    bins: []
    env: []
---
```

**查找顺序**：`workspace/skills/{name}/SKILL.md` > `builtin-skills/{name}/SKILL.md`（workspace 优先覆盖内置）

**System prompt 注入**：
- `always=true` 的 skills → 全文内容注入（strip frontmatter）
- 其他 skills → XML 摘要（name、description、location、available），agent 按需用 `read_file` 读取

---

### D5: 记忆系统 — 两层 + LLM Consolidation

对标 nanobot：
- `MEMORY.md`：长期事实，LLM 维护更新
- `HISTORY.md`：追加式日志，每条以 `[YYYY-MM-DD HH:MM]` 开头，grep-searchable
- Consolidation 触发条件：未 consolidate 消息数 >= `memoryWindow`（默认 100）
- Consolidation 机制：LLM tool-call（`save_memory` 虚拟工具），异步后台执行，不阻塞当前请求

**Session 持久化**：JSONL 文件（`workspace/sessions/{sessionKey}.jsonl`），每行一条 message。`SessionManager` 管理读写，支持 `getHistory(maxMessages)` 滑动窗口。

---

### D6: HeartbeatService — 两阶段 LLM 决策

对标 nanobot Phase 1/2 设计：
- **Phase 1（决策）**：读取 HEARTBEAT.md，用 `heartbeat` 虚拟工具（`action: skip|run`）让 LLM 决策，避免文本解析
- **Phase 2（执行）**：仅当 Phase 1 返回 `run` 时，调用 `onExecute` 回调进入完整 agent loop

---

### D7: CronService — Timer 链式调度

与 nanobot 一致：
- 三种 schedule：`at`（一次性）、`every`（间隔）、`cron`（cron 表达式 + IANA 时区，使用 `cron-parser`）
- 持久化：`workspace/cron.json`
- 调度策略：timer 链（执行完当前批次后重新 arm 下一个 timer），而非轮询

---

### D8: HTTP API — Hono + 多 agent 路由

```
GET    /health
GET    /agents                     列出所有 agent
POST   /agents                     创建 agent
DELETE /agents/:agentId            停止并移除 agent

POST   /agents/:agentId/chat       发送消息，返回响应
GET    /agents/:agentId/sessions   列出会话
DELETE /agents/:agentId/sessions/:sessionKey  清空会话

GET    /agents/:agentId/cron       列出定时任务
POST   /agents/:agentId/cron       添加定时任务
DELETE /agents/:agentId/cron/:jobId 删除定时任务
```

---

### D9: Telegram Channel — Long Polling

使用 `grammy` 库（轻量、TS 原生、支持 polling）。
每条 Telegram 消息转为 `InboundMessage` 投递到对应 agent 的 Worker。
回复通过 Worker 的 `OutboundMessage` 回调触发 `ctx.reply()`。

---

### D10: Monorepo 结构

```
ok-bot/
├── packages/
│   ├── core/                    @ok-bot/core
│   │   ├── src/
│   │   │   ├── index.ts         公开 API 入口
│   │   │   ├── agent/           AgentManager, AgentInstance, AgentWorker, AgentLoop, SubagentManager
│   │   │   ├── context/         ContextBuilder, FileBootstrapLoader
│   │   │   ├── skills/          SkillsLoader, types
│   │   │   ├── memory/          MemoryStore, SessionManager
│   │   │   ├── tools/           ToolRegistry + builtin/
│   │   │   ├── mcp/             McpClient
│   │   │   ├── scheduler/       CronService, HeartbeatService
│   │   │   ├── channels/        types, ChannelManager, telegram/
│   │   │   ├── bus/             MessageBus, events
│   │   │   └── providers/       VercelAIProvider
│   │   └── builtin-skills/      内置 SKILL.md 文件
│   │
│   └── server/                  @ok-bot/server (Hono)
│       └── src/
│           ├── app.ts
│           └── routes/
│
├── apps/
│   └── docs/                    Docusaurus + TypeDoc 输出
│
├── templates/                   workspace 初始化模板
│   └── AGENTS.md / SOUL.md / USER.md / TOOLS.md / HEARTBEAT.md / memory/
│
└── tests/
    ├── unit/
    └── integration/
```

## 风险 / 权衡

| 风险 | 缓解措施 |
|------|----------|
| Worker Thread 序列化开销：每条消息需要 JSON 序列化 | 消息体通常很小（text），不含二进制大对象，开销可接受 |
| Vercel AI SDK CoreMessage 格式与 nanobot 不同 | ContextBuilder 从源头用 `CoreMessage` 类型设计，不做二次转换 |
| JSONL session 文件并发写入（同一 session 多轮并发） | AgentLoop 内有 `_processingLock`，同一 session 串行处理 |
| gray-matter 解析性能（每次 prompt 构建都读磁盘） | SkillsLoader 加缓存层，同一进程生命周期内 skills 只读一次 |
| Worker Thread 内 MCP 连接生命周期管理 | Worker 启动时连接，Worker 关闭时断开，通过 `AsyncExitStack` 类似的 `AsyncDisposable` 模式管理 |
| Telegram polling 与 HTTP server 并存的信号处理 | 统一通过 `AgentManager.shutdown()` 有序关闭所有 Worker 和 channel |

## 开放问题

- **Q1**：`@ok-bot/core` 的 `package.json` 是否需要提供 ESM + CJS 双格式输出？（推荐 ESM only，对标现代生态）
- **Q2**：多个 agent 共用同一个 Telegram Bot Token 时，如何路由消息到对应 agent？（推荐按 chat_id prefix 或配置 agent_id → chat_id 映射）
- **Q3**：是否需要 `workspace init` CLI 命令来初始化 workspace 目录和模板文件？
