## 新增需求

### 需求:连接 MCP servers 并注册工具
McpClient 必须支持通过配置连接多个 MCP servers（stdio 或 SSE 传输），并将其暴露的工具自动注册到 ToolRegistry。

#### 场景:连接 MCP server
- **当** 配置中包含 MCP server 定义时
- **那么** AgentLoop 启动时必须延迟（lazy）连接，连接成功后将 MCP 工具注册到 ToolRegistry

#### 场景:MCP server 连接失败
- **当** MCP server 连接失败时
- **那么** 必须记录错误日志，下次消息时重试，不阻断 agent 启动

### 需求:工具执行代理到 MCP server
已注册的 MCP 工具必须将调用代理到对应的 MCP server 执行，返回结果。

#### 场景:执行 MCP 工具
- **当** agent 调用已注册的 MCP 工具时
- **那么** 必须将调用转发到对应 MCP server，返回执行结果

### 需求:连接生命周期管理
McpClient 必须在 AgentLoop 关闭时正确断开所有 MCP server 连接。

#### 场景:关闭时断开连接
- **当** AgentLoop 关闭时
- **那么** 必须调用 closeMcp()，有序断开所有 MCP server 连接
