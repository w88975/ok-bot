---
id: quickstart
title: 快速开始
sidebar_position: 2
---

# 快速开始

## 环境要求

- Node.js >= 18
- pnpm >= 8

## 安装

```bash
pnpm add @ok-bot/core
```

## 基础使用

### 1. 初始化 workspace

在你的 workspace 目录下创建以下文件：

```
workspace/
├── AGENTS.md      # agent 身份定义
├── SOUL.md        # agent 人格/价值观
├── USER.md        # 用户背景信息
└── TOOLS.md       # 可用工具说明
```

参考 [templates/](https://github.com/your-org/ok-bot/tree/main/templates) 目录的示例。

### 2. 使用 AgentManager

```typescript
import { AgentManager } from '@ok-bot/core';

const manager = new AgentManager();

// 创建 agent
await manager.createAgent({
  id: 'my-agent',
  workspace: '/path/to/workspace',
  provider: {
    model: 'openai:gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// 发送消息
const response = await manager.chat({
  agentId: 'my-agent',
  content: '你好！',
});

console.log(response.content);

// 关闭
await manager.shutdown();
```

### 3. 使用 HTTP Server

```bash
# 克隆 ok-bot
git clone https://github.com/your-org/ok-bot
cd ok-bot && pnpm install

# 设置环境变量
export OPENAI_API_KEY=sk-...

# 启动 server
pnpm --filter @ok-bot/server dev
```

Server 启动后，使用 REST API：

```bash
# 创建 agent
curl -X POST http://localhost:3000/agents \
  -H 'Content-Type: application/json' \
  -d '{ "id": "my-agent", "workspace": "/path/to/workspace", "provider": { "model": "openai:gpt-4o" } }'

# 发送消息
curl -X POST http://localhost:3000/agents/my-agent/chat \
  -H 'Content-Type: application/json' \
  -d '{ "content": "你好！" }'
```

## Web UI 快速开始

ok-bot 服务器内置了一个 React 前端，可以直接在浏览器中与 agent 聊天。

```bash
# 1. 构建 Web UI
pnpm build:ui

# 2. 启动服务器（已内置 Web UI 静态资源服务）
node packages/server/dist/index.js
```

访问 `http://localhost:3000/app/` 打开界面。

功能：
- 点击「新建 Agent」创建 agent（可内联填写 AGENTS.md/SOUL.md 内容）
- 在侧边栏选择 agent 开始单聊
- 点击「新建群组」选择多个 agent 组成群组
- 在群组对话中使用 `@agentId` 定向发送，或直接发送广播给所有成员
- 输入 `/new` 重置当前会话历史

## Telegram 集成

```typescript
import { AgentManager, TelegramChannel, ChannelManager } from '@ok-bot/core';

const manager = new AgentManager();
await manager.createAgent({ id: 'bot', workspace: '/workspace', provider: { model: 'openai:gpt-4o' } });

const channel = new TelegramChannel(
  { token: process.env.TELEGRAM_BOT_TOKEN!, defaultAgentId: 'bot' },
  manager,
);

const channelManager = new ChannelManager();
channelManager.add(channel);
await channelManager.start();
```
