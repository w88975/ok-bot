/**
 * ok-bot server 集成测试
 * 使用 Hono 内置 test helper（不启动真实端口）
 * Agent 使用 mock 实现避免真实 LLM 调用
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from './app.js';
import type { AgentManager } from '@ok-bot/core';
import type { AgentInfo, AgentConfig } from '@ok-bot/core';
import type { OutboundMessage } from '@ok-bot/core';

// ─── Mock AgentManager ───────────────────────────────────────────────────────

/** 创建一个轻量 mock AgentManager，不涉及 Worker Thread */
function createMockManager(): AgentManager {
  const agents = new Map<string, AgentInfo & { workspace: string }>();

  return {
    listAgents: () => [...agents.values()],

    createAgent: async (config: AgentConfig) => {
      if (agents.has(config.id)) throw new Error(`Agent "${config.id}" 已存在`);
      const info = { id: config.id, workspace: config.workspace, status: 'running' as const };
      agents.set(config.id, info);
      return info;
    },

    removeAgent: async (id: string) => {
      if (!agents.has(id)) {
        const { AgentNotFoundError } = await import('@ok-bot/core');
        throw new AgentNotFoundError(id);
      }
      agents.delete(id);
    },

    chat: async (opts: { agentId: string; content: string }) => {
      if (!agents.has(opts.agentId)) {
        const { AgentNotFoundError } = await import('@ok-bot/core');
        throw new AgentNotFoundError(opts.agentId);
      }
      return {
        channel: 'http',
        chatId: 'test',
        content: `echo: ${opts.content}`,
      } satisfies OutboundMessage;
    },

    shutdown: async () => { agents.clear(); },
  } as unknown as AgentManager;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('返回 200 及服务状态', async () => {
    const app = createApp(createMockManager());
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; agents: number };
    expect(body.status).toBe('ok');
    expect(typeof body.agents).toBe('number');
  });
});

describe('GET /agents', () => {
  it('空列表', async () => {
    const app = createApp(createMockManager());
    const res = await app.request('/agents');
    expect(res.status).toBe(200);
    const body = await res.json() as { agents: unknown[] };
    expect(body.agents).toHaveLength(0);
  });
});

describe('POST /agents', () => {
  it('创建 agent 成功返回 201', async () => {
    const app = createApp(createMockManager());
    const res = await app.request('/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test-agent',
        workspace: '/tmp/workspace',
        provider: { model: 'openai-compat:GLM-4.7' },
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { agent: { id: string } };
    expect(body.agent.id).toBe('test-agent');
  });

  it('缺少必填字段返回 400', async () => {
    const app = createApp(createMockManager());
    const res = await app.request('/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'test' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /agents/:agentId', () => {
  it('删除存在的 agent 返回 204', async () => {
    const manager = createMockManager();
    const app = createApp(manager);

    // 先创建
    await app.request('/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'del-agent',
        workspace: '/tmp/w',
        provider: { model: 'openai:gpt-4o' },
      }),
    });

    const res = await app.request('/agents/del-agent', { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('删除不存在的 agent 返回 404', async () => {
    const app = createApp(createMockManager());
    const res = await app.request('/agents/nonexistent', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

describe('POST /agents/:id/chat', () => {
  it('发送消息并收到 echo 回复', async () => {
    const manager = createMockManager();
    const app = createApp(manager);

    await app.request('/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'chat-agent',
        workspace: '/tmp/w',
        provider: { model: 'openai:gpt-4o' },
      }),
    });

    const res = await app.request('/agents/chat-agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '你好' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { content: string; sessionKey: string };
    expect(body.content).toContain('你好');
    expect(body.sessionKey).toBeTruthy();
  });

  it('缺少 content 返回 400', async () => {
    const manager = createMockManager();
    const app = createApp(manager);
    await app.request('/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'x',
        workspace: '/tmp/w',
        provider: { model: 'openai:gpt-4o' },
      }),
    });
    const res = await app.request('/agents/x/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('向不存在的 agent 发送消息返回 404', async () => {
    const app = createApp(createMockManager());
    const res = await app.request('/agents/ghost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '你好' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('Bearer Token 认证', () => {
  it('设置 authToken 后无 token 请求 401', async () => {
    const app = createApp(createMockManager(), { authToken: 'secret' });
    const res = await app.request('/agents');
    expect(res.status).toBe(401);
  });

  it('设置 authToken 后 /health 免鉴权', async () => {
    const app = createApp(createMockManager(), { authToken: 'secret' });
    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });

  it('携带正确 token 可以访问', async () => {
    const app = createApp(createMockManager(), { authToken: 'secret' });
    const res = await app.request('/agents', {
      headers: { Authorization: 'Bearer secret' },
    });
    expect(res.status).toBe(200);
  });

  it('携带错误 token 返回 401', async () => {
    const app = createApp(createMockManager(), { authToken: 'secret' });
    const res = await app.request('/agents', {
      headers: { Authorization: 'Bearer wrong' },
    });
    expect(res.status).toBe(401);
  });
});

describe('404 处理', () => {
  it('未知路由返回 404 及 hint', async () => {
    const app = createApp(createMockManager());
    const res = await app.request('/unknown-path');
    expect(res.status).toBe(404);
    const body = await res.json() as { hint: string };
    expect(body.hint).toBeTruthy();
  });
});
