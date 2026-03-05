## 新增需求

### 需求:执行 agent 迭代循环
AgentLoop 必须实现 LLM 调用 → 工具执行 → 再次调用的迭代循环，直到 LLM 返回无工具调用的最终响应。

#### 场景:正常完成
- **当** LLM 返回不含工具调用的响应时
- **那么** 循环必须终止，返回最终文本内容

#### 场景:工具调用迭代
- **当** LLM 返回含工具调用的响应时
- **那么** 必须执行所有工具调用，将结果追加到消息列表，继续下一次 LLM 调用

#### 场景:达到最大迭代次数
- **当** 迭代次数达到 `maxIterations`（默认 40）时
- **那么** 必须终止循环并返回提示用户拆分任务的说明文本，不得抛出异常

### 需求:支持进度回调
AgentLoop 必须支持 `onProgress` 回调，在每次工具调用前发送进度提示。

#### 场景:工具调用前发送进度
- **当** LLM 返回工具调用时
- **那么** 必须先调用 `onProgress`（含 tool hint 格式：`toolName("arg...")`），再执行工具

### 需求:支持 SSE 流式 token 回调
AgentLoop.processMessage 必须支持可选的第三参数 `onToken`，透传给每次 `provider.chat()` 调用，实现 token 级流式输出。

#### 场景:启用 onToken 时逐 token 输出
- **当** 调用 `processMessage(msg, onProgress, onToken)` 时传入 `onToken`
- **那么** 每次 LLM 调用必须将 `onToken` 透传给 `provider.chat()`，由 provider 在流式模式下逐 token 回调

#### 场景:工具调用迭代中的中间文本不重复输出
- **当** 某轮迭代 LLM 返回文本 + 工具调用，且 `onToken` 已存在时
- **那么** 该文本已通过 `onToken` 流式输出，`_runLoop` 必须跳过对 `onProgress(content)` 的调用，避免重复打印

### 需求:处理 /stop 命令
AgentLoop 必须支持 `/stop` 命令，取消当前 session 的所有活跃任务和 subagent。

#### 场景:收到 /stop 命令
- **当** 收到内容为 `/stop` 的消息时
- **那么** 必须取消该 session 所有进行中的 async task 和 subagent，并回复取消数量

### 需求:支持 /new 命令清空会话
AgentLoop 必须支持 `/new` 命令，归档当前会话历史并开启新会话。

#### 场景:收到 /new 命令
- **当** 收到内容为 `/new` 的消息时
- **那么** 必须先将未 consolidate 的消息写入 memory，再清空 session 历史，回复"New session started."

### 需求:截断过大的工具结果
AgentLoop 必须截断超过字符限制的工具调用结果，避免 context 爆炸。

#### 场景:工具结果超长
- **当** 工具返回内容超过 500 字符时
- **那么** 存入 session history 时必须截断为 500 字符并追加 `\n... (truncated)`

### 需求:过滤 runtime context 不持久化
AgentLoop 保存 session history 时必须过滤掉 runtime context tag 消息（含时间、channel 的元数据）。

#### 场景:保存历史时过滤 runtime context
- **当** 保存消息到 session 时
- **那么** 内容以 `_RUNTIME_CONTEXT_TAG` 开头的 user 消息必须被跳过，不存入 history
