## 新增需求

### 需求:Worker 透传工具调用进度
AgentWorker 必须在调用 `agentLoop.processMessage` 时传入 `onProgress` 回调，回调中必须通过 `parentPort.postMessage` 发送 `{ type: 'progress', hint: string, requestId }` 消息给主线程。

#### 场景:工具调用触发进度消息
- **当** AgentLoop 执行工具调用并调用 `onProgress(hint, { toolHint: true })` 时
- **那么** Worker 必须发送 `type: 'progress'` 消息到主线程，包含 `hint` 字段和对应的 `requestId`

#### 场景:无 requestId 时不发送进度
- **当** 消息没有 `requestId`（如 cron/heartbeat 触发的消息）
- **那么** Worker 不需要发送 progress 消息（`onProgress` 可设为 `undefined`）

---

### 需求:AgentManager 处理 progress 消息
`WorkerOutboundMessage` 联合类型必须包含 `{ type: 'progress'; hint: string; requestId?: string }` 变体。`AgentManager._handleWorkerMessage` 必须识别 `progress` 消息并调用对应 `PendingRequest` 上的 `onProgress` 回调。

#### 场景:主线程收到进度消息
- **当** Worker 发送 `type: 'progress'` 消息
- **那么** AgentManager 必须查找对应 `requestId` 的 `PendingRequest`，调用其 `onProgress?.(hint)`，并且不结束该 pending 请求

#### 场景:无对应 pending 请求时忽略
- **当** `progress` 消息的 `requestId` 找不到对应的 pending 请求
- **那么** AgentManager 必须静默忽略，不抛出异常

---

### 需求:SSE 流包含 progress 事件
`POST /agents/:agentId/chat/stream` 端点必须在工具调用期间向客户端发送 `event: progress` SSE 事件，`data` 字段为工具提示字符串。

#### 场景:工具调用时发送 progress 事件
- **当** agent 执行工具调用时
- **那么** SSE 流中必须先发送一条或多条 `event: progress` 事件，每条对应一次工具调用提示

#### 场景:progress 事件不影响 done 事件
- **当** 所有工具调用完成、agent 返回最终回复
- **那么** SSE 流最终必须仍然发送 `event: done` 事件，包含完整 `content`

---

### 需求:HTML 客户端连接正确 Agent
`ok-bot-demo/index.html` 中的 `AGENT` 常量必须设置为 `'doctor'`，以连接 workspace `华二` 的 agent。

#### 场景:客户端连接 doctor agent
- **当** HTML 页面加载并发送消息
- **那么** 请求路径必须为 `/agents/doctor/chat/stream`

---

### 需求:HTML 客户端显示工具调用进度
HTML 客户端必须处理 `event: progress` SSE 事件，在消息气泡下方显示工具提示，收到 `event: done` 后移除提示。

#### 场景:工具提示显示
- **当** 客户端收到 `event: progress` 事件
- **那么** 必须在当前 bot 消息下方显示灰色工具提示文字（例如 "⚙ doctor_query(...)"）

#### 场景:工具提示消失
- **当** 客户端收到 `event: done` 事件
- **那么** 工具提示必须被移除，最终回复内容正常渲染
