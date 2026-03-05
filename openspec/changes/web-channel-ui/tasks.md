## 1. Web UI 包搭建（packages/web-ui）

- [ ] 1.1 创建 `packages/web-ui/package.json`（name: `@ok-bot/web-ui`，type: module，vite + react + ts）
- [ ] 1.2 创建 `packages/web-ui/tsconfig.json`（继承根配置，JSX react-jsx）
- [ ] 1.3 创建 `packages/web-ui/vite.config.ts`（dev server proxy `/ws` 和 `/agents` 到 localhost:3000，build 输出到 `dist/`）
- [ ] 1.4 安装依赖：`react`、`react-dom`、`@types/react`、`@types/react-dom`、`vite`、`@vitejs/plugin-react`、`tailwindcss`、`@tailwindcss/vite`、`zustand`、`clsx`
- [ ] 1.5 配置 Tailwind CSS（`tailwind.config.ts`，扫描 `src/**`）
- [ ] 1.6 创建 `packages/web-ui/index.html` 入口（挂载 `#root`）
- [ ] 1.7 创建 `packages/web-ui/src/main.tsx`（ReactDOM.createRoot 挂载 App）
- [ ] 1.8 将 `@ok-bot/web-ui` 加入 `pnpm-workspace.yaml` 的 packages 列表

## 2. WebSocket 状态管理（Zustand Store）

- [ ] 2.1 创建 `src/store/wsStore.ts`：WebSocket 连接管理（`connect`、`disconnect`、`send`），连接状态（`connected`/`connecting`/`disconnected`）
- [ ] 2.2 创建 `src/store/agentStore.ts`：agent 列表（`AgentInfo[]`）、当前选中 agent、群组列表（`GroupInfo[]`）
- [ ] 2.3 创建 `src/store/chatStore.ts`：按 `sessionKey` 分组的消息列表（`Map<string, Message[]>`），loading 状态
- [ ] 2.4 在 `wsStore` 中实现消息分发：收到 `agent-status` → 更新 agentStore，收到 `message` → 追加到 chatStore，收到 `error` → 全局提示
- [ ] 2.5 实现断线自动重连：每 3 秒重连一次，最多 5 次后停止

## 3. 基础 UI 组件

- [ ] 3.1 创建 `src/components/ui/Button.tsx`、`Input.tsx`、`Textarea.tsx`、`Badge.tsx`（Tailwind 原子组件）
- [ ] 3.2 创建 `src/components/ui/Modal.tsx`（Portal + 遮罩层，用于创建 agent/群组表单）
- [ ] 3.3 创建 `src/components/ui/Avatar.tsx`（根据 agentId 哈希颜色块 + 首字母）
- [ ] 3.4 创建 `src/components/StatusBadge.tsx`（agent 状态徽标：running=绿、starting=黄、error=红）
- [ ] 3.5 创建 `src/components/ConnectionStatus.tsx`（顶栏 WebSocket 连接状态指示器）

## 4. 侧边栏组件

- [ ] 4.1 创建 `src/components/Sidebar/AgentItem.tsx`（单个 agent 条目：头像色块、名称、状态徽标）
- [ ] 4.2 创建 `src/components/Sidebar/GroupItem.tsx`（群组条目：群组名、成员数量、活跃状态）
- [ ] 4.3 创建 `src/components/Sidebar/CreateAgentButton.tsx`（触发创建 agent modal 的按钮）
- [ ] 4.4 创建 `src/components/Sidebar/CreateGroupButton.tsx`（触发创建群组 modal 的按钮）
- [ ] 4.5 创建 `src/components/Sidebar/index.tsx`（整合：连接状态 + agent 列表 + 群组列表 + 两个创建按钮）

## 5. 聊天消息组件

- [ ] 5.1 创建 `src/components/Chat/MessageBubble.tsx`（消息气泡：用户/agent 区分，支持 Markdown 渲染）
- [ ] 5.2 创建 `src/components/Chat/MessageList.tsx`（消息列表，新消息到达时自动滚动到底部）
- [ ] 5.3 创建 `src/components/Chat/TypingIndicator.tsx`（loading 状态：三点动画）
- [ ] 5.4 创建 `src/components/Chat/InputBar.tsx`（文本输入框：Enter 发送，Shift+Enter 换行，发送中禁用）
- [ ] 5.5 创建 `src/components/Chat/ChatHeader.tsx`（聊天头部：agent 名称/群组名 + 成员列表）

## 6. 单聊面板

- [ ] 6.1 创建 `src/panels/SingleChatPanel.tsx`：展示与单个 agent 的对话历史
- [ ] 6.2 实现发送逻辑：通过 wsStore 发送 `{ type: "chat", agentId, content, sessionKey }`
- [ ] 6.3 实现 sessionKey 管理：默认 `web:{agentId}`，支持 `/new` 指令重置

## 7. 群组聊天面板

- [ ] 7.1 创建 `src/panels/GroupChatPanel.tsx`：展示群组消息流（多 agent 回复按到达顺序排列）
- [ ] 7.2 实现群组消息发送：解析 `@mention`（正则 `/@(\w[\w-]*)/g`），有 mention 时只发给对应 agent
- [ ] 7.3 实现广播发送：无 mention 时并发发给全部 agent（wsStore 发 `group-chat` 消息）
- [ ] 7.4 群组消息展示：每条回复显示 agent 头像色块 + 名称前缀

## 8. 创建 Agent 表单

- [ ] 8.1 创建 `src/forms/CreateAgentForm.tsx`：必填项（id、workspace、provider.model）+ 可选项（apiKey、baseURL、温度、maxIterations）
- [ ] 8.2 添加 Bootstrap 折叠面板：4 个 Textarea（AGENTS.md/SOUL.md/USER.md/TOOLS.md 内容）
- [ ] 8.3 表单验证：id/workspace/model 非空校验，id 唯一性（对比 agentStore 当前列表）
- [ ] 8.4 提交时通过 wsStore 发送 `create-agent` 消息，等待 `agent-created` 或 `error` 响应后关闭/显示错误

## 9. 创建群组表单

- [ ] 9.1 创建 `src/forms/CreateGroupForm.tsx`：群组名输入 + 多选 agent 列表（Checkbox）
- [ ] 9.2 校验：至少选择 2 个 agent；群组名非空
- [ ] 9.3 提交时发送 `{ type: "create-group", groupId, agentIds }`，等待 `group-created` 响应

## 10. App 根组件与路由

- [ ] 10.1 创建 `src/App.tsx`：三列布局（侧边栏 + 主面板），根据 agentStore 当前选中渲染 SingleChatPanel 或 GroupChatPanel
- [ ] 10.2 实现欢迎空状态：未选中 agent 时显示"选择一个 agent 开始对话"提示
- [ ] 10.3 在 App 挂载时调用 `wsStore.connect()`，卸载时 `disconnect()`
- [ ] 10.4 暗色模式：监听 `prefers-color-scheme`，在 `<html>` 上切换 `.dark` class

## 11. WebChannel 实现（packages/core）

- [ ] 11.1 创建 `packages/core/src/channels/web/types.ts`：定义所有 WebSocket 消息类型（`ClientMessage`、`ServerMessage` 联合类型，含 chat/group-chat/create-agent/list-agents/create-group/update-group）
- [ ] 11.2 创建 `packages/core/src/channels/web/WebChannel.ts`：`attach(app: Hono)` 方法，注册 `/ws` WebSocket 路由
- [ ] 11.3 实现连接管理：`Map<clientId, WebSocket>`，连接时发 `connected` + `agent-status`，断开时清理
- [ ] 11.4 实现 `chat` 消息处理：调用 `manager.chat()`，回复推给发起方客户端
- [ ] 11.5 实现 `create-agent` 消息处理：调用 `manager.createAgent()`，写 bootstrap 文件，广播 `agent-status`
- [ ] 11.6 实现 `list-agents` 消息处理：推送当前 `agent-status` 给请求方
- [ ] 11.7 实现 `create-group` / `update-group` 消息处理：维护内存 `Map<groupId, GroupInfo>`
- [ ] 11.8 实现 `group-chat` 消息处理：解析 mentions，并发 `manager.chat()`，各回复独立推送
- [ ] 11.9 实现 Bearer Token 鉴权：握手时检查 `?token=` query param
- [ ] 11.10 在 `packages/core/src/index.ts` 中导出 `WebChannel`、`WebChannelConfig`

## 12. Server 集成

- [ ] 12.1 在 `packages/server/src/config.ts` 中的 `ServerConfig` 添加 `webChannel?: boolean`（默认 true）、`webUI?: boolean`（默认 true）字段
- [ ] 12.2 在 `packages/server/src/app.ts` 中：若 `config.webChannel` 为 true，创建 `WebChannel` 实例并调用 `attach(app)`
- [ ] 12.3 在 `packages/server/src/app.ts` 中：若 `config.webUI` 为 true，添加静态文件服务中间件（`serveStatic`），`GET /` 重定向到 `/app/`
- [ ] 12.4 处理 web-ui 未构建时的降级：dist 目录不存在时返回 503 提示
- [ ] 12.5 更新 `packages/server/package.json` 的 `build` 脚本，先构建 web-ui 再构建 server

## 13. 安装依赖

- [ ] 13.1 在 core 包安装 WebSocket 支持所需依赖（`@hono/node-server` 已有，验证 ws 升级支持；需要时安装 `ws` + `@types/ws`）
- [ ] 13.2 在 server 包安装静态文件中间件：`@hono/node-server` 内置 `serveStatic`，确认版本支持
- [ ] 13.3 运行 `pnpm install` 安装所有新依赖

## 14. 测试

- [ ] 14.1 WebChannel 单元测试：mock AgentManager，测试 `chat` 消息路由、`create-agent` 消息处理、鉴权拒绝
- [ ] 14.2 GroupChat 逻辑测试：测试广播、mention 路由、成员变更
- [ ] 14.3 前端 Store 测试（Vitest）：测试 wsStore 消息分发到 agentStore/chatStore
- [ ] 14.4 端到端冒烟测试：启动 server，使用 `ws` npm 包验证 WebSocket 握手和消息往返

## 15. 文档

- [ ] 15.1 更新 `apps/docs/docs/server.md`：添加 WebSocket API 协议说明和 Web UI 使用指南
- [ ] 15.2 更新 `apps/docs/docs/quickstart.md`：添加 Web UI 快速开始步骤（`pnpm build:ui` + 访问 `http://localhost:3000/app/`）
- [ ] 15.3 更新 `packages/server/ok-bot.config.example.json`：添加 `webChannel` 和 `webUI` 字段示例
