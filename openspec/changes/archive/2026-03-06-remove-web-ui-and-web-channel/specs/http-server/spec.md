## 修改需求

### 需求:健康检查接口
HTTP server 必须提供健康检查接口，响应中禁止包含 `webChannel` 或 `webUI` 字段。

#### 场景:健康检查
- **当** `GET /health` 请求到达时
- **那么** 必须返回 200 和 `{ status: "ok", agents: <count>, uptime: <seconds>, version: <string> }`，禁止包含 `webChannel` 或 `webUI` 字段

## 移除需求

### 需求:Web UI 静态文件服务
**Reason**: `packages/web-ui` 子包已删除，不再维护 Web UI
**Migration**: 不再提供 `/app/` 静态页面入口，前端需通过 REST API 或 Telegram 交互

### 需求:WebSocket Channel 端点
**Reason**: `WebChannel` 已从 `@ok-bot/core` 移除，WebSocket 功能不再支持
**Migration**: 请使用 REST API（`POST /agents/:id/chat`）或 Telegram Channel 与 agent 交互
