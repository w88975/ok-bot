## 1. 扩展 ServerConfig 类型

- [x] 1.1 在 `packages/server/src/config.ts` 中新增 `TelegramChannelPreset` 接口（包含 `token`、`defaultAgentId`、`chatToAgent` 字段）
- [x] 1.2 在 `ServerConfig` 接口中新增可选的 `telegramChannels?: TelegramChannelPreset[]` 字段

## 2. 更新服务器启动逻辑

- [x] 2.1 在 `packages/server/src/index.ts` 中导入 `TelegramChannel`（来自 `@ok-bot/core`）
- [x] 2.2 在 agent 创建完成后，遍历 `config.telegramChannels`，使用 `Promise.allSettled` 为每条配置创建 `TelegramChannel` 实例并调用 `start()`
- [x] 2.3 在 `shutdown` 回调中，调用所有已启动 TelegramChannel 实例的 `stop()` 方法

## 3. 配置文件更新

- [x] 3.1 在 `packages/server/ok-bot.config.json` 中新增 `telegramChannels` 数组，配置 haozhu（token: `8388015810:AAHwE3_7ZVuM-wwfEoW-1qHw3L35JPTQHpE`，defaultAgentId: `haozhu`）和 didi（token: `8754116715:AAEfk1hVrNvNzfWNSO_U0n4GIRRnQz8_PjY`，defaultAgentId: `didi`）两个 bot
