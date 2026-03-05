## 上下文

`ok-bot` 已实现 `TelegramChannel` 类，但服务器启动入口（`index.ts`）中没有从配置文件读取并自动创建 Telegram Channel 的机制。目前每次新增 bot 都需要手动修改代码。用户持有两个独立的 Telegram Bot Token，分别对应 `haozhu` 和 `didi` 两个 agent。

## 目标 / 非目标

**目标：**
- 在 `ServerConfig` 中新增 `telegramChannels` 配置字段
- 服务器启动时自动读取配置并初始化对应的 `TelegramChannel` 实例
- 在 `ok-bot.config.json` 中完成 haozhu / didi 两个 bot 的配置
- 服务关闭时优雅停止所有 Telegram Channel

**非目标：**
- 不修改 `TelegramChannel` 类本身的逻辑
- 不新增 webhook 模式（继续使用 long polling）
- 不实现 channel 的动态热更新

## 决策

### 1. 在 `ServerConfig` 中新增 `telegramChannels` 字段

```ts
export interface TelegramChannelPreset {
  token: string;
  defaultAgentId?: string;
  chatToAgent?: Record<string, string>;
}
// ServerConfig 新增:
telegramChannels?: TelegramChannelPreset[];
```

**理由**：与现有 `agents` 字段风格保持一致，配置即声明，无需改动其他模块。

替代方案（每个 agent 内嵌 telegram token）被排除，因为一个 bot token 不一定只服务于一个 agent，路由应由 channel 层管理。

### 2. 在 `index.ts` 中统一管理 TelegramChannel 生命周期

启动时遍历 `telegramChannels`，构造 `TelegramChannel` 实例并调用 `start()`；在 `shutdown` 回调中调用各实例的 `stop()`。利用现有 `ChannelManager` 类统一管理生命周期。

## 风险 / 权衡

- [风险] Token 明文写入配置文件 → 缓解：配置文件不提交到版本控制（已在 .gitignore 中），或后续支持环境变量替换
- [风险] Bot Token 无效时启动失败 → 缓解：`TelegramChannel.start()` 内部已有错误日志，不影响主服务启动（使用 `Promise.allSettled` 并记录失败）
