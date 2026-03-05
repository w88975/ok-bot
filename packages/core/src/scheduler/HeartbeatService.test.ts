/**
 * HeartbeatService 测试
 * 使用 MockLanguageModelV1 模拟 skip/run 决策
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HeartbeatService } from './HeartbeatService.js';

let tmpWorkspace: string;

beforeEach(async () => {
  tmpWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'ok-bot-hb-'));
});

afterEach(async () => {
  await fs.rm(tmpWorkspace, { recursive: true, force: true });
});

describe('triggerNow', () => {
  it('HEARTBEAT.md 不存在时返回 null', async () => {
    const svc = new HeartbeatService({
      workspace: tmpWorkspace,
      provider: {} as never,
      model: 'mock:model',
    });
    const result = await svc.triggerNow();
    expect(result).toBeNull();
  });

  it('HEARTBEAT.md 为空时返回 null', async () => {
    await fs.writeFile(path.join(tmpWorkspace, 'HEARTBEAT.md'), '', 'utf-8');
    const svc = new HeartbeatService({
      workspace: tmpWorkspace,
      provider: {} as never,
      model: 'mock:model',
    });
    const result = await svc.triggerNow();
    expect(result).toBeNull();
  });
});

describe('start/stop', () => {
  it('disabled 时不启动', () => {
    const svc = new HeartbeatService({
      workspace: tmpWorkspace,
      provider: {} as never,
      model: 'mock:model',
      enabled: false,
    });
    // 不应报错
    svc.start();
    svc.stop();
  });
});
