## 为什么

当前 SSE 流式输出只有粗粒度的 `token`、`progress`、`done`、`error` 四种事件，客户端无法区分 LLM 正在思考、输出文本、还是在调用工具，也无法获取工具调用的结构化信息（名称、参数、返回值、实时 stdout）。需要一套语义化的事件协议，让前端和第三方 Core 调用者都能精确感知 agent 执行的每个阶段。

## 变更内容

- **新增** `AgentEvent` 联合类型，替代原有的 `OnToken` + `OnProgress` 双回调
- **新增** `message_start` / `message_end`：标记整个 `processMessage` 的生命周期
- **新增** `think_start` / `think_delta` / `think_end`：深度思考模型的推理过程流式输出
- **新增** `text_delta`：LLM 文本 token 流式输出（替代原 `onToken`）
- **新增** `tool_start` / `tool_stdout` / `tool_end`：工具调用的完整生命周期，包含实时 stdout 流
- **新增** `error`：结构化错误事件
- **BREAKING** `OnToken` + `OnProgress` 回调接口废弃，统一改为 `OnEvent`
- **BREAKING** `WorkerOutboundMessage` 的 `type: 'token'` 和 `type: 'progress'` 替换为 `type: 'event'`
- **BREAKING** `AgentManager.chat()` 的 `onToken` / `onProgress` 参数替换为 `onEvent`
- **新增** `ProviderConfig.thinking` 字段，支持配置深度思考模式（Anthropic budgetTokens、通用开关）
- **修改** `VercelAIProvider` 使用 `fullStream` 替代 `textStream`，捕获 reasoning 事件
- **修改** `ToolDefinition.execute` 和 `ToolRegistry.execute` 加入可选 `onStdout` 上下文
- **修改** `ShellTool` 利用已有 `spawn` 实现实时 stdout 流式推送
- **修改** `chat.ts` SSE 路由直接映射 `AgentEvent.type` 为 SSE event name

## 功能 (Capabilities)

### 新增功能

- `agent-event-protocol`: 定义 `AgentEvent` 联合类型及其在各层（Core/Worker/Server）的传播协议
- `thinking-config`: LLM 深度思考模式的配置与事件输出（`think_start/delta/end`）
- `tool-streaming`: 工具执行的结构化生命周期事件，含 Shell 实时 stdout 流

### 修改功能

（无规范级行为变更，仅实现层重构）

## 影响

- `packages/core/src/agent/AgentEvent.ts`（新文件）
- `packages/core/src/types.ts`：`WorkerOutboundMessage`、`ProviderConfig`
- `packages/core/src/providers/types.ts`：`ChatOptions`
- `packages/core/src/providers/VercelAIProvider.ts`：流式处理逻辑
- `packages/core/src/agent/AgentLoop.ts`：回调接口、事件 emit
- `packages/core/src/agent/AgentWorker.ts`：Worker 消息协议
- `packages/core/src/agent/AgentManager.ts`：`PendingRequest` 类型
- `packages/core/src/tools/ToolRegistry.ts`：execute 签名
- `packages/core/src/tools/builtin/ShellTool.ts`：stdout 流式
- `packages/server/src/routes/chat.ts`：SSE 映射
