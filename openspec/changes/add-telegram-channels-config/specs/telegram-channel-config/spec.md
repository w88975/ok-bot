## 新增需求

### 需求:ServerConfig 支持声明 Telegram Channel 列表
`ServerConfig` 必须包含可选的 `telegramChannels` 字段，类型为 `TelegramChannelPreset[]`。每个 preset 必须包含 `token`（string），可选包含 `defaultAgentId`（string）和 `chatToAgent`（Record<string, string>）。

#### 场景:配置文件包含 telegramChannels 数组
- **当** `ok-bot.config.json` 中存在 `telegramChannels` 字段
- **那么** `loadConfig()` 返回的配置对象中必须包含该字段的完整数据

#### 场景:配置文件不包含 telegramChannels 字段
- **当** `ok-bot.config.json` 中不存在 `telegramChannels` 字段
- **那么** `loadConfig()` 返回的配置对象中 `telegramChannels` 必须为 `undefined` 或空数组

### 需求:服务器启动时自动初始化 Telegram Channel
服务器入口必须在启动时遍历 `config.telegramChannels`，为每条配置创建 `TelegramChannel` 实例并调用 `start()`。

#### 场景:存在有效的 telegramChannels 配置
- **当** 配置中包含一个或多个 `TelegramChannelPreset`
- **那么** 服务器必须为每个 preset 创建对应的 `TelegramChannel` 实例并启动 long polling

#### 场景:某个 Channel 启动失败
- **当** 某个 `TelegramChannel.start()` 抛出异常
- **那么** 服务器必须记录错误日志，但不得终止整体启动流程，其余 Channel 必须正常启动

#### 场景:telegramChannels 为空或未配置
- **当** `config.telegramChannels` 为空数组或 undefined
- **那么** 服务器不创建任何 Telegram Channel，启动流程不受影响

### 需求:服务器关闭时优雅停止所有 Telegram Channel
收到关闭信号（SIGINT / SIGTERM）时，服务器必须调用所有已启动 `TelegramChannel` 实例的 `stop()` 方法。

#### 场景:正常关闭流程
- **当** 服务器收到 SIGINT 或 SIGTERM 信号
- **那么** 必须在 `manager.shutdown()` 之前或同时调用所有 TelegramChannel 的 `stop()`

### 需求:ok-bot.config.json 中配置 haozhu 和 didi 两个 Telegram Bot
`ok-bot.config.json` 必须包含 `telegramChannels` 数组，其中 haozhu bot 的 `defaultAgentId` 必须为 `"haozhu"`，didi bot 的 `defaultAgentId` 必须为 `"didi"`。

#### 场景:haozhu bot 收到消息
- **当** Telegram 用户向 haozhu bot 发送消息
- **那么** 消息必须路由到 `haozhu` agent 处理

#### 场景:didi bot 收到消息
- **当** Telegram 用户向 didi bot 发送消息
- **那么** 消息必须路由到 `didi` agent 处理
