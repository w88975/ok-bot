## 新增需求

### 需求:在后台异步执行子任务
SubagentManager 必须支持在后台异步启动子 agent，执行特定任务，不阻塞主 agent 响应。

#### 场景:spawn 子 agent
- **当** 调用 `subagentManager.spawn({ task, label?, originChannel, originChatId, sessionKey? })` 时
- **那么** 必须立即返回确认消息（含 task id），并在后台异步执行任务

### 需求:子 agent 使用受限工具集
SubagentManager 中运行的子 agent 必须使用受限工具集，禁止发送消息和再次 spawn。

#### 场景:子 agent 工具集
- **当** 子 agent 执行任务时
- **那么** 可用工具必须仅限 filesystem、exec、web_search、web_fetch，禁止 message 和 spawn 工具

### 需求:子 agent 完成后通知主 agent
子 agent 完成（成功或失败）后必须通过 `system` channel 将结果注回主 agent，由主 agent 汇报给用户。

#### 场景:子 agent 成功完成
- **当** 子 agent 任务执行完毕时
- **那么** 必须向 MessageBus 发布 `channel: "system"` 的 InboundMessage，内容包含任务描述和结果，提示主 agent 简洁汇报

#### 场景:子 agent 执行失败
- **当** 子 agent 抛出异常时
- **那么** 必须将错误信息注回主 agent，不得静默失败

### 需求:按 session 取消子 agent
SubagentManager 必须支持取消指定 session 下所有进行中的子 agent。

#### 场景:取消 session 子 agent
- **当** 调用 `cancelBySession(sessionKey)` 时
- **那么** 必须取消该 session 关联的所有未完成子 agent task，返回取消数量
