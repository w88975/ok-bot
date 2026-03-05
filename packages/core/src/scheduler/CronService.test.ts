/**
 * CronService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CronService } from './CronService.js';

let tmpWorkspace: string;

beforeEach(async () => {
  tmpWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'ok-bot-cron-'));
  vi.useFakeTimers();
});

afterEach(async () => {
  vi.useRealTimers();
  await fs.rm(tmpWorkspace, { recursive: true, force: true });
});

describe('addJob', () => {
  it('添加 every 类型任务并持久化', async () => {
    const svc = new CronService(tmpWorkspace);
    svc.start();
    const job = svc.addJob({
      name: '测试任务',
      schedule: { kind: 'every', everyMs: 60_000 },
      message: '定期执行',
    });
    expect(job.id).toBeTruthy();
    expect(job.name).toBe('测试任务');

    // 验证持久化到 cron.json
    const content = await fs.readFile(path.join(tmpWorkspace, 'cron.json'), 'utf-8');
    const data = JSON.parse(content);
    expect(data.jobs).toHaveLength(1);
    svc.stop();
  });

  it('添加 at 类型任务', () => {
    const svc = new CronService(tmpWorkspace);
    svc.start();
    const futureMs = Date.now() + 60_000;
    const job = svc.addJob({
      name: 'at 任务',
      schedule: { kind: 'at', atMs: futureMs },
      message: '一次性任务',
    });
    expect(job.state.nextRunAtMs).toBe(futureMs);
    svc.stop();
  });

  it('tz 参数仅对 cron 类型有效', () => {
    const svc = new CronService(tmpWorkspace);
    svc.start();
    expect(() =>
      svc.addJob({
        name: '错误任务',
        schedule: { kind: 'every', everyMs: 3600_000, tz: 'Asia/Shanghai' },
        message: '测试',
      }),
    ).toThrow('tz 参数仅对 cron 类型调度有效');
    svc.stop();
  });
});

describe('removeJob', () => {
  it('删除任务返回 true', () => {
    const svc = new CronService(tmpWorkspace);
    svc.start();
    const job = svc.addJob({
      name: '待删除',
      schedule: { kind: 'every', everyMs: 3600_000 },
      message: '测试',
    });
    expect(svc.removeJob(job.id)).toBe(true);
    expect(svc.listJobs()).toHaveLength(0);
    svc.stop();
  });

  it('删除不存在的任务返回 false', () => {
    const svc = new CronService(tmpWorkspace);
    svc.start();
    expect(svc.removeJob('nonexistent')).toBe(false);
    svc.stop();
  });
});

describe('listJobs', () => {
  it('按 nextRunAt 升序排列', () => {
    const svc = new CronService(tmpWorkspace);
    svc.start();
    svc.addJob({ name: 'a', schedule: { kind: 'every', everyMs: 7200_000 }, message: 'a' });
    svc.addJob({ name: 'b', schedule: { kind: 'every', everyMs: 3600_000 }, message: 'b' });
    const jobs = svc.listJobs();
    expect(jobs[0]?.name).toBe('b');
    expect(jobs[1]?.name).toBe('a');
    svc.stop();
  });
});

describe('at 任务执行', () => {
  it('at 任务到期后执行并禁用', async () => {
    const executed: string[] = [];
    const svc = new CronService(tmpWorkspace, async (job) => {
      executed.push(job.name);
      return null;
    });
    svc.start();

    svc.addJob({
      name: 'at-job',
      schedule: { kind: 'at', atMs: Date.now() + 100 },
      message: '一次性',
    });

    // 推进时间
    await vi.advanceTimersByTimeAsync(200);

    expect(executed).toContain('at-job');
    // at 任务执行后被禁用
    const jobs = svc.listJobs(true);
    const job = jobs.find((j) => j.name === 'at-job');
    expect(job?.enabled).toBe(false);
    svc.stop();
  });
});

describe('cron 表达式 + 时区', () => {
  it('有效的 cron 表达式能计算下次执行时间', () => {
    const svc = new CronService(tmpWorkspace);
    svc.start();
    const job = svc.addJob({
      name: 'cron-job',
      schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' },
      message: '每天早上9点',
    });
    expect(job.state.nextRunAtMs).toBeGreaterThan(Date.now());
    svc.stop();
  });
});

describe('重启恢复', () => {
  it('重启后从 cron.json 恢复任务', () => {
    const svc1 = new CronService(tmpWorkspace);
    svc1.start();
    svc1.addJob({ name: '持久化任务', schedule: { kind: 'every', everyMs: 3600_000 }, message: 'test' });
    svc1.stop();

    // 创建新实例，模拟重启
    const svc2 = new CronService(tmpWorkspace);
    svc2.start();
    const jobs = svc2.listJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.name).toBe('持久化任务');
    svc2.stop();
  });
});
