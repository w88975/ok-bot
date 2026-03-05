## 新增需求

### 需求:分层构建 system prompt
ContextBuilder 必须按固定顺序组合 system prompt 各节，各节之间用 `\n\n---\n\n` 分隔。

#### 场景:完整 system prompt 结构
- **当** 调用 `buildSystemPrompt()` 时
- **那么** 输出必须依次包含：identity → bootstrap files（如有）→ memory（如有）→ always-skills（如有）→ skills summary（如有）

### 需求:identity 节包含运行时信息
identity 节必须包含 bot 名称、操作系统、Node.js 版本、workspace 路径、记忆文件路径、使用指南。

#### 场景:identity 节内容
- **当** 生成 identity 节时
- **那么** 必须包含当前 OS 平台、Node.js 版本、workspace 绝对路径

### 需求:注入 runtime context 但不持久化
每轮对话的 user message 前必须注入 runtime context（当前时间、时区、channel、chat_id），并以特殊 tag 标记，保存 history 时必须过滤。

#### 场景:runtime context 注入
- **当** 调用 `buildMessages(history, currentMessage, ...)` 时
- **那么** 必须在 current user message 前插入一条含 `_RUNTIME_CONTEXT_TAG` 的 user message

#### 场景:runtime context 不写入 history
- **当** 本轮对话结束保存消息时
- **那么** runtime context tag 消息必须不出现在 session history 中

### 需求:支持 media 内容（图片）
ContextBuilder 必须支持将 base64 编码的图片附加到 user message。

#### 场景:带图片的消息
- **当** `media` 参数包含有效图片文件路径时
- **那么** 必须将图片编码为 base64 data URL，与文本一起构建多模态消息内容

### 需求:组装完整消息列表
ContextBuilder 必须提供组装完整消息列表（system + history + runtime + user）的方法。

#### 场景:完整消息列表
- **当** 调用 `buildMessages(history, currentMessage)` 时
- **那么** 返回列表顺序必须为：system → history 消息 → runtime context → user message
