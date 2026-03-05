## 新增需求

### 需求:WebChannel 初始化与挂载
WebChannel 必须通过 `attach(app: Hono)` 方法将 WebSocket 端点注册到现有 Hono app，不得启动独立端口。

#### 场景:挂载后 /ws 端点可用
- **当** 调用 `channel.attach(app)` 后客户端请求 `ws://host/ws`
- **那么** 服务器完成 WebSocket 握手，建立双向连接

#### 场景:未挂载时 /ws 不存在
- **当** 未调用 `attach()` 时请求 `/ws`
- **那么** 服务器返回 404

---

### 需求:客户端连接管理
WebChannel 必须为每个 WebSocket 连接分配唯一 `clientId`（UUID），并维护 `Map<clientId, WebSocket>` 连接池。

#### 场景:新连接分配 clientId
- **当** 浏览器建立 WebSocket 连接
- **那么** 服务器分配 clientId 并向客户端发送 `{ type: "connected", clientId }` 消息

#### 场景:连接断开后清理
- **当** WebSocket 连接关闭
- **那么** 从连接池中移除对应 clientId，不影响其他连接

---

### 需求:单聊消息路由
WebChannel 必须将 `{ type: "chat", agentId, content, sessionKey? }` 消息路由到对应 agent，并将回复推送给发起方客户端。

#### 场景:发送单聊消息并收到回复
- **当** 客户端发送 `{ type: "chat", agentId: "x", content: "你好" }`
- **那么** 服务器调用 `manager.chat({ agentId: "x", content: "你好" })`，并将结果以 `{ type: "message", agentId: "x", content: "...", sessionKey }` 推送给该客户端

#### 场景:agentId 不存在时返回错误
- **当** 客户端发送的 agentId 对应的 agent 不存在
- **那么** 服务器推送 `{ type: "error", message: "Agent 不存在" }` 给该客户端

---

### 需求:实时 agent 状态同步
WebChannel 在 agent 列表发生变化时（创建/删除），必须向所有已连接客户端广播最新 agent 列表。

#### 场景:创建 agent 后广播状态
- **当** 通过 WebSocket 创建新 agent 成功
- **那么** 所有连接的客户端收到 `{ type: "agent-status", agents: AgentInfo[] }`

#### 场景:连接建立后立即发送当前状态
- **当** 新客户端完成连接握手
- **那么** 服务器立即推送当前 `{ type: "agent-status", agents: AgentInfo[] }`

---

### 需求:通过 WebSocket 创建 agent
WebChannel 必须处理 `{ type: "create-agent", config, bootstrap? }` 消息，调用 `manager.createAgent()` 并将结果推送给发起方。

#### 场景:成功创建 agent
- **当** 客户端发送合法的 `create-agent` 消息（含必填字段 id、workspace、provider）
- **那么** 服务器创建 agent 并推送 `{ type: "agent-created", agent: AgentInfo }` 及广播 `agent-status`

#### 场景:缺少必填字段时返回错误
- **当** 客户端发送的 `create-agent` 消息缺少 `id` 或 `provider`
- **那么** 服务器推送 `{ type: "error", message: "缺少必填字段" }`，不创建 agent

---

### 需求:Bearer Token 可选鉴权
若 ServerConfig 配置了 `authToken`，WebSocket 握手请求必须携带 `?token=<value>` query param，否则拒绝连接。

#### 场景:未配置 authToken 时任意连接均可
- **当** `authToken` 未配置，客户端建立 WebSocket 连接
- **那么** 连接成功

#### 场景:配置 authToken 后无 token 连接被拒
- **当** `authToken` 已配置，客户端未携带 `?token=` 参数
- **那么** 服务器关闭连接，code 4001
