## 1. 删除 web-ui 子包

- [x] 1.1 删除 `packages/web-ui/` 整个目录

## 2. 清理 core 包

- [x] 2.1 删除 `packages/core/src/channels/web/` 整个目录（含 `WebChannel.ts`、`WebChannel.test.ts` 及相关类型文件）
- [x] 2.2 从 `packages/core/src/index.ts` 中移除 `WebChannel` 相关导出

## 3. 清理 server 包 — app.ts

- [x] 3.1 从 `packages/server/src/app.ts` 移除 `WEB_UI_DIST` 常量及 `serveStatic` 导入
- [x] 3.2 从 `packages/server/src/app.ts` 移除 Web UI 静态服务分支（根路径重定向、`/app/*` 路由、503 降级）
- [x] 3.3 从 `packages/server/src/app.ts` 的 `/health` 响应中移除 `webChannel` 和 `webUI` 字段

## 4. 清理 server 包 — index.ts

- [x] 4.1 从 `packages/server/src/index.ts` 移除 `createNodeWebSocket` 导入及调用
- [x] 4.2 从 `packages/server/src/index.ts` 移除 `WebChannel` 导入及实例化逻辑
- [x] 4.3 从 `packages/server/src/index.ts` 的启动日志中移除 WS 和 UI 相关打印

## 5. 清理 server 包 — config.ts

- [x] 5.1 从 `packages/server/src/config.ts` 的 `ServerConfig` 接口中移除 `webChannel` 和 `webUI` 字段及其注释

## 6. 清理依赖与脚本

- [x] 6.1 从 `packages/server/package.json` 移除 `@hono/node-ws` 依赖
- [x] 6.2 从 `packages/server/package.json` 移除 `build:full` 脚本
- [x] 6.3 从根 `package.json` 移除 `build:ui` 和 `dev:ui` 脚本
- [x] 6.4 运行 `pnpm install` 更新 lockfile

## 7. 验证

- [x] 7.1 运行 `pnpm lint`（`tsc --noEmit`）确认无类型错误
- [x] 7.2 运行 `pnpm test` 确认测试全部通过
