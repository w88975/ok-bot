## 上下文

ok-bot 是一个多 agent 框架，核心运行在 Worker Thread 中，通过 `AgentLoop` 驱动 LLM 迭代。当前 SSE 流式输出只有 4 种原始事件（`token`/`progress`/`done`/`error`），整条链路（VercelAIProvider → AgentLoop → AgentWorker → AgentManager → chat.ts）传递的都是裸字符串，没有语义。

关键约束：
- Worker Thread 和主线程通过 `postMessage` 通信（结构化克隆），事件对象必须可序列化
- `ToolDefinition.execute` 当前签名不支持流式回调，需最小化改动，不影响非 Shell 工具
- Vercel AI SDK 的 `fullStream` 在不支持 reasoning 的模型上不报错，只是没有 reasoning 事件

## 目标 / 非目标

**目标：**
- 定义语义化的 `AgentEvent` 联合类型，覆盖消息生命周期、思考、文本输出、工具调用、错误五大类
- 将 `OnToken` + `OnProgress` 双回调统一替换为单一 `OnEvent` 回调，贯穿全链路
- 支持 `think_start/delta/end` 事件，深度思考模型的推理过程实时可见
- 支持 `tool_stdout` 事件，Shell 命令执行时实时推送 stdout 数据
- SSE event name 直接等于 `AgentEvent.type`，server 层零转换
- Core 层第三方调用者直接通过 `onEvent` 获得结构化事件，无需解析字符串

**非目标：**
- 不支持取消单条工具调用（现有 `/stop` 命令粒度不变）
- 不对非 Shell 工具实现 stdout 流式（`FileSystemTool`、`WebSearch` 等保持现有同步返回）
- 不实现 WebSocket 或 long-polling，仍使用 SSE

## 决策

### 决策 1：单一 `AgentEvent` 联合类型替代双回调

**选择**：新增 `AgentEvent` 类型文件，`OnEvent = (event: AgentEvent) => void`，完全替换 `OnToken` + `OnProgress`。

**替代方案**：保留双回调，只在 server 层做适配。

**理由**：双回调方案让 Core 层调用者仍需拼接字符串，无法感知工具结构，不满足"Core 层也能拿到结构化事件"的目标。单一 `OnEvent` 使事件在每一层含义一致。

---

### 决策 2：`VercelAIProvider` 改用 `fullStream` 而非 `textStream`

**选择**：当 `onEvent` 存在时，用 `fullStream` 遍历所有 chunk，按 chunk 类型 dispatch 不同事件。

**替代方案**：保留 `textStream`，单独订阅 reasoning stream。

**理由**：`fullStream` 是 Vercel AI SDK 统一入口，一次遍历可获得 `text-delta`、`reasoning`、`tool-call`、`finish` 全部类型，避免两个 async iterable 并行消费的同步问题。

---

### 决策 3：`ToolDefinition.execute` 加可选 `context` 参数

**选择**：
```ts
execute: (args, context?: { onStdout?: (data: string) => void }) => Promise<string>
```
只有 `ShellTool` 实现 `onStdout`，其他工具的 `execute` 签名兼容（忽略 context）。

**替代方案 A**：工具返回 `AsyncIterable<string>` 实现真正的流式。

**替代方案 B**：工具执行完后分段 emit（假流式）。

**理由**：A 改动面太大，所有工具都需要变成 generator；B 对用户体验无实质改善。可选 `context` 方案最小侵入，`ShellTool` 已用 `spawn` 天然支持，其他工具零改动。

---

### 决策 4：`thinking` 配置放在 `ProviderConfig` 层

**选择**：
```json
"provider": {
  "model": "anthropic:claude-3-7-sonnet-20250219",
  "thinking": { "enabled": true, "budgetTokens": 8000 }
}
```
`VercelAIProvider` 读取此配置，Anthropic 模型传 `providerOptions.anthropic.thinking`，其他 provider 忽略。

**替代方案**：放在 agent 根层（`AgentConfig.thinking`）。

**理由**：thinking 是 provider 特性，与模型强绑定。放在 `ProviderConfig` 语义更准确，未来支持不同 agent 用不同模型时配置更自然。

---

### 决策 5：`WorkerOutboundMessage` 增加 `type: 'event'`

**选择**：新增 `type: 'event'` 携带 `event: AgentEvent`，废弃 `type: 'token'` 和 `type: 'progress'`（保留类型字段但 AgentWorker 不再发送）。

**理由**：Worker Thread 的 `postMessage` 走结构化克隆，`AgentEvent` 是纯 JSON 对象，序列化零成本。合并为单一消息类型后，`AgentManager` 的 `_handleWorkerMessage` 只需一个分支处理流式数据。

## 风险 / 权衡

- **[breaking change] API 兼容性** → `onToken`/`onProgress` 废弃，所有调用方必须迁移到 `onEvent`。由于是内部接口（无 public SDK 发布），风险可控。
- **[模型兼容性] reasoning 事件** → 不支持 thinking 的模型不会 emit `think_*` 事件，客户端需容忍事件缺失（不能假设 think_start 一定出现）。
- **[性能] fullStream 遍历** → 相比 textStream 多处理几种 chunk 类型，单次调用开销可忽略不计。
- **[tool_end result 大小]** → 不截断，大型工具结果（如读大文件）会完整 emit。客户端需处理大 data payload。

## 迁移计划

1. 新增 `AgentEvent.ts`，`OnEvent` 类型
2. 改 `VercelAIProvider`（向后兼容：`onToken` 暂保留为适配层，最终删除）
3. 改 `AgentLoop`（将 `OnToken`/`OnProgress` 替换为 `OnEvent`，内部适配）
4. 改 `AgentWorker` + `WorkerOutboundMessage`
5. 改 `AgentManager.PendingRequest`
6. 改 `ToolRegistry` + `ShellTool`
7. 改 `chat.ts`

各步骤可独立提交，不影响非流式路径（`/agents/:id/chat` 非 SSE 端点不使用任何回调）。
