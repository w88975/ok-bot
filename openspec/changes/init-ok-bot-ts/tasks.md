## 1. Monorepo 基础搭建

- [x] 1.1 初始化 pnpm workspace（pnpm-workspace.yaml、根 package.json、.gitignore、.npmrc）
- [x] 1.2 创建 `packages/core` 结构（package.json、tsconfig.json、src/index.ts 公开入口）
- [x] 1.3 创建 `packages/server` 结构（package.json、tsconfig.json，依赖 @ok-bot/core）
- [x] 1.4 创建 `apps/docs` Docusaurus 骨架（docusaurus.config.ts、docs/ 目录）
- [x] 1.5 配置根 tsconfig.base.json（strict、ESM、paths 映射）
- [x] 1.6 配置 TypeDoc（typedoc.json，输出到 apps/docs/docs/api/）
- [x] 1.7 配置 Vitest（vitest.config.ts，覆盖 unit + integration 两个目录）
- [x] 1.8 安装所有依赖：`ai`、`@ai-sdk/*`（openai/anthropic/google/groq）、`hono`、`grammy`、`@modelcontextprotocol/sdk`、`cron-parser`、`gray-matter`、`zod`、`vitest`

## 2. 基础类型与 MessageBus

- [x] 2.1 定义 `InboundMessage`、`OutboundMessage` 类型（bus/events.ts）
- [x] 2.2 实现 `MessageBus`（内存队列，publishInbound / consumeInbound / publishOutbound，bus/MessageBus.ts）
- [x] 2.3 定义 `AgentConfig`、`AgentStatus` 等共享类型（types.ts）

## 3. LLM Provider

- [x] 3.1 定义 `LLMResponse`、`ToolCallRequest` 接口（providers/types.ts）
- [x] 3.2 实现 `VercelAIProvider`：封装 `generateText`，支持多 provider model string（如 `openai:gpt-4o`）
- [x] 3.3 实现空 content 清理逻辑（sanitizeEmptyContent），防止 provider 400 报错
- [x] 3.4 为 VercelAIProvider 写 Vitest 单元测试（MockLanguageModelV1 模拟文本响应和工具调用响应）

## 4. ToolRegistry 与内置工具

- [x] 4.1 实现 `ToolRegistry`（注册、get、execute、getDefinitions 导出 Vercel AI SDK tools 格式）
- [x] 4.2 实现 `FileSystemTools`：read_file、write_file、edit_file、list_dir，支持 restrictToWorkspace
- [x] 4.3 实现 `ShellTool`（exec）：超时控制、危险命令黑名单、输出截断（10000 字符）
- [x] 4.4 实现 `WebSearchTool`（Brave Search API）和 `WebFetchTool`（返回 markdown 正文）
- [x] 4.5 实现 `MessageTool`：通过 MessageBus 发布 OutboundMessage，追踪本轮 sentInTurn
- [x] 4.6 实现 `SpawnTool`：调用 SubagentManager.spawn
- [x] 4.7 为内置工具写 Vitest 单元测试（覆盖 workspace 限制、超时、危险命令等边界场景）

## 5. SkillsLoader

- [x] 5.1 实现 `SkillsLoader`：listSkills（workspace + builtin，优先级合并）、loadSkill、stripFrontmatter
- [x] 5.2 实现 frontmatter 解析（gray-matter），提取 ok-bot.always / ok-bot.requires
- [x] 5.3 实现 checkRequirements（bins 检查 PATH、env 检查 process.env）
- [x] 5.4 实现 buildSkillsSummary（XML 格式，含 available 属性）
- [x] 5.5 实现 getAlwaysSkills（过滤 always=true 且可用的 skills）
- [x] 5.6 实现内存缓存（同进程内 skills 只读一次磁盘）
- [x] 5.7 创建内置 skills：`builtin-skills/cron/SKILL.md`、`builtin-skills/memory/SKILL.md`
- [x] 5.8 为 SkillsLoader 写 Vitest 单元测试（frontmatter 解析、覆盖优先级、可用性检查）

## 6. ContextBuilder 与 FileBootstrapLoader

- [x] 6.1 实现 `FileBootstrapLoader`：按序加载 AGENTS.md / SOUL.md / USER.md / TOOLS.md
- [x] 6.2 实现 `ContextBuilder.buildSystemPrompt`：分层组合 identity + bootstrap + memory + always-skills + skills-summary
- [x] 6.3 实现 `ContextBuilder.buildMessages`：组装 system + history + runtime-context + user-message（含 media base64）
- [x] 6.4 实现 runtime context tag 注入（时间、时区、channel、chat_id）
- [x] 6.5 实现 `addToolResult` / `addAssistantMessage` 辅助方法
- [x] 6.6 创建 workspace 初始化模板（templates/ 目录：AGENTS.md、SOUL.md、USER.md、TOOLS.md、HEARTBEAT.md、memory/MEMORY.md）
- [x] 6.7 为 ContextBuilder 写 Vitest 单元测试（system prompt 结构、runtime context 不持久化）

## 7. SessionManager 与 MemoryStore

- [x] 7.1 实现 `SessionManager`：JSONL 持久化（workspace/sessions/{sessionKey}.jsonl）、getOrCreate、save、invalidate
- [x] 7.2 实现 `Session`：messages 数组、lastConsolidated、getHistory(maxMessages)、clear
- [x] 7.3 实现 `MemoryStore`：readLongTerm / writeLongTerm / appendHistory / getMemoryContext
- [x] 7.4 实现 LLM consolidation（save_memory 虚拟工具，异步后台执行，archiveAll 模式）
- [x] 7.5 为 SessionManager 写 Vitest 单元测试（JSONL 读写、滑动窗口、clear）
- [x] 7.6 为 MemoryStore consolidation 写集成测试（MockLanguageModelV1 模拟 save_memory tool call）

## 8. AgentLoop 与 SubagentManager

- [x] 8.1 实现 `AgentLoop._runAgentLoop`：LLM 调用 → 工具执行迭代，maxIterations 保护，onProgress 回调
- [x] 8.2 实现 slash 命令处理（/stop 取消活跃任务、/new 归档并清空、/help）
- [x] 8.3 实现 session history 保存：_saveTurn（tool 结果截断、runtime context 过滤、图片 base64 脱敏）
- [x] 8.4 实现 memory consolidation 触发（unconsolidated >= memoryWindow 时后台异步触发）
- [x] 8.5 实现 `SubagentManager`：spawn（后台 Task）、_runSubagent（受限工具集）、_announceResult（system channel）、cancelBySession
- [x] 8.6 为 AgentLoop 写集成测试（MockLanguageModelV1：正常完成、工具迭代、maxIterations、/stop 取消）
- [x] 8.7 为 SubagentManager 写集成测试（spawn 后台执行、结果回注 MessageBus）

## 9. CronService 与 HeartbeatService

- [x] 9.1 实现 `CronService`：addJob / removeJob / listJobs / enableJob / runJob，cron.json 持久化
- [x] 9.2 实现三种调度类型（at / every / cron 表达式）+ IANA 时区支持（cron-parser + temporal 或 Intl）
- [x] 9.3 实现 timer 链式调度（_armTimer，精准单 timer，不轮询）
- [x] 9.4 实现 `HeartbeatService`：两阶段（_decide LLM tool-call、onExecute 回调），triggerNow
- [x] 9.5 为 CronService 写 Vitest 单元测试（三种调度类型、时区、持久化）
- [x] 9.6 为 HeartbeatService 写测试（MockLanguageModelV1 模拟 skip/run 决策）

## 10. MCP Client

- [x] 10.1 实现 `McpClient`：基于 @modelcontextprotocol/sdk，支持 stdio 和 SSE 传输
- [x] 10.2 实现 lazy 连接（首次消息时连接，失败时下次重试）
- [x] 10.3 实现 MCP 工具动态注册到 ToolRegistry
- [x] 10.4 实现连接生命周期管理（closeMcp，有序断开）

## 11. AgentWorker 与 AgentManager

- [x] 11.1 实现 `AgentWorker`（Worker Thread 内运行）：整合 AgentLoop + CronService + HeartbeatService，监听 parentPort 消息
- [x] 11.2 实现 Worker Thread 通信协议（InboundMessageDTO / OutboundMessageDTO，MessageChannel postMessage）
- [x] 11.3 实现 Worker 优雅关闭（shutdown 信号 → 等待当前任务 → 断开 MCP → 退出）
- [x] 11.4 实现 `AgentManager`：createAgent（spawn Worker）、chat（postMessage + 等待响应）、removeAgent、listAgents、shutdown
- [x] 11.5 为 AgentManager 写集成测试（创建/删除/路由消息到正确 Worker）

## 12. Telegram Channel

- [x] 12.1 实现 `TelegramChannel`（grammy long polling）：文本消息 → InboundMessage 转换
- [x] 12.2 实现图片消息下载，附加到 InboundMessage.media
- [x] 12.3 实现 OutboundMessage → Telegram 回复（超长自动分割）
- [x] 12.4 实现 chat_id → agentId 路由映射配置
- [x] 12.5 实现 ChannelManager：统一管理 channel 生命周期（start / stop）

## 13. HTTP Server（Hono）

- [x] 13.1 创建 Hono app，注册所有路由（agents、chat、sessions、cron、health）
- [x] 13.2 实现 `POST /agents` 和 `GET /agents`、`DELETE /agents/:id`
- [x] 13.3 实现 `POST /agents/:id/chat`（同步等待 agent 响应）
- [x] 13.4 实现 `GET/DELETE /agents/:id/sessions` 和 `/sessions/:sessionKey`
- [x] 13.5 实现 `GET/POST/DELETE /agents/:id/cron`
- [x] 13.6 实现 `GET /health`
- [x] 13.7 实现统一错误处理中间件（AgentNotFoundError → 404，其他 → 500）
- [x] 13.8 为 HTTP routes 写 Vitest 集成测试（Hono test client）

## 14. 文档

- [x] 14.1 为所有公开 API 添加完整 JSDoc 注释（中文描述 + 参数说明）
- [x] 14.2 配置 TypeDoc 输出 markdown 格式到 apps/docs/docs/api/
- [x] 14.3 补充 Docusaurus 手写文档（intro.md、architecture.md、快速开始指南）
- [x] 14.4 配置 Docusaurus 侧边栏，集成 API 参考和指南
- [x] 14.5 验证 `pnpm docs:build` 构建成功，无死链
