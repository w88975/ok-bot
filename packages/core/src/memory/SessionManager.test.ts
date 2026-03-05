/**
 * SessionManager 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SessionManager } from './SessionManager.js';

let tmpWorkspace: string;

beforeEach(async () => {
  tmpWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'ok-bot-sm-'));
});

afterEach(async () => {
  await fs.rm(tmpWorkspace, { recursive: true, force: true });
});

describe('getOrCreate', () => {
  it('首次创建返回空 session', () => {
    const sm = new SessionManager(tmpWorkspace);
    const session = sm.getOrCreate('cli:user1');
    expect(session.key).toBe('cli:user1');
    expect(session.messages).toHaveLength(0);
    expect(session.lastConsolidated).toBe(0);
  });

  it('第二次调用返回缓存的 session', () => {
    const sm = new SessionManager(tmpWorkspace);
    const s1 = sm.getOrCreate('cli:user1');
    const s2 = sm.getOrCreate('cli:user1');
    expect(s1).toBe(s2);
  });
});

describe('save & reload', () => {
  it('保存并重新加载 session', () => {
    const sm = new SessionManager(tmpWorkspace);
    const session = sm.getOrCreate('telegram:12345');
    session.messages.push({ role: 'user', content: '你好', timestamp: '2024-01-01T00:00:00' });
    session.messages.push({ role: 'assistant', content: '你好！', timestamp: '2024-01-01T00:00:01' });
    sm.save(session);

    // 失效缓存，强制从磁盘重新加载
    sm.invalidate('telegram:12345');
    const reloaded = sm.getOrCreate('telegram:12345');
    expect(reloaded.messages).toHaveLength(2);
    expect(reloaded.messages[0]?.role).toBe('user');
    expect(reloaded.messages[1]?.content).toBe('你好！');
  });

  it('clear 后 save 会删除文件', async () => {
    const sm = new SessionManager(tmpWorkspace);
    const session = sm.getOrCreate('cli:clear-test');
    session.messages.push({ role: 'user', content: '消息' });
    sm.save(session);

    session.clear();
    sm.save(session);

    sm.invalidate('cli:clear-test');
    const fresh = sm.getOrCreate('cli:clear-test');
    expect(fresh.messages).toHaveLength(0);
  });
});

describe('getHistory（滑动窗口）', () => {
  it('消息数少于 maxMessages 时返回全部', () => {
    const sm = new SessionManager(tmpWorkspace);
    const session = sm.getOrCreate('test:1');
    session.messages.push({ role: 'user', content: 'a' });
    session.messages.push({ role: 'assistant', content: 'b' });
    const history = session.getHistory(10);
    expect(history).toHaveLength(2);
  });

  it('消息数超过 maxMessages 时截取最新的', () => {
    const sm = new SessionManager(tmpWorkspace);
    const session = sm.getOrCreate('test:2');
    for (let i = 0; i < 10; i++) {
      session.messages.push({ role: 'user', content: `消息${i}` });
    }
    const history = session.getHistory(3);
    expect(history).toHaveLength(3);
    expect((history[2] as { content: string }).content).toBe('消息9');
  });
});

describe('listSessions', () => {
  it('列出已保存的 session', () => {
    const sm = new SessionManager(tmpWorkspace);
    const s1 = sm.getOrCreate('cli:a');
    s1.messages.push({ role: 'user', content: 'hi' });
    sm.save(s1);

    const sessions = sm.listSessions();
    expect(sessions.some((s) => s.sessionKey === 'cli:a')).toBe(true);
  });
});
