## 上下文

ok-bot server 通过 Worker Thread 运行 agent，主线程通过 `AgentManager` 转发消息。SSE 流式端点 `POST /agents/:id/chat/stream` 目前只发送 `token`（逐字符）和 `done`（最终回复）两类事件。工具调用期间的进度提示（`onProgress`）在 Worker 中流向 MessageBus，但 Bus 消息没有 `_requestId`，被 `AgentManager._handleWorkerMessage` 静默丢弃，永远不到达 SSE 客户端。

HTML 演示客户端还硬编码了 `AGENT = 'haozhu'`，而医院导诊功能需要的是 `doctor` agent（workspace `华二`，含专用 skills 和 AGENTS.md）。

## 目标 / 非目标

**目标：**
- 修复 HTML 客户端连接的 Agent ID（`haozhu` → `doctor`）
- 在 Worker → Manager → SSE 链路上透传工具调用进度事件
- 新增 `event: progress` SSE 事件，让 web 端能显示工具调用提示

**非目标：**
- 不改变 token streaming 已有机制
- 不修改 AgentLoop 核心逻辑（仅改 Worker 层传参）
- 不重构 MessageBus 架构

## 决策

### 1. 新增 `WorkerOutboundMessage` 的 `progress` 变体，而非复用 `token`

**选 A（本方案）**：单独增加 `{ type: 'progress', hint: string, requestId }` 消息类型，区别于 `token`。
- 优点：语义清晰，前端可独立处理工具提示（不混入正文流）
- 缺点：需要在 types.ts / AgentManager / chat.ts 各加一处处理

**选 B**：把工具提示也作为 `token` 发送，前端统一处理
- 缺点：工具提示和正文 token 混在一起，前端无法区分展示样式

**决策**：选 A。工具提示在 UI 上需要不同样式（灰色斜体），必须有独立事件类型。

---

### 2. AgentWorker 创建 `onProgress` 回调，通过 `parentPort.postMessage` 发给主线程

AgentWorker 目前传 `undefined` 给 `processMessage` 的 `onProgress` 参数，导致进度走 Bus 旁路。

**修复**：在 AgentWorker 创建 `onProgress` 函数，调用 `parentPort.postMessage({ type: 'progress', hint: content, requestId })`，与 `onToken` 的做法完全对称。

---

### 3. AgentManager 的 `onToken` 扩展为支持进度回调

目前 `PendingRequest` 只有 `onToken?: (token: string) => void`。新增 `onProgress?: (hint: string) => void` 字段，在 `_handleWorkerMessage` 中处理 `progress` 消息时调用。

`chat.ts` 的 SSE handler 在创建 pending request 时传入 `onProgress` 回调，写 `event: progress`。

---

### 4. HTML 客户端处理 `event: progress`

在 SSE 事件解析循环中增加对 `progress` 事件的处理：在气泡下方显示灰色小字工具提示，工具调用结束后（收到 `done`）自动移除。

## 风险 / 权衡

- **Worker 消息顺序**：`progress` 消息通过 `postMessage` 传递，与 `token` 消息在同一信道，顺序有保障。
- **onProgress 可能频繁调用**：每次工具调用触发一次，数量有限，不影响性能。
- **HTML 客户端改动独立**：`ok-bot-demo/index.html` 不在 monorepo 内，是独立文件，需手动更新。
