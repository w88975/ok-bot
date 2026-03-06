## 上下文

ok-bot 由三个 workspace 子包组成：`core`（业务逻辑）、`server`（Hono HTTP server）、`web-ui`（React + Vite 前端）。当前 `server` 依赖 `@hono/node-ws` 提供 WebSocket channel，依赖 `@hono/node-server/serve-static` 提供 Web UI 静态文件服务，两者均通过 `ServerConfig.webChannel` / `ServerConfig.webUI` 布尔开关控制。`core` 包导出 `WebChannel` 类，它是 WebSocket 协议的核心实现，内含群组聊天、agent 动态创建等功能。

## 目标 / 非目标

**目标：**

- 删除 `packages/web-ui` 子包（含 package.json、所有源码、构建产物目录）
- 删除 `packages/core/src/channels/web/` 目录及相关测试文件
- 从 `packages/core/src/index.ts` 移除 `WebChannel` 导出
- 从 `packages/server/src/app.ts` 移除所有 Web UI 静态服务代码（`serveStatic`、`WEB_UI_DIST`、root redirect、503 降级）
- 从 `packages/server/src/index.ts` 移除 `createNodeWebSocket` 和 `WebChannel` 相关代码
- 从 `packages/server/src/config.ts` 移除 `webChannel` / `webUI` 字段
- 移除 `@hono/node-ws` 依赖（server）
- 清理根和 server 的 npm scripts

**非目标：**

- 不修改 TelegramChannel 或 HTTP REST API
- 不修改 `@hono/node-server`（仍需用于 HTTP server）
- 不重新设计现有 channel 抽象

## 决策

**决策 1：直接硬删除，不保留特性开关**

考虑过保留 `webChannel: false` 默认值作为过渡，但由于没有外部用户依赖此功能，且维护死代码成本更高，选择彻底删除。

**决策 2：`@hono/node-ws` 整包移除**

该依赖仅为 WebSocket 升级而引入。移除 WebChannel 后，`index.ts` 不再调用 `createNodeWebSocket`，因此可以同时移除该 peer dependency。`@hono/node-server` 保留（HTTP server 仍需要）。

**决策 3：`/health` 端点响应简化**

移除 `webChannel` 和 `webUI` 字段，只保留 `status`、`agents`、`uptime`、`version`，避免暴露已不存在的功能状态。

**决策 4：`pnpm-workspace.yaml` 不需要改动**

`packages/web-ui` 删除后，pnpm workspace 会自动忽略不存在的路径；根 `pnpm-workspace.yaml` 通常使用 glob 匹配，无需手动编辑。

## 风险 / 权衡

- [构建脚本残留] 若 CI/CD 脚本引用了 `build:ui` 或 `dev:ui`，删除后会报错 → 本次同步移除 npm scripts，调用方需自行更新
- [测试文件] `WebChannel.test.ts` 随 `channels/web/` 目录一并删除，测试覆盖率会减少 → 可接受，因功能本身被删除
- [健康检查 API 变化] 外部如有监控脚本读取 `/health` 的 `webChannel` 字段，会得到 undefined → BREAKING，已在 proposal 中标注
