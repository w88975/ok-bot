## 新增需求

### 需求:创建和管理多个 AgentInstance
AgentManager 必须支持动态创建多个 AgentInstance，每个 AgentInstance 在独立的 Worker Thread 中运行，拥有独立的 workspace 路径。

#### 场景:创建 agent
- **当** 调用 `agentManager.createAgent({ id, workspace, config })` 时
- **那么** 必须在独立 Worker Thread 中启动 AgentInstance，并注册到内部 Map，返回 agent id

#### 场景:禁止重复 agent id
- **当** 使用已存在的 id 调用 `createAgent` 时
- **那么** 必须抛出错误，拒绝创建

### 需求:向指定 agent 发送消息
AgentManager 必须提供向指定 agent 发送消息并获取响应的接口。

#### 场景:发送消息并获取响应
- **当** 调用 `agentManager.chat({ agentId, sessionKey, content, media? })` 时
- **那么** 必须将消息路由到对应 Worker，等待响应后返回 `OutboundMessage`

#### 场景:向不存在的 agent 发送消息
- **当** 指定的 agentId 不存在时
- **那么** 必须抛出 `AgentNotFoundError`

### 需求:停止和移除 agent
AgentManager 必须支持优雅停止并移除指定 agent。

#### 场景:停止 agent
- **当** 调用 `agentManager.removeAgent(agentId)` 时
- **那么** 必须向 Worker 发送 shutdown 信号，等待 Worker 关闭后从 Map 中移除

### 需求:列出所有运行中的 agent
AgentManager 必须提供查询所有 agent 状态的接口。

#### 场景:列出 agents
- **当** 调用 `agentManager.listAgents()` 时
- **那么** 必须返回所有 agent 的 id、workspace、状态（running/stopped）列表

### 需求:有序关闭所有 agent
AgentManager 必须支持有序关闭，停止所有 Worker Thread。

#### 场景:全局关闭
- **当** 调用 `agentManager.shutdown()` 时
- **那么** 必须向所有 Worker 发送 shutdown 信号，等待全部关闭
