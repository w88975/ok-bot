## 1. 定义 AgentEvent 类型与 OnEvent 接口

- [x] 1.1 新建 `packages/core/src/agent/AgentEvent.ts`，定义 `AgentEvent` 联合类型（`message_start`、`message_end`、`think_start`、`think_delta`、`think_end`、`text_delta`、`tool_start`、`tool_stdout`、`tool_end`、`error`）及 `OnEvent` 类型
- [x] 1.2 在 `packages/core/src/types.ts` 的 `ProviderConfig` 中新增可选 `thinking?: { enabled: boolean; budgetTokens?: number }` 字段
- [x] 1.3 在 `packages/core/src/types.ts` 的 `WorkerOutboundMessage` 中新增 `type: 'event'` 分支，携带 `event?: AgentEvent` 字段

## 2. 改造 VercelAIProvider

- [x] 2.1 在 `packages/core/src/providers/types.ts` 的 `ChatOptions` 中，将 `onToken` 替换为 `onEvent?: OnEvent`，新增 `thinking?: { enabled: boolean; budgetTokens?: number }`
- [x] 2.2 修改 `VercelAIProvider.chat()`：当 `options.onEvent` 存在时，用 `fullStream` 替代 `textStream`；遍历 chunk 时按 `type` dispatch：`text-delta` → `text_delta` 事件，`reasoning` → `think_start/delta/end` 事件
- [x] 2.3 在 `VercelAIProvider.chat()` 中，当 `thinking.enabled` 为 true 且 provider 为 anthropic 时，向 `streamText` 传入 `providerOptions.anthropic.thinking`；其他 provider 忽略此配置

## 3. 改造 ToolRegistry 和 ShellTool

- [x] 3.1 修改 `packages/core/src/tools/ToolRegistry.ts`：`ToolDefinition.execute` 签名扩展为 `execute(args, context?: { onStdout?: (data: string) => void }): Promise<string>`；`ToolRegistry.execute()` 新增第三个可选参数 `context` 并透传给工具
- [x] 3.2 修改 `packages/core/src/tools/builtin/ShellTool.ts`：在 `child.stdout.on('data')` 和 `child.stderr.on('data')` 回调中调用 `context?.onStdout?.(chunk)`

## 4. 改造 AgentLoop

- [x] 4.1 修改 `packages/core/src/agent/AgentLoop.ts`：将 `processMessage` 签名中的 `(onProgress?, onToken?)` 替换为单一 `(onEvent?: OnEvent)`，删除 `OnProgress` 和 `OnToken` 类型导出
- [x] 4.2 修改 `AgentLoop._runLoop`：在循环开始前 emit `message_start`；将 `onToken` 传递替换为 `onEvent` 传递给 `provider.chat()`；工具执行前 emit `tool_start`，执行后 emit `tool_end`
- [x] 4.3 修改 `AgentLoop._runLoop`：调用 `tools.execute` 时传入 `context: { onStdout: (data) => onEvent?.({ type: 'tool_stdout', callId, data }) }`；循环结束时 emit `message_end`

## 5. 改造 AgentWorker 和 AgentManager

- [x] 5.1 修改 `packages/core/src/agent/AgentWorker.ts`：将 `onToken`/`onProgress` 两个回调合并为单一 `onEvent` 回调，在回调中 postMessage `{ type: 'event', event, requestId }`
- [x] 5.2 修改 `packages/core/src/agent/AgentManager.ts`：`PendingRequest` 类型中将 `onToken`/`onProgress` 替换为 `onEvent?: OnEvent`；`_handleWorkerMessage` 中处理 `type: 'event'` 分支转发给 `pending.onEvent`；`chat()` 方法签名中将 `onToken`/`onProgress` 替换为 `onEvent`

## 6. 改造 Server SSE 路由

- [x] 6.1 修改 `packages/server/src/routes/chat.ts`：将 `onToken`/`onProgress` 两个回调替换为单一 `onEvent`；每个事件映射为 `stream.writeSSE({ event: e.type, data: JSON.stringify(e) })`；删除原有 `event: 'done'` 写入（由 `message_end` 事件替代），保留 `event: 'error'` 兜底

## 7. 导出更新与验证

- [x] 7.1 在 `packages/core/src/index.ts`（或相应的 barrel 文件）中导出 `AgentEvent`、`OnEvent` 类型
- [x] 7.2 运行 `tsc --noEmit` 确认全量类型无错误
- [x] 7.3 运行现有测试套件（`app.test.ts` 等）确认非流式路径不受影响
