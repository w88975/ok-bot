## 为什么

HTML 演示客户端（ok-bot-demo）通过 SSE `/chat/stream` 接口连接 ok-bot server 时，看不到工具调用过程，也没有加载 skills——行为与直接运行 `start.mjs` 明显不一致，导致医院导诊助手的实际能力无法在 web 端体现。

经排查，根因有三处，相互叠加。

## 变更内容

### 根因一：HTML 客户端连接了错误的 Agent

`ok-bot-demo/index.html` 中写死了 `const AGENT = 'haozhu'`，而 `haozhu` 对应 workspace `豪猪`（通用助手），缺少医院相关 skills（`doctor-query`、`hospital-registration`、`medical-card`）和专用 `AGENTS.md`。

`start.mjs` 使用的 workspace 是 `华二`，对应 server 中的 `doctor` agent。两者指向不同 workspace，因此行为不同。

**修复**：将 HTML 中的 `AGENT` 从 `'haozhu'` 改为 `'doctor'`。

---

### 根因二：SSE 流中缺少工具调用进度事件

`chat/stream` 端点仅向客户端发送两类事件：
- `event: token`——LLM 逐 token 输出
- `event: done`——最终完整回复

工具调用期间的进度提示（`⚙ tool_name("arg")`）在 `AgentLoop._runLoop` 中通过 `onProgress` 触发，但在 `AgentWorker` 中调用时 `onProgress` 传入的是 `undefined`，导致它走默认路径把进度发到 MessageBus，而 Bus 消息不带 `_requestId`，在 `AgentManager._handleWorkerMessage` 中被静默丢弃，永远不会到达 SSE 客户端。

**修复**：在 SSE 流中新增 `event: progress` 事件，将工具调用提示实时推送给客户端，并在 HTML 端处理并显示。

---

### 根因三：AgentWorker 未透传 onProgress

`AgentWorker.ts` 中调用：
```ts
const response = await agentLoop.processMessage(inbound, undefined, onToken);
```
第二个参数 `onProgress` 显式传了 `undefined`，导致工具提示走 Bus 旁路，无法经 Worker → Manager → SSE 链路传递。

**修复**：在 AgentWorker 中创建 `onProgress` 回调，通过 `parentPort.postMessage` 以新增的 `progress` 消息类型发给主线程，主线程再通过已有的 `onToken` 机制发到 SSE 流。

## 功能 (Capabilities)

### 新增功能

- `sse-progress-events`: SSE 流中新增 `event: progress` 事件，将工具调用提示实时推送给 web 客户端

### 修改功能

- 无规范级行为变更（以上均为配置修正或实现缺陷修复）

## 影响

- `ok-bot-demo/index.html`：修改 `AGENT` 常量，新增处理 `progress` SSE 事件的 UI 逻辑
- `packages/core/src/agent/AgentWorker.ts`：新增 `onProgress` 回调，通过 `parentPort` 发送 `progress` 消息
- `packages/core/src/types.ts`：`WorkerOutboundMessage` 联合类型新增 `progress` 变体
- `packages/core/src/agent/AgentManager.ts`：`_handleWorkerMessage` 处理 `progress` 消息，转调 `onToken`（或新增 `onProgress` 回调）
- `packages/server/src/routes/chat.ts`：SSE handler 接收 progress 并 `writeSSE({ event: 'progress', ... })`
