## 为什么

ok-bot 目前仅支持 Telegram 和 HTTP API 两种交互方式，缺少开箱即用的 Web UI，用户必须自行搭建前端才能与 agent 对话。同时，现有接口不支持多 agent 群组会话，无法让用户在同一界面中同时与多个 agent 角色交流。

## 变更内容

- 新增 `WebChannel`（`packages/core/src/channels/web/WebChannel.ts`）：基于 WebSocket 的双向通信 channel adapter，将浏览器消息转为 `InboundMessage` 并将 agent 回复推送到客户端
- 新增 Web UI（`packages/web-ui/`）：基于 React + Vite 的单页应用，提供实时对话界面
- 新增群组会话（Group Chat）：允许用户在一个房间内同时与多个 agent 对话，消息按 `@mention` 或广播路由到对应 agent
- 新增 Web UI 内创建 Agent：在界面中填写表单即可动态创建新 agent，无需手动调用 API
- `@ok-bot/server` 集成 WebChannel：在现有 Hono server 中挂载 WebSocket 升级端点及 Web UI 静态资源服务

## 功能 (Capabilities)

### 新增功能

- `web-channel`: WebSocket channel adapter，连接浏览器客户端与 AgentManager，处理单聊/群组消息路由
- `web-ui`: React + Vite 前端应用，支持多 agent 侧边栏、单聊面板、群组聊天面板、创建 agent 表单
- `group-chat`: 群组会话逻辑，一条消息可同时发送给多个 agent，各 agent 回复异步返回，界面按角色分组展示

### 修改功能

- `http-server`: 集成 WebChannel，挂载 `/ws` WebSocket 升级端点，并在配置中添加 `webUI` 选项以服务前端静态文件

## 影响

- **新增包**：`packages/web-ui/`（React + Vite + TypeScript，pnpm workspace 成员）
- **新增文件**：`packages/core/src/channels/web/WebChannel.ts`
- **修改文件**：`packages/server/src/index.ts`、`packages/server/src/config.ts`、`packages/server/src/app.ts`
- **新增依赖**（core）：无额外依赖，复用 Node.js `node:http` + Hono WebSocket helper
- **新增依赖**（web-ui）：`react`、`react-dom`、`vite`、`@vitejs/plugin-react`、`typescript`、`tailwindcss`、`shadcn/ui`、`zustand`、`react-query`
- **不破坏现有 API**：HTTP REST 接口保持不变，WebChannel 是独立的新 channel
