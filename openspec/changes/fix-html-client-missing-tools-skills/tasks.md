## 1. 类型定义

- [x] 1.1 在 `packages/core/src/types.ts` 的 `WorkerOutboundMessage` 联合类型中新增 `{ type: 'progress'; hint: string; requestId?: string }` 变体

## 2. AgentWorker — 透传 onProgress

- [x] 2.1 在 `packages/core/src/agent/AgentWorker.ts` 中，当 `msg.requestId` 存在时，创建 `onProgress` 回调，内部调用 `parentPort.postMessage({ type: 'progress', hint: content, requestId: msg.requestId })`
- [x] 2.2 将 `onProgress` 传入 `agentLoop.processMessage(inbound, onProgress, onToken)`（目前第二个参数为 `undefined`）

## 3. AgentManager — 处理 progress 消息

- [x] 3.1 在 `AgentManager` 的 `PendingRequest` 接口中新增 `onProgress?: (hint: string) => void` 字段
- [x] 3.2 在 `AgentManager.chat()` 的 options 中新增 `onProgress?: (hint: string) => void` 参数，并在创建 pending request 时保存
- [x] 3.3 在 `_handleWorkerMessage` 中处理 `msg.type === 'progress'`：调用 `pending.onProgress?.(msg.hint)` 并 return（不结束 pending）

## 4. SSE 路由 — 转发 progress 事件

- [x] 4.1 在 `packages/server/src/routes/chat.ts` 的 `chat/stream` handler 中，向 `manager.chat()` 传入 `onProgress` 回调，回调内调用 `await stream.writeSSE({ event: 'progress', data: hint })`

## 5. HTML 客户端修复

- [x] 5.1 将 `ok-bot-demo/index.html` 中 `const AGENT = 'haozhu'` 改为 `const AGENT = 'doctor'`
- [x] 5.2 在 SSE 事件解析循环中增加对 `currentEvent === 'progress'` 的处理：在当前气泡下方渲染灰色工具提示元素（id/class 标记，便于后续移除）
- [x] 5.3 在收到 `event: done` 时移除所有工具提示元素，正常渲染最终回复
