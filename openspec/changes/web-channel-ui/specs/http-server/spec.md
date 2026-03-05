## 新增需求

### 需求:WebSocket 端点挂载
HTTP server 必须在 `/ws` 路径上提供 WebSocket 升级端点，与现有 REST API 共享同一端口。

#### 场景:WebChannel 挂载到 Hono app
- **当** `ServerConfig.webChannel` 为 `true`（默认）且 `WebChannel` 实例存在
- **那么** `createApp()` 调用 `channel.attach(app)` 注册 `/ws` WebSocket 路由

#### 场景:webChannel 禁用时不暴露 /ws
- **当** `ServerConfig.webChannel` 为 `false`
- **那么** `/ws` 路由不注册，请求该路径返回 404

---

### 需求:Web UI 静态文件服务
HTTP server 可选服务 `packages/web-ui/dist/` 目录下的静态文件，`GET /` 重定向到 Web UI 入口。

#### 场景:webUI 启用时服务静态资源
- **当** `ServerConfig.webUI` 为 `true` 且 web-ui 已构建
- **那么** `GET /app/*` 返回对应静态文件，`GET /` 重定向到 `/app/`

#### 场景:web-ui 未构建时降级
- **当** `ServerConfig.webUI` 为 `true` 但 `dist/` 目录不存在
- **那么** `GET /app/*` 返回 503，提示"Web UI 未构建，请运行 pnpm build:ui"，API 正常工作
