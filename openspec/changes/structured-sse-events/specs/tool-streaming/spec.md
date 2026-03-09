## 新增需求

### 需求:ToolDefinition.execute 支持可选 onStdout 上下文
`ToolDefinition.execute` 的签名必须扩展为 `execute(args, context?: { onStdout?: (data: string) => void }): Promise<string>`。现有工具实现若不使用 context 参数，必须保持向后兼容，不得报类型错误。

#### 场景:ShellTool 利用 onStdout 实时推送
- **当** `ToolRegistry.execute` 调用 `ShellTool` 并传入 `context.onStdout`
- **那么** ShellTool 必须在每次 `child.stdout/stderr` 的 `data` 事件触发时调用 `onStdout(chunk)`

#### 场景:其他工具忽略 context 参数
- **当** `ToolRegistry.execute` 调用 FileSystemTool、WebSearchTool 等并传入 context
- **那么** 这些工具必须正常执行，context 参数被忽略，不得抛出错误

---

### 需求:AgentLoop 在工具执行前后 emit tool 事件
`AgentLoop._runLoop` 必须在工具执行的完整生命周期中 emit 对应事件：执行前 emit `tool_start`，执行期间 emit `tool_stdout`（若工具支持），执行后 emit `tool_end`。

#### 场景:工具调用完整事件序列
- **当** AgentLoop 执行一次工具调用（如 `exec`）
- **那么** 事件顺序必须为：`tool_start` → 若干 `tool_stdout` → `tool_end`，callId 在三个事件中必须一致

#### 场景:tool_stdout 仅在有数据时 emit
- **当** Shell 命令执行期间没有任何 stdout/stderr 输出
- **那么** 禁止 emit `tool_stdout` 事件（不得 emit 空 data 的 tool_stdout）

#### 场景:tool_end.result 不截断
- **当** 工具返回超长结果（如读取大文件内容）
- **那么** `tool_end.result` 必须包含工具返回的完整字符串，不截断

---

### 需求:ToolRegistry.execute 向工具传递 onStdout 上下文
`ToolRegistry.execute` 必须接受可选的第三个参数 `context?: { onStdout?: (data: string) => void }`，并将其原样传递给工具的 `execute` 函数。

#### 场景:onStdout 上下文透传
- **当** 调用 `toolRegistry.execute('exec', args, { onStdout: cb })`
- **那么** `ShellTool.execute` 必须接收到 `context.onStdout === cb`，且每次有输出时调用它
