## 新增需求

### 需求:注册和执行工具
ToolRegistry 必须支持注册工具（含名称、描述、参数 schema、执行函数），并按名称执行。

#### 场景:注册工具
- **当** 调用 `register(tool)` 时
- **那么** 工具必须被存入 registry，可通过 `get(name)` 检索

#### 场景:执行已注册工具
- **当** 调用 `execute(name, args)` 时
- **那么** 必须调用工具的执行函数，返回字符串结果

#### 场景:执行不存在的工具
- **当** 调用 `execute(name, args)` 且工具未注册时
- **那么** 必须返回错误描述字符串，不抛出异常（避免中断 agent loop）

### 需求:导出 Vercel AI SDK 格式的工具定义
ToolRegistry 必须将所有注册工具导出为 Vercel AI SDK 的 `tools` 参数格式（含 zod schema）。

#### 场景:获取工具定义
- **当** 调用 `getDefinitions()` 时
- **那么** 必须返回所有工具的 Vercel AI SDK `tools` Record，可直接传入 `generateText`

### 需求:支持工具上下文注入
ToolRegistry 必须支持向特定工具注入运行时上下文（如 channel、chat_id、message_id）。

#### 场景:注入工具上下文
- **当** 调用 `setContext(name, context)` 或工具实现了 `setContext` 接口时
- **那么** 工具后续执行时必须使用最新注入的上下文
