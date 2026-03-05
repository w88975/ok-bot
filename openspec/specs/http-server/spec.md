## 新增需求

### 需求:Agent CRUD API
HTTP server 必须提供 agent 的创建、查询、删除接口。

#### 场景:创建 agent
- **当** `POST /agents` 请求含 `{ id, workspace, config }` 时
- **那么** 必须调用 AgentManager.createAgent，返回 201 和 agent 信息

#### 场景:列出所有 agent
- **当** `GET /agents` 请求到达时
- **那么** 必须返回 200 和所有 agent 的状态列表

#### 场景:删除 agent
- **当** `DELETE /agents/:agentId` 请求到达时
- **那么** 必须停止并移除 agent，返回 204

### 需求:Chat API
HTTP server 必须提供向指定 agent 发送消息的接口，同步返回 agent 回复。

#### 场景:发送消息
- **当** `POST /agents/:agentId/chat` 请求含 `{ content, sessionKey?, media? }` 时
- **那么** 必须等待 agent 处理完毕，返回 200 和 `{ content, sessionKey }` 响应

#### 场景:agent 不存在
- **当** 请求中的 agentId 不存在时
- **那么** 必须返回 404 和错误信息

### 需求:Session 管理 API
HTTP server 必须提供查询和清空会话的接口。

#### 场景:列出 agent 的所有会话
- **当** `GET /agents/:agentId/sessions` 请求到达时
- **那么** 必须返回该 agent 下所有 sessionKey 及消息数量

#### 场景:清空指定会话
- **当** `DELETE /agents/:agentId/sessions/:sessionKey` 请求到达时
- **那么** 必须清空该 session 历史，返回 204

### 需求:Cron 管理 API
HTTP server 必须提供针对指定 agent 的定时任务增删查接口。

#### 场景:列出定时任务
- **当** `GET /agents/:agentId/cron` 请求到达时
- **那么** 必须返回该 agent 所有启用的定时任务列表

#### 场景:添加定时任务
- **当** `POST /agents/:agentId/cron` 请求含任务配置时
- **那么** 必须添加任务并返回 201 和任务信息

#### 场景:删除定时任务
- **当** `DELETE /agents/:agentId/cron/:jobId` 请求到达时
- **那么** 必须删除任务并返回 204

### 需求:健康检查接口
HTTP server 必须提供健康检查接口。

#### 场景:健康检查
- **当** `GET /health` 请求到达时
- **那么** 必须返回 200 和 `{ status: "ok", agents: <count> }`
