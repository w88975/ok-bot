## 新增需求

### 需求:AgentEvent 联合类型定义
系统必须定义 `AgentEvent` 联合类型，包含以下变体：`message_start`、`message_end`、`think_start`、`think_delta`、`think_end`、`text_delta`、`tool_start`、`tool_stdout`、`tool_end`、`error`。每个变体必须携带足够的字段供消费者区分和渲染。

#### 场景:message_end 携带完整内容
- **当** `processMessage` 执行完毕
- **那么** 必须 emit `{ type: 'message_end', content: string }`，content 为本轮 LLM 最终输出文本

#### 场景:tool_start 携带结构化信息
- **当** AgentLoop 即将执行一个工具调用
- **那么** 必须 emit `{ type: 'tool_start', callId: string, name: string, arguments: Record<string, unknown> }`

#### 场景:tool_end 携带完整结果
- **当** 工具调用执行完毕
- **那么** 必须 emit `{ type: 'tool_end', callId: string, result: string }`，result 为完整原始结果，不截断

#### 场景:error 携带错误消息
- **当** AgentLoop 执行过程中抛出异常
- **那么** 必须 emit `{ type: 'error', message: string }` 后终止

---

### 需求:OnEvent 回调替代 OnToken 和 OnProgress
系统必须将 `AgentLoop.processMessage` 的回调参数从 `(onProgress?, onToken?)` 变更为单一 `(onEvent?)`，类型为 `OnEvent = (event: AgentEvent) => Promise<void> | void`。`OnToken` 和 `OnProgress` 类型必须被废弃。

#### 场景:Core 层调用者获得结构化事件
- **当** 第三方代码调用 `agentLoop.processMessage(msg, onEvent)` 并传入 onEvent 回调
- **那么** onEvent 必须按顺序接收 `message_start`，随后若干 `text_delta`/`think_*`/`tool_*` 事件，最后接收 `message_end`

#### 场景:不传 onEvent 时行为不变
- **当** 调用 `agentLoop.processMessage(msg)` 不传 onEvent
- **那么** AgentLoop 必须静默执行，不因缺少回调而报错，最终仍返回 `OutboundMessage`

---

### 需求:WorkerOutboundMessage 事件类型统一
`WorkerOutboundMessage` 必须新增 `type: 'event'` 变体，携带 `event: AgentEvent` 字段。`type: 'token'` 和 `type: 'progress'` 的 `token`/`hint` 字段必须废弃，`AgentWorker` 禁止再发送这两种类型。

#### 场景:Worker 转发 AgentEvent
- **当** AgentLoop 的 onEvent 被触发
- **那么** AgentWorker 必须向主线程 postMessage `{ type: 'event', event: AgentEvent, requestId }`

#### 场景:AgentManager 转发 onEvent
- **当** AgentManager 收到 `type: 'event'` 消息
- **那么** AgentManager 必须调用对应 PendingRequest 的 `onEvent` 回调，不结束 pending

---

### 需求:SSE 事件名直接映射 AgentEvent.type
`chat.ts` 的 SSE 流式端点必须将每个 `AgentEvent` 映射为 `{ event: agentEvent.type, data: JSON.stringify(agentEvent) }`，不得做任何额外转换或过滤。

#### 场景:前端可直接用 event name 订阅
- **当** 客户端监听 `event: tool_start`
- **那么** 服务端必须发送 `event: tool_start\ndata: {"type":"tool_start","callId":"...","name":"...","arguments":{...}}\n\n`

#### 场景:message_start 必须是第一个 SSE 事件
- **当** 一次流式响应开始
- **那么** 第一个 SSE 事件的 event name 必须是 `message_start`

#### 场景:message_end 必须是最后一个 SSE 事件（正常结束）
- **当** 一次流式响应正常结束
- **那么** 最后一个 SSE 事件的 event name 必须是 `message_end`，之后 stream 关闭
