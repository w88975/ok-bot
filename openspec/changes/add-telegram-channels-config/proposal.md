## 为什么

当前 `ok-bot.config.json` 支持配置 agents，但服务器启动时无法从配置文件中自动初始化 Telegram Channel。用户已申请了两个 Telegram Bot API Key（haozhu / didi），需要将其与对应 agent 绑定并通过配置文件驱动启动。

## 变更内容

- 在 `ServerConfig` 中新增 `telegramChannels` 字段，支持配置一组 Telegram Channel（每个包含 token、defaultAgentId、chatToAgent 路由）
- 在服务器启动流程（`index.ts`）中读取 `telegramChannels` 配置，自动创建并启动对应的 `TelegramChannel` 实例
- 在 `ok-bot.config.json` 中配置两个 Telegram Channel：
  - `haozhu`：token `8388015810:AAHwE3_7ZVuM-wwfEoW-1qHw3L35JPTQHpE`，defaultAgentId `haozhu`
  - `didi`：token `8754116715:AAEfk1hVrNvNzfWNSO_U0n4GIRRnQz8_PjY`，defaultAgentId `didi`

## 功能 (Capabilities)

### 新增功能

- `telegram-channel-config`: 支持通过配置文件声明并自动启动 Telegram Channel，实现 token→agent 绑定的配置化管理

### 修改功能

（无规范级行为变更）

## 影响

- `packages/server/src/config.ts`：新增 `TelegramChannelPreset` 类型与 `ServerConfig.telegramChannels` 字段
- `packages/server/src/index.ts`：启动时遍历 `telegramChannels` 配置，初始化 `TelegramChannel` 实例并调用 `start()`，关闭时调用 `stop()`
- `packages/server/ok-bot.config.json`：新增 `telegramChannels` 数组，配置两个 bot
