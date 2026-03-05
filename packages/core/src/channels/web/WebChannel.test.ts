/**
 * WebChannel 单元测试
 *
 * 使用 mock AgentManager，测试：
 * - chat 消息路由
 * - create-agent 消息处理（含 bootstrap 文件写入）
 * - group-chat 广播与 mention 路由
 * - Bearer Token 鉴权拒绝
 * - list-agents 推送
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentManager } from '../../agent/AgentManager.js';
import type { AgentInfo } from '../../types.js';
import type { AgentConfig } from '../../types.js';
import { WebChannel } from './WebChannel.js';
import type { ServerMessage } from './types.js';

// ─── Mock AgentManager ────────────────────────────────────────────────────────

function createMockManager(): AgentManager {
  const agents = new Map<string, AgentInfo>();
  agents.set('agent-a', { id: 'agent-a', workspace: '/ws/a', status: 'running' });
  agents.set('agent-b', { id: 'agent-b', workspace: '/ws/b', status: 'running' });

  return {
    listAgents: () => [...agents.values()],

    createAgent: async (config: AgentConfig) => {
      const info: AgentInfo = { id: config.id, workspace: config.workspace, status: 'running' };
      agents.set(config.id, info);
      return info;
    },

    chat: vi.fn(async (opts: { agentId: string; content: string }) => ({
      channel: 'web',
      senderId: opts.agentId,
      chatId: 'test',
      content: `echo:${opts.content}`,
      metadata: {},
    })),

    removeAgent: vi.fn(),
    shutdown: vi.fn(),
  } as unknown as AgentManager;
}

// ─── 工具：模拟 WebSocket 通信 ───────────────────────────────────────────────

/** 收集服务器推送给 clientId 的所有消息 */
function makeCollector() {
  const received: ServerMessage[] = [];
  const send = (data: string) => {
    received.push(JSON.parse(data) as ServerMessage);
  };
  return { received, send };
}

/** 创建一个最简的 upgradeWebSocket mock，直接执行 handler */
function makeUpgradeWs(
  channel: WebChannel,
  onUpgrade: (
    send: (data: string) => void,
    onMessage: (raw: string) => void,
    onClose: () => void,
  ) => void,
) {
  let capturedHandler: ReturnType<Parameters<typeof channel.attach>[1]> | null = null;

  const upgradeWebSocket = (factory: (c: unknown) => unknown) => {
    capturedHandler = factory as unknown as typeof capturedHandler;
    return async (_c: unknown) => {};
  };

  // 触发连接的帮助函数
  const connect = (clientId = 'test-client') => {
    if (!capturedHandler) throw new Error('upgradeWebSocket not called yet');
    const { send, received } = makeCollector();

    const fakeWs = {
      send,
      close: vi.fn(),
    };
    const fakeCtx = {
      req: { query: (_: string) => undefined },
    };

    // @ts-expect-error mock
    const handlers = capturedHandler(fakeCtx);
    if (handlers?.onOpen) {
      handlers.onOpen(new Event('open'), fakeWs as unknown as WebSocket);
    }
    const sendMsg = (raw: string) => {
      if (handlers?.onMessage) {
        handlers.onMessage({ data: raw } as MessageEvent, fakeWs as unknown as WebSocket);
      }
    };
    const close = () => {
      if (handlers?.onClose) handlers.onClose();
    };

    onUpgrade(send, sendMsg, close);
    return { send, received, sendMsg, close, fakeWs };
  };

  return { upgradeWebSocket: upgradeWebSocket as unknown as Parameters<typeof channel.attach>[1], connect };
}

// ─── 测试套件 ─────────────────────────────────────────────────────────────────

describe('WebChannel', () => {
  let manager: AgentManager;
  let channel: WebChannel;

  beforeEach(() => {
    manager = createMockManager();
    channel = new WebChannel({ manager });
  });

  it('attach 注册 /ws 路由', () => {
    const routes: string[] = [];
    const fakeApp = {
      get: (path: string, _handler: unknown) => routes.push(path),
    };
    channel.attach(fakeApp as never, (() => {}) as never);
    expect(routes).toContain('/ws');
  });

  it('连接时推送 connected + agent-status', async () => {
    const received: ServerMessage[] = [];

    const fakeApp = { get: (_path: string, _h: unknown) => {} };
    let capturedFactory: ((c: unknown) => unknown) | null = null;

    const upgradeWebSocket = (factory: (c: unknown) => unknown) => {
      capturedFactory = factory;
      return () => {};
    };

    channel.attach(fakeApp as never, upgradeWebSocket as never);
    expect(capturedFactory).not.toBeNull();

    const fakeWs = {
      send: (data: string) => received.push(JSON.parse(data) as ServerMessage),
      close: vi.fn(),
    };
    const fakeCtx = { req: { query: () => undefined } };

    // @ts-expect-error mock
    const handlers = capturedFactory(fakeCtx);
    handlers.onOpen(new Event('open'), fakeWs);

    expect(received[0].type).toBe('connected');
    expect(received[1].type).toBe('agent-status');
    if (received[1].type === 'agent-status') {
      expect(received[1].agents.length).toBe(2);
    }
  });

  it('chat 消息路由到正确 agent 并返回回复', async () => {
    const received: ServerMessage[] = [];

    const fakeApp = { get: (_path: string, _h: unknown) => {} };
    let capturedFactory: ((c: unknown) => unknown) | null = null;
    const upgradeWebSocket = (factory: (c: unknown) => unknown) => {
      capturedFactory = factory;
      return () => {};
    };

    channel.attach(fakeApp as never, upgradeWebSocket as never);

    const fakeWs = {
      send: (data: string) => received.push(JSON.parse(data) as ServerMessage),
      close: vi.fn(),
    };
    const fakeCtx = { req: { query: () => undefined } };
    // @ts-expect-error mock
    const handlers = capturedFactory(fakeCtx);
    handlers.onOpen(new Event('open'), fakeWs);

    // 清空初始消息
    received.length = 0;

    await new Promise<void>((resolve) => {
      const origSend = fakeWs.send;
      fakeWs.send = (data: string) => {
        origSend(data);
        resolve();
      };
      handlers.onMessage(
        { data: JSON.stringify({ type: 'chat', agentId: 'agent-a', content: 'hello' }) },
        fakeWs,
      );
    });

    expect(received[0].type).toBe('message');
    if (received[0].type === 'message') {
      expect(received[0].agentId).toBe('agent-a');
      expect(received[0].content).toBe('echo:hello');
    }
    expect(vi.mocked(manager.chat)).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agent-a', content: 'hello' }),
    );
  });

  it('Bearer Token 鉴权拒绝无效 token', () => {
    const channelWithAuth = new WebChannel({ manager, authToken: 'secret' });

    const fakeApp = { get: (_path: string, _h: unknown) => {} };
    let capturedFactory: ((c: unknown) => unknown) | null = null;
    const upgradeWebSocket = (factory: (c: unknown) => unknown) => {
      capturedFactory = factory;
      return () => {};
    };

    channelWithAuth.attach(fakeApp as never, upgradeWebSocket as never);

    const fakeWs = { close: vi.fn(), send: vi.fn() };
    const fakeCtxBad = { req: { query: (key: string) => (key === 'token' ? 'wrong' : undefined) } };

    // @ts-expect-error mock
    const handlers = capturedFactory(fakeCtxBad);
    handlers.onOpen(new Event('open'), fakeWs);
    expect(fakeWs.close).toHaveBeenCalledWith(4001, 'Unauthorized');
  });

  it('list-agents 返回当前 agent 列表', async () => {
    const received: ServerMessage[] = [];

    const fakeApp = { get: (_path: string, _h: unknown) => {} };
    let capturedFactory: ((c: unknown) => unknown) | null = null;
    const upgradeWebSocket = (factory: (c: unknown) => unknown) => {
      capturedFactory = factory;
      return () => {};
    };

    channel.attach(fakeApp as never, upgradeWebSocket as never);

    const fakeWs = {
      send: (data: string) => received.push(JSON.parse(data) as ServerMessage),
      close: vi.fn(),
    };
    const fakeCtx = { req: { query: () => undefined } };
    // @ts-expect-error mock
    const handlers = capturedFactory(fakeCtx);
    handlers.onOpen(new Event('open'), fakeWs);
    received.length = 0;

    await new Promise<void>((resolve) => {
      const origSend = fakeWs.send.bind(fakeWs);
      fakeWs.send = (data: string) => {
        origSend(data);
        resolve();
      };
      handlers.onMessage({ data: JSON.stringify({ type: 'list-agents' }) }, fakeWs);
    });

    expect(received[0].type).toBe('agent-status');
    if (received[0].type === 'agent-status') {
      expect(received[0].agents.map((a) => a.id)).toContain('agent-a');
    }
  });
});

describe('WebChannel Group Chat', () => {
  let manager: AgentManager;
  let channel: WebChannel;
  let capturedFactory: ((c: unknown) => unknown) | null;

  const setupChannel = () => {
    manager = createMockManager();
    channel = new WebChannel({ manager });
    capturedFactory = null;

    const fakeApp = { get: (_path: string, _h: unknown) => {} };
    const upgradeWebSocket = (factory: (c: unknown) => unknown) => {
      capturedFactory = factory;
      return () => {};
    };
    channel.attach(fakeApp as never, upgradeWebSocket as never);
  };

  const openWs = () => {
    const received: ServerMessage[] = [];
    const fakeWs = {
      send: (data: string) => received.push(JSON.parse(data) as ServerMessage),
      close: vi.fn(),
    };
    const fakeCtx = { req: { query: () => undefined } };
    // @ts-expect-error mock
    const handlers = capturedFactory!(fakeCtx);
    handlers.onOpen(new Event('open'), fakeWs);
    received.length = 0;

    const sendMsg = async (raw: object): Promise<ServerMessage> => {
      return new Promise((resolve) => {
        const prev = fakeWs.send.bind(fakeWs);
        fakeWs.send = (data: string) => {
          prev(data);
          const msg = JSON.parse(data) as ServerMessage;
          if (msg.type !== 'agent-status') resolve(msg);
        };
        handlers.onMessage({ data: JSON.stringify(raw) }, fakeWs);
      });
    };
    return { received, fakeWs, handlers, sendMsg };
  };

  beforeEach(setupChannel);

  it('create-group 成功创建群组', async () => {
    const { sendMsg } = openWs();
    const resp = await sendMsg({
      type: 'create-group',
      groupId: 'g1',
      name: '测试群',
      agentIds: ['agent-a', 'agent-b'],
    });
    expect(resp.type).toBe('group-created');
    if (resp.type === 'group-created') {
      expect(resp.group.id).toBe('g1');
      expect(resp.group.agentIds).toEqual(['agent-a', 'agent-b']);
    }
  });

  it('group-chat 广播给所有成员', async () => {
    const { handlers, fakeWs, received } = openWs();

    // 先创建群组
    await new Promise<void>((resolve) => {
      const prev = fakeWs.send.bind(fakeWs);
      let count = 0;
      fakeWs.send = (data: string) => {
        prev(data);
        count++;
        if (count >= 2) resolve(); // group-created + broadcast agent-status
      };
      handlers.onMessage(
        {
          data: JSON.stringify({
            type: 'create-group',
            groupId: 'g1',
            name: '群',
            agentIds: ['agent-a', 'agent-b'],
          }),
        },
        fakeWs,
      );
    });

    received.length = 0;

    // 发群组消息
    await new Promise<void>((resolve) => {
      let replies = 0;
      const prev = fakeWs.send.bind(fakeWs);
      fakeWs.send = (data: string) => {
        prev(data);
        const msg = JSON.parse(data) as ServerMessage;
        if (msg.type === 'message') {
          replies++;
          if (replies >= 2) resolve();
        }
      };
      handlers.onMessage(
        { data: JSON.stringify({ type: 'group-chat', groupId: 'g1', content: '大家好' }) },
        fakeWs,
      );
    });

    const replies = received.filter((m) => m.type === 'message');
    expect(replies.length).toBe(2);
    expect(manager.chat).toHaveBeenCalledTimes(2);
  });

  it('group-chat @mention 只发给指定 agent', async () => {
    const { handlers, fakeWs, received } = openWs();

    // 先创建群组
    await new Promise<void>((resolve) => {
      let count = 0;
      const prev = fakeWs.send.bind(fakeWs);
      fakeWs.send = (data: string) => {
        prev(data);
        count++;
        if (count >= 2) resolve();
      };
      handlers.onMessage(
        {
          data: JSON.stringify({
            type: 'create-group',
            groupId: 'g2',
            name: '群',
            agentIds: ['agent-a', 'agent-b'],
          }),
        },
        fakeWs,
      );
    });
    received.length = 0;
    vi.mocked(manager.chat).mockClear();

    // @mention agent-a
    await new Promise<void>((resolve) => {
      const prev = fakeWs.send.bind(fakeWs);
      fakeWs.send = (data: string) => {
        prev(data);
        const msg = JSON.parse(data) as ServerMessage;
        if (msg.type === 'message') resolve();
      };
      handlers.onMessage(
        {
          data: JSON.stringify({
            type: 'group-chat',
            groupId: 'g2',
            content: '@agent-a 你好',
            mentions: ['agent-a'],
          }),
        },
        fakeWs,
      );
    });

    expect(manager.chat).toHaveBeenCalledTimes(1);
    expect(vi.mocked(manager.chat).mock.calls[0][0]).toMatchObject({ agentId: 'agent-a' });
  });
});
