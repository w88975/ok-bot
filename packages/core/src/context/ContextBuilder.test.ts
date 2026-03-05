/**
 * ContextBuilder 单元测试
 * 验证 system prompt 分层结构和 runtime context 不持久化行为
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ContextBuilder, RUNTIME_CONTEXT_TAG } from './ContextBuilder.js';

let tmpWorkspace: string;

beforeEach(async () => {
  tmpWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'ok-bot-ctx-'));
});

afterEach(async () => {
  await fs.rm(tmpWorkspace, { recursive: true, force: true });
});

describe('buildSystemPrompt', () => {
  it('包含 identity 节', async () => {
    const builder = new ContextBuilder({ workspace: tmpWorkspace, botName: 'test-bot' });
    const prompt = await builder.buildSystemPrompt();
    expect(prompt).toContain('test-bot');
    expect(prompt).toContain('Workspace');
    expect(prompt).toContain(tmpWorkspace);
  });

  it('加载 bootstrap 文件（SOUL.md）', async () => {
    await fs.writeFile(path.join(tmpWorkspace, 'SOUL.md'), '# Soul\n我是测试 agent', 'utf-8');
    const builder = new ContextBuilder({ workspace: tmpWorkspace });
    const prompt = await builder.buildSystemPrompt();
    expect(prompt).toContain('我是测试 agent');
    expect(prompt).toContain('SOUL.md');
  });

  it('不存在 bootstrap 文件时不报错', async () => {
    const builder = new ContextBuilder({ workspace: tmpWorkspace });
    await expect(builder.buildSystemPrompt()).resolves.not.toThrow();
  });

  it('存在 MEMORY.md 时注入记忆节', async () => {
    await fs.mkdir(path.join(tmpWorkspace, 'memory'), { recursive: true });
    await fs.writeFile(
      path.join(tmpWorkspace, 'memory', 'MEMORY.md'),
      '# 用户信息\n- 名字：张三',
      'utf-8',
    );
    const builder = new ContextBuilder({ workspace: tmpWorkspace });
    const prompt = await builder.buildSystemPrompt();
    expect(prompt).toContain('张三');
    expect(prompt).toContain('Memory');
  });

  it('各节之间用 --- 分隔', async () => {
    await fs.writeFile(path.join(tmpWorkspace, 'SOUL.md'), '# Soul\n内容', 'utf-8');
    const builder = new ContextBuilder({ workspace: tmpWorkspace });
    const prompt = await builder.buildSystemPrompt();
    expect(prompt).toContain('\n\n---\n\n');
  });
});

describe('buildMessages', () => {
  it('消息顺序：system → history → runtime_context → user', async () => {
    const builder = new ContextBuilder({ workspace: tmpWorkspace });
    const history = [{ role: 'user' as const, content: '历史消息' }];
    const messages = await builder.buildMessages({
      history,
      currentMessage: '当前问题',
      channel: 'telegram',
      chatId: '12345',
    });

    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.role).toBe('user');
    expect(messages[1]?.content).toBe('历史消息');
    // runtime context
    const runtimeMsg = messages[2];
    expect(runtimeMsg?.role).toBe('user');
    expect(String(runtimeMsg?.content)).toContain(RUNTIME_CONTEXT_TAG);
    // user message
    expect(messages[3]?.role).toBe('user');
    expect(messages[3]?.content).toBe('当前问题');
  });

  it('runtime context 包含时间和频道信息', async () => {
    const builder = new ContextBuilder({ workspace: tmpWorkspace });
    const messages = await builder.buildMessages({
      history: [],
      currentMessage: '测试',
      channel: 'cli',
      chatId: 'direct',
    });

    const runtimeMsg = messages.find(
      (m) => typeof m.content === 'string' && m.content.startsWith(RUNTIME_CONTEXT_TAG),
    );
    expect(runtimeMsg).toBeDefined();
    expect(String(runtimeMsg?.content)).toContain('当前时间');
    expect(String(runtimeMsg?.content)).toContain('cli');
  });
});
