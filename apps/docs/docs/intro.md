---
id: intro
title: 介绍
sidebar_position: 1
---

# ok-bot

ok-bot 是一个基于 **TypeScript + Vercel AI SDK** 构建的多 agent AI 助理框架，灵感来自 [nanobot](https://github.com/HKUDS/nanobot)。

## 核心特性

- **多 agent 并行**：每个 agent 运行在独立的 Worker Thread，互相隔离
- **主流 LLM 支持**：通过 Vercel AI SDK 接入 OpenAI、Anthropic、Google、Groq 等
- **Skills 系统**：SKILL.md 文件驱动，workspace 级覆盖内置 skills
- **两层记忆**：MEMORY.md（长期事实）+ HISTORY.md（grep-searchable 日志）
- **定时任务**：at/every/cron 表达式 + IANA 时区
- **Heartbeat**：周期性任务检查，LLM tool-call 决策
- **MCP 集成**：支持 stdio/SSE 传输的 MCP servers
- **Telegram Channel**：long polling 模式
- **HTTP API**：Hono 驱动的 REST API server
- **结构化 SSE 事件**：流式接口按事件类型推送（message_start、think_*、text_delta、tool_*、message_end），前端可精确展示思考、打字、工具调用与结果

## 快速导航

- [快速开始](./quickstart) — 5 分钟运行第一个 agent
- [架构设计](./architecture) — 了解内部工作原理
- [API 参考](./api/) — 完整 TypeDoc 文档
