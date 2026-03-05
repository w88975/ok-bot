## 为什么

nanobot 是一个优秀的 Python AI agent 助理，但其单 agent、单 workspace 的设计限制了它在多角色协作场景下的应用。ok-bot 以 TypeScript 重新实现 nanobot 的核心设计精华，基于 Vercel AI SDK 支持主流 LLM provider，并扩展为支持多 agent 并行运行的架构，同时作为可发布的 npm package 和独立 HTTP server 两种形态交付。

## 变更内容

- **新增** pnpm monorepo 结构，包含 `@ok-bot/core`（核心库）和 `@ok-bot/server`（Hono HTTP server）两个 package，以及 Docusaurus 文档站
- **新增** `AgentManager`：主线程管理多个 AgentInstance，每个 agent 运行在独立的 Worker Thread 中，通过 MessageChannel 通信
- **新增** `AgentLoop`：基于 Vercel AI SDK 的核心 agent loop，支持工具调用、最大迭代次数、`/stop` 取消等
- **新增** `SubagentManager`：后台 subagent 机制，通过内部 MessageBus 的 `system` channel 将结果注回主 agent
- **新增** `ContextBuilder`：分层组合 system prompt（identity → bootstrap files → memory → always-skills → skills summary）
- **新增** `SkillsLoader`：读取 `workspace/skills/` + 内置 `builtin-skills/`，支持 frontmatter（always/requires）、XML 摘要、按需加载
- **新增** `MemoryStore`：两层记忆系统（MEMORY.md 长期记忆 + HISTORY.md grep-searchable 日志），LLM tool-call 驱动的 consolidation
- **新增** `SessionManager`：基于 JSONL 文件的对话历史持久化，按 workspace 独立存储
- **新增** `CronService`：支持 at/every/cron 三种模式 + IANA 时区
- **新增** `HeartbeatService`：30 分钟定时检查 HEARTBEAT.md，LLM tool-call 决策 skip/run
- **新增** 内置工具集：文件系统（read/write/edit/list）、Shell exec、Web search/fetch、Message、Spawn
- **新增** MCP client：接入 MCP servers
- **新增** Telegram channel（long polling 模式）
- **新增** Hono HTTP API server：agent CRUD、chat、cron 管理、session 查询
- **新增** TypeDoc + Docusaurus 文档站
- **新增** Vitest 测试体系（unit + integration，含 MockLanguageModelV1 LLM 行为测试）
- **新增** workspace 初始化模板（AGENTS.md / SOUL.md / USER.md / TOOLS.md / HEARTBEAT.md）

## 功能 (Capabilities)

### 新增功能

- `agent-manager`: 多 agent 编排，Worker Thread 隔离，MessageChannel 通信
- `agent-loop`: 核心 agent loop（Vercel AI SDK，工具调用，迭代控制，取消支持）
- `subagent`: 后台子 agent 机制，任务完成后通过 system channel 通知主 agent
- `context-builder`: system prompt 分层构建（identity、bootstrap、memory、skills）
- `bootstrap-loader`: workspace 引导文件加载（AGENTS.md / SOUL.md / USER.md / TOOLS.md）
- `skills-loader`: SKILL.md 文件系统（workspace + builtin，frontmatter，always/requires，XML 摘要）
- `memory-store`: 两层记忆（MEMORY.md + HISTORY.md）+ LLM consolidation
- `session-manager`: JSONL 持久化的对话历史，按 workspace 隔离
- `cron-service`: 定时任务（at/every/cron 表达式 + IANA 时区）
- `heartbeat-service`: 周期性 HEARTBEAT.md 检查，LLM 决策驱动
- `tool-registry`: 工具注册与执行中心（builtin + MCP 动态注册）
- `builtin-tools`: 内置工具集（filesystem、shell、web、message、spawn）
- `mcp-client`: MCP protocol 客户端，动态接入 MCP servers
- `telegram-channel`: Telegram bot（long polling）channel adapter
- `http-server`: Hono HTTP API server（agents/chat/cron/sessions）
- `llm-provider`: Vercel AI SDK 包装，统一多 LLM provider 接口
- `docs`: TypeDoc API 文档 + Docusaurus 文档站

### 修改功能

（无，这是全新项目）

## 影响

- **新建项目** `/Users/kamisama/workspace/ok-bot`（TypeScript monorepo，pnpm workspace）
- **依赖**：`ai`（Vercel AI SDK）、`@ai-sdk/*`（各 provider）、`hono`、`grammy`（Telegram）、`@modelcontextprotocol/sdk`、`node-cron` / `cron-parser`、`gray-matter`（frontmatter 解析）、`zod`、`typedoc`、`vitest`
- **输出产物**：`packages/core`（npm 可发布）、`packages/server`（独立运行）、`apps/docs`（文档站）
- **中文注释**：所有 TypeScript 代码注释使用中文
