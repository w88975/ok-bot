---
id: server
title: HTTP Server
sidebar_position: 4
---

# ok-bot HTTP Server

`@ok-bot/server` 是一个基于 [Hono](https://hono.dev) 的 REST API 服务器，将 `AgentManager` 的能力通过 HTTP 接口暴露，支持同时运行多个 AI Agent。

## 快速启动

```bash
# 构建并启动（自动读取 ok-bot.config.json）
pnpm --filter @ok-bot/server build
node packages/server/dist/index.js

# 指定配置文件路径
OK_BOT_CONFIG=/etc/ok-bot/config.json node packages/server/dist/index.js
```

## 配置文件

服务器通过 `ok-bot.config.json`（或 `OK_BOT_CONFIG` 环境变量）加载配置。配置中定义的 agent 会在启动时自动创建。

```json
{
  "port": 3000,
  "hostname": "0.0.0.0",
  "agents": [
    {
      "id": "personal-assistant",
      "workspace": "/home/user/ok-bot-workspace",
      "provider": {
        "model": "openai-compat:GLM-4.7",
        "apiKey": "your-api-key",
        "baseURL": "https://api.z.ai/api/coding/paas/v4"
      },
      "maxIterations": 20,
      "temperature": 0.1
    }
  ]
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `port` | number | `3000` | 监听端口 |
| `hostname` | string | `0.0.0.0` | 监听地址 |
| `authToken` | string | - | Bearer Token（可选，不设置则无需鉴权） |
| `agents` | array | `[]` | 启动时自动创建的 agent 列表 |
| `managerOptions.requestTimeoutMs` | number | `300000` | 请求超时毫秒数 |

## API 参考

### `GET /health`

健康检查。

```bash
curl http://localhost:3000/health
```

```json
{ "status": "ok", "agents": 2, "uptime": 3600, "version": "0.1.0" }
```

---

### `GET /agents`

列出所有运行中的 agent。

```bash
curl http://localhost:3000/agents
```

```json
{
  "agents": [
    { "id": "personal-assistant", "workspace": "/home/user/ok-bot-workspace", "status": "running" }
  ]
}
```

---

### `POST /agents`

动态创建一个新 agent（在独立 Worker Thread 中运行）。

**最简请求**：

```bash
curl -X POST http://localhost:3000/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-agent",
    "workspace": "/home/user/my-workspace",
    "provider": {
      "model": "openai-compat:GLM-4.7",
      "apiKey": "your-api-key",
      "baseURL": "https://api.z.ai/api/coding/paas/v4"
    }
  }'
```

**带内联角色设定**（通过 `bootstrap` 字段直接传入 md 内容，会写入 workspace 对应文件）：

```bash
curl -X POST http://localhost:3000/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "code-reviewer",
    "workspace": "/home/user/code-reviewer-ws",
    "provider": { "model": "openai:gpt-4o", "apiKey": "sk-..." },
    "bootstrap": {
      "agents": "# 角色\n你是一名严格的代码审查员，专注于代码质量和安全性。",
      "soul": "你重视代码可读性、性能和安全性，发现问题时会直接指出并给出改进建议。",
      "user": "# 用户\n后端工程师，主要使用 TypeScript 和 Go。"
    }
  }'
```

`bootstrap` 字段说明：

| 字段 | 对应文件 | 说明 |
|------|----------|------|
| `bootstrap.agents` | `AGENTS.md` | agent 角色、名称、能力定义 |
| `bootstrap.soul` | `SOUL.md` | 人格、价值观、行为准则 |
| `bootstrap.user` | `USER.md` | 用户背景信息 |
| `bootstrap.tools` | `TOOLS.md` | 工具使用说明补充 |

- 只需传需要自定义的字段，未传的字段保留 workspace 中已有的文件内容
- 内容会写入 workspace 目录下对应的 `.md` 文件，之后 agent 启动时直接读取

**AgentConfig 字段**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✅ | agent 唯一标识符 |
| `workspace` | ✅ | workspace 绝对路径 |
| `provider.model` | ✅ | 模型字符串，如 `openai:gpt-4o`、`openai-compat:GLM-4.7` |
| `provider.apiKey` | - | API Key |
| `provider.baseURL` | - | 自定义 API 端点（OpenAI 兼容协议） |
| `maxIterations` | - | 最大工具调用轮次（默认 40） |
| `temperature` | - | 温度参数（默认 0.1） |
| `restrictToWorkspace` | - | 文件操作是否限制在 workspace 内 |

**响应** `201 Created`：

```json
{ "agent": { "id": "my-agent", "workspace": "...", "status": "running" } }
```

---

### `DELETE /agents/:agentId`

停止并移除指定 agent（有序关闭 Worker Thread）。

```bash
curl -X DELETE http://localhost:3000/agents/my-agent
```

响应 `204 No Content`。

---

### `POST /agents/:agentId/chat`

向指定 agent 发送消息，**同步等待**回复。

```bash
curl -X POST http://localhost:3000/agents/my-agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "content": "帮我查看工作目录下有哪些文件",
    "sessionKey": "user-123"
  }'
```

**请求体**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `content` | ✅ | 消息内容 |
| `sessionKey` | - | 会话 key，相同 key 共享历史（默认 `http:<agentId>`） |
| `channel` | - | 渠道标识（默认 `http`） |
| `chatId` | - | 对话 ID |

**响应** `200 OK`：

```json
{ "content": "工作目录下有以下文件：...", "sessionKey": "user-123" }
```

---

### `GET /agents/:agentId/sessions`

列出指定 agent 的所有会话。

---

### `DELETE /agents/:agentId/sessions/:sessionKey`

清空指定会话的历史记录。

---

### `GET /agents/:agentId/cron`

列出 agent 的所有定时任务。

---

### `POST /agents/:agentId/cron`

添加定时任务。

```json
{
  "name": "每日早报",
  "message": "请生成今日工作摘要",
  "schedule": {
    "kind": "cron",
    "expr": "0 9 * * 1-5",
    "tz": "Asia/Shanghai"
  }
}
```

---

### `DELETE /agents/:agentId/cron/:jobId`

删除定时任务。

## 多 Agent 并行示例

```bash
# 创建个人助理
curl -X POST http://localhost:3000/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "assistant",
    "workspace": "/home/user/assistant-ws",
    "provider": { "model": "openai-compat:GLM-4.7", "apiKey": "...", "baseURL": "..." },
    "bootstrap": {
      "agents": "你是我的个人助理，帮我管理日程和任务。",
      "user": "我是一名产品经理，主要关注用户体验。"
    }
  }'

# 创建代码助手
curl -X POST http://localhost:3000/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "coder",
    "workspace": "/home/user/coder-ws",
    "provider": { "model": "openai:gpt-4o", "apiKey": "sk-..." },
    "bootstrap": {
      "agents": "你是一名专业的全栈工程师，擅长 TypeScript 和系统设计。"
    }
  }'

# 分别与两个 agent 对话
curl -X POST http://localhost:3000/agents/assistant/chat \
  -H "Content-Type: application/json" -d '{"content": "今天有什么安排？"}'

curl -X POST http://localhost:3000/agents/coder/chat \
  -H "Content-Type: application/json" -d '{"content": "帮我 review 这段代码"}'
```

两个 agent 运行在独立的 Worker Thread 中，互不干扰，各自有独立的记忆和会话历史。

---

## WebSocket Channel

服务器同时提供 WebSocket 端点 `/ws`，支持实时双向通信、群组聊天和在线创建 agent。

### 连接

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
// 若启用了 authToken，通过 ?token= 传入
// const ws = new WebSocket('ws://localhost:3000/ws?token=your-secret');
```

连接成功后服务器自动推送：
1. `connected` — 包含分配的 `clientId`
2. `agent-status` — 当前所有 agent 状态列表

### 消息协议

所有消息均为 JSON 格式。

#### 客户端 → 服务器

| 类型 | 描述 |
|------|------|
| `chat` | 向单个 agent 发送消息 |
| `group-chat` | 向群组发送消息（支持 @mention） |
| `create-agent` | 创建新 agent |
| `list-agents` | 查询 agent 列表 |
| `create-group` | 创建群组 |
| `update-group` | 更新群组成员 |

#### 单聊

```json
{
  "type": "chat",
  "agentId": "my-agent",
  "content": "你好，今天天气如何？",
  "sessionKey": "web:my-agent"
}
```

服务器回复：
```json
{
  "type": "message",
  "agentId": "my-agent",
  "content": "...",
  "sessionKey": "web:my-agent"
}
```

#### 群组聊天

```json
{
  "type": "group-chat",
  "groupId": "my-group",
  "content": "@agent-a 帮我写一首诗",
  "mentions": ["agent-a"]
}
```

- `mentions` 为空时，广播给群组所有成员
- 每个 agent 的回复独立推送，`groupId` 字段标识所属群组

#### 创建群组

```json
{
  "type": "create-group",
  "groupId": "my-group",
  "name": "创意工作室",
  "agentIds": ["agent-a", "agent-b"]
}
```

#### 创建 Agent

```json
{
  "type": "create-agent",
  "config": {
    "id": "new-agent",
    "workspace": "/path/to/workspace",
    "provider": { "model": "openai:gpt-4o", "apiKey": "sk-..." }
  },
  "bootstrap": {
    "soul": "# 我是一个乐于助人的助理\n...",
    "agents": "# Agent 描述\n..."
  }
}
```

#### 服务器 → 客户端

| 类型 | 触发时机 |
|------|----------|
| `connected` | 握手成功 |
| `agent-status` | 连接时 / agent 变更时广播 |
| `message` | agent 回复 |
| `agent-created` | agent 创建成功 |
| `group-created` | 群组创建成功 |
| `group-status` | 群组成员变更 |
| `group-dissolved` | 群组成员不足 2 人时自动解散 |
| `error` | 错误通知 |

---

## Web UI

服务器内置了一个 React 前端界面，提供可视化的 agent 管理和聊天体验。

### 构建与访问

```bash
# 构建 Web UI（生成静态资源到 packages/web-ui/dist/）
pnpm build:ui

# 启动服务器（自动提供 Web UI）
node packages/server/dist/index.js
```

访问 `http://localhost:3000/app/` 打开 Web UI。

### 功能

- **侧边栏**：显示所有 agent 及状态，支持一键创建 agent
- **单聊**：与指定 agent 进行对话（输入 `/new` 开启新会话）
- **群组聊天**：创建群组后，消息广播给所有成员；支持 `@agentId` 定向发送
- **暗色模式**：自动跟随系统偏好
- **实时连接状态**：顶部显示 WebSocket 连接状态，断线自动重连

### 禁用 Web UI / WebSocket

```json
{
  "port": 3000,
  "webChannel": false,
  "webUI": false
}
```
