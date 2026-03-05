## 新增需求

### 需求:通过 long polling 接收 Telegram 消息
TelegramChannel 必须使用 grammy 库以 long polling 模式运行，将收到的 Telegram 消息转为 InboundMessage 投递到指定 agent。

#### 场景:接收文本消息
- **当** Telegram bot 收到用户文本消息时
- **那么** 必须构造 InboundMessage（channel="telegram", sender_id=userId, chat_id=chatId），投递到 AgentManager

#### 场景:接收图片消息
- **当** Telegram bot 收到含图片的消息时
- **那么** 必须下载图片，附加到 InboundMessage 的 media 字段

### 需求:发送 Telegram 消息回复
TelegramChannel 必须监听 OutboundMessage，将 agent 回复发送到对应的 Telegram chat。

#### 场景:发送回复
- **当** AgentManager 产生 OutboundMessage（channel="telegram"）时
- **那么** 必须调用 grammy 发送消息到对应 chat_id

#### 场景:消息超长分割
- **当** 回复内容超过 Telegram 单消息字符限制（4096）时
- **那么** 必须自动分割为多条消息发送

### 需求:Telegram chat 与 agent 路由
TelegramChannel 必须支持配置 chat_id → agentId 的路由映射，将不同 chat 的消息路由到不同 agent。

#### 场景:路由到指定 agent
- **当** 配置了 `chatToAgent: { "123456": "agent-alpha" }` 时
- **那么** chat 123456 的消息必须路由到 agent-alpha

#### 场景:未配置路由的 chat
- **当** chat_id 不在路由映射中时
- **那么** 必须路由到默认 agent（若已配置），否则忽略该消息
