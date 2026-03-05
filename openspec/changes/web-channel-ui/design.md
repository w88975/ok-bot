## 上下文

ok-bot 已具备完整的 AgentManager（Worker Thread 隔离）、HTTP REST API（Hono）、Telegram Channel，但缺少 Web 端交互界面。现有 `TelegramChannel` 架构已验证 channel adapter 模式的可行性：将外部协议消息转为 `InboundMessage` 投递到 `AgentManager`，再将 `OutboundMessage` 回推给客户端。

`WebChannel` 复用相同模式，以 WebSocket 替代 Telegram Bot API，以 React SPA 替代 Telegram 客户端。

## 目标 / 非目标

**目标：**

- 实现 `WebChannel`：基于 WebSocket 的双向 channel adapter，零外部依赖（复用 `@hono/node-server` 的 ws 升级支持）
- 实现 Web UI：React + Vite SPA，支持单聊、群组聊天、创建 agent
- 群组功能：一个 "Group" 房间包含用户 + 多个 agent，用户消息按 `@mention` 路由到指定 agent，或广播到全部 agent
- 在 Web UI 内动态创建 agent（调用 `POST /agents`）
- 与现有 HTTP Server 集成，`/ws` 端点 + 静态文件服务同端口

**非目标：**

- 用户账号系统、多租户、OAuth（当前为单用户本地工具）
- 消息持久化到数据库（复用现有 JSONL session 机制）
- 移动端原生 app
- WebRTC / 语音

## 决策

### D1：WebSocket 传输层 — 使用 `@hono/node-server` ws 升级

**选择**：`@hono/node-server` 内置的 `upgradeWebSocket` + Node.js `ws` 包。

**理由**：已有 Hono server，同端口复用最简单；避免引入独立 WebSocket server 进程。`ws` 是 Node.js 最成熟的 WebSocket 库，零 overhead。

**替代方案**：Socket.io（过重，有 polling fallback 不需要）、独立端口（破坏部署简单性）。

### D2：消息协议 — JSON over WebSocket

客户端 → 服务器：

```ts
// 单聊
{ type: "chat", agentId: string, content: string, sessionKey?: string }

// 群组消息（广播给群内所有 agent）
{ type: "group-chat", groupId: string, content: string, mentions?: string[] }

// 创建 agent
{ type: "create-agent", config: AgentConfig & { bootstrap?: BootstrapContent } }

// 获取 agent 列表
{ type: "list-agents" }

// 创建群组
{ type: "create-group", groupId: string, agentIds: string[] }
```

服务器 → 客户端：

```ts
// agent 回复
{ type: "message", agentId: string, content: string, sessionKey: string, groupId?: string }

// agent 状态变更
{ type: "agent-status", agents: AgentInfo[] }

// 错误
{ type: "error", message: string, requestId?: string }
```

**理由**：结构简单，客户端可用原生 `WebSocket` API，不依赖 socket.io 客户端库。

### D3：群组路由策略 — AgentManager 广播 + 异步并发

群组消息流程：
1. 客户端发 `group-chat`，带可选 `mentions: ["agent-a", "agent-b"]`
2. `WebChannel` 将消息并发发送给群内（或 mention 指定的）所有 agent（`Promise.all`）
3. 每个 agent 的回复独立推送，客户端按角色显示

**理由**：各 agent 运行在独立 Worker Thread，天然支持并发；无需引入消息队列。

### D4：Web UI 架构 — React + Vite + Tailwind + Zustand

| 技术 | 理由 |
|------|------|
| React + Vite | 最成熟的 SPA 组合，热重载，ESM 原生 |
| Tailwind CSS | 零运行时，与 shadcn/ui 原生配合 |
| shadcn/ui | 高质量无样式组件，不绑定 UI 库版本 |
| Zustand | 轻量状态管理（替代 Redux），适合中小型 SPA |
| 原生 WebSocket | 不引入 socket.io 客户端，依赖最小 |

**包结构**：`packages/web-ui/`（pnpm workspace 成员），独立 `package.json`，`vite build` 输出到 `dist/`，由 server 的静态文件中间件服务。

### D5：Web UI 集成到 Server — 静态文件中间件 + 构建步骤

- `packages/server/src/app.ts` 挂载 `GET /app/*` 服务 web-ui 的 `dist/` 目录
- `GET /` 重定向到 `/app/`
- `packages/server/package.json` 的 `build` 脚本加入 `pnpm --filter @ok-bot/web-ui build`
- `ServerConfig` 新增 `webUI?: boolean`（默认 true 时服务静态资源）

### D6：WebChannel 生命周期

- `WebChannel.attach(app: Hono)` 在 Hono app 上注册 `/ws` WebSocket 路由
- 每个 WebSocket 连接对应一个 `clientId`（UUID），`WebChannel` 维护 `Map<clientId, WebSocket>`
- 连接断开时清理 `clientId` 相关状态，不影响 AgentManager 中的 agent

## 风险 / 权衡

- **`@hono/node-server` WebSocket 支持**：需验证 `upgradeWebSocket` API 稳定性。若不稳定，回退方案是在 server 中单独监听 `upgrade` 事件，绕过 Hono 直接处理。
- **群组并发回复顺序**：多 agent 并发回复无法保证顺序，UI 需按到达时间戳排列，前端明确标注角色名。
- **Web UI 构建依赖**：server 的 `start` 命令依赖 web-ui 已构建。未构建时降级：`webUI` 功能不可用但 API 正常。
- **大消息**：agent 回复可能很长，WebSocket 单帧传输无问题（默认限制 ~100MB），但前端需做渲染优化（虚拟列表）。

## 开放问题

- WebSocket 鉴权：当前 HTTP 使用 Bearer Token，WebSocket 握手阶段应通过 `?token=` query param 传递，还是首条消息鉴权？→ 暂定 query param，与 HTTP auth 保持一致
- 群组持久化：群组定义（哪些 agent 在哪个群）是内存态还是写入 workspace？→ 暂定内存态，server 重启后需重建
