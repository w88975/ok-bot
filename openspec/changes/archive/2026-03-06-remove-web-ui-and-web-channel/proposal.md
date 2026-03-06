## 为什么

ok-bot 是一个以 Telegram / CLI 为主要交互界面的多 agent 框架，Web UI 和 WebSocket channel 是早期探索性功能，目前无人维护且增加了构建和依赖的复杂度。移除这两个特性可以精简项目结构，降低维护成本，同时消除 `@hono/node-ws` 这一仅为 WebSocket 而存在的依赖。

## 变更内容

- **BREAKING** 删除 `packages/web-ui` 整个子包（React + Vite 前端）
- **BREAKING** 移除 `packages/core` 中的 `WebChannel` 及其相关文件（`src/channels/web/`）
- **BREAKING** 移除 `packages/server` 中 Web UI 静态文件服务逻辑（`serveStatic`、`WEB_UI_DIST`）
- **BREAKING** 移除 `packages/server` 中 WebSocket channel 初始化逻辑（`createNodeWebSocket`、`WebChannel.attach`）
- 移除 `packages/server` 对 `@hono/node-ws` 的依赖
- 移除 `ServerConfig` 中的 `webChannel` 和 `webUI` 配置字段
- 移除根 `package.json` 中的 `build:ui` 和 `dev:ui` 脚本
- 移除 `packages/server/package.json` 中的 `build:full` 脚本
- 移除 `packages/core` 的 `index.ts` 中对 `WebChannel` 的导出

## 功能 (Capabilities)

### 新增功能

（无）

### 修改功能

- `http-server`: 移除 webUI 静态服务和 webChannel WebSocket 端点，`/health` 响应不再包含 `webChannel`/`webUI` 字段

## 影响

- `packages/web-ui/` — 整个目录删除
- `packages/core/src/channels/web/` — 整个目录删除（WebChannel.ts、WebChannel.test.ts 及相关类型）
- `packages/core/src/index.ts` — 删除 `WebChannel` 导出
- `packages/server/src/app.ts` — 删除 `serveStatic`、`WEB_UI_DIST`、webUI 分支，简化健康检查响应
- `packages/server/src/index.ts` — 删除 `createNodeWebSocket`、`WebChannel` 相关导入和逻辑
- `packages/server/src/config.ts` — 删除 `webChannel` 和 `webUI` 字段
- `packages/server/package.json` — 删除 `@hono/node-ws` 依赖、`build:full` 脚本
- `package.json`（根）— 删除 `build:ui`、`dev:ui` 脚本
