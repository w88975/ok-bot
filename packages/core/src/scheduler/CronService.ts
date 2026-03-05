/**
 * CronService — 定时任务服务
 *
 * 支持三种调度类型：
 * - at：指定时间戳执行一次
 * - every：固定间隔重复
 * - cron：cron 表达式 + IANA 时区
 *
 * 使用 timer 链式调度（精准单 timer，不轮询）
 * 任务持久化到 workspace/cron.json
 */

import fs from 'node:fs';
import path from 'node:path';
import cronParser from 'cron-parser';
const { parseExpression } = cronParser;

/** 调度类型 */
export type ScheduleKind = 'at' | 'every' | 'cron';

/** 调度配置 */
export interface CronSchedule {
  kind: ScheduleKind;
  /** at 模式：执行时间戳（毫秒） */
  atMs?: number;
  /** every 模式：间隔毫秒数 */
  everyMs?: number;
  /** cron 模式：cron 表达式（如 "0 9 * * 1-5"） */
  expr?: string;
  /** cron 模式：IANA 时区（如 "Asia/Shanghai"） */
  tz?: string;
}

/** 任务载荷 */
export interface CronPayload {
  /** 发给 agent 的消息内容（agent 执行或直接发送给用户） */
  message: string;
  /** 是否直接转发给用户（不经过 agent loop） */
  deliver?: boolean;
  /** 目标渠道（deliver=true 时使用） */
  channel?: string;
  /** 目标 chatId（deliver=true 时使用） */
  to?: string;
}

/** 任务状态 */
export interface CronJobState {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: 'ok' | 'error';
  lastError?: string;
}

/** 完整的 cron 任务定义 */
export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
  state: CronJobState;
  createdAtMs: number;
  updatedAtMs: number;
  /** 一次性任务执行后是否自动删除 */
  deleteAfterRun?: boolean;
}

/** cron.json 文件结构 */
interface CronStore {
  version: number;
  jobs: CronJob[];
}

/**
 * 计算下次执行时间（毫秒时间戳）
 */
function computeNextRun(schedule: CronSchedule, nowMs: number): number | undefined {
  if (schedule.kind === 'at') {
    return schedule.atMs && schedule.atMs > nowMs ? schedule.atMs : undefined;
  }

  if (schedule.kind === 'every') {
    return schedule.everyMs && schedule.everyMs > 0 ? nowMs + schedule.everyMs : undefined;
  }

  if (schedule.kind === 'cron' && schedule.expr) {
    try {
      const options = schedule.tz ? { tz: schedule.tz } : {};
      const iter = parseExpression(schedule.expr, {
        currentDate: new Date(nowMs),
        ...options,
      });
      return iter.next().getTime();
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/**
 * 执行任务的回调类型
 * @param job 要执行的任务
 * @returns 执行结果文本（可选）
 */
export type OnJobExecute = (job: CronJob) => Promise<string | null | undefined>;

/**
 * CronService — 定时任务管理与执行
 */
export class CronService {
  private readonly storeFile: string;
  private store: CronStore | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  readonly onJob?: OnJobExecute;

  constructor(workspace: string, onJob?: OnJobExecute) {
    this.storeFile = path.join(workspace, 'cron.json');
    this.onJob = onJob;
  }

  /** 启动 cron 服务 */
  start(): void {
    if (this.running) return;
    this.running = true;
    this._loadStore();
    this._recomputeNextRuns();
    this._saveStore();
    this._armTimer();
    console.info(`[CronService] 已启动，共 ${this._getStore().jobs.length} 个任务`);
  }

  /** 停止 cron 服务 */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  // ─── 公开 API ──────────────────────────────────────────────────────────────

  /**
   * 添加新任务
   */
  addJob(options: {
    name: string;
    schedule: CronSchedule;
    message: string;
    deliver?: boolean;
    channel?: string;
    to?: string;
    deleteAfterRun?: boolean;
  }): CronJob {
    // 验证时区仅对 cron 类型有效
    if (options.schedule.tz && options.schedule.kind !== 'cron') {
      throw new Error('tz 参数仅对 cron 类型调度有效');
    }

    const now = Date.now();
    const job: CronJob = {
      id: Math.random().toString(36).slice(2, 10),
      name: options.name,
      enabled: true,
      schedule: options.schedule,
      payload: {
        message: options.message,
        deliver: options.deliver,
        channel: options.channel,
        to: options.to,
      },
      state: { nextRunAtMs: computeNextRun(options.schedule, now) },
      createdAtMs: now,
      updatedAtMs: now,
      deleteAfterRun: options.deleteAfterRun,
    };

    this._getStore().jobs.push(job);
    this._saveStore();
    this._armTimer();

    console.info(`[CronService] 添加任务 '${job.name}' (${job.id})`);
    return job;
  }

  /**
   * 删除任务
   * @returns 是否成功删除
   */
  removeJob(jobId: string): boolean {
    const store = this._getStore();
    const before = store.jobs.length;
    store.jobs = store.jobs.filter((j) => j.id !== jobId);
    const removed = store.jobs.length < before;
    if (removed) {
      this._saveStore();
      this._armTimer();
    }
    return removed;
  }

  /**
   * 启用或禁用任务
   */
  enableJob(jobId: string, enabled: boolean): CronJob | null {
    const job = this._getStore().jobs.find((j) => j.id === jobId);
    if (!job) return null;

    job.enabled = enabled;
    job.updatedAtMs = Date.now();
    job.state.nextRunAtMs = enabled ? computeNextRun(job.schedule, Date.now()) : undefined;
    this._saveStore();
    this._armTimer();
    return job;
  }

  /**
   * 手动触发任务
   */
  async runJob(jobId: string, force = false): Promise<boolean> {
    const job = this._getStore().jobs.find((j) => j.id === jobId);
    if (!job || (!force && !job.enabled)) return false;
    await this._executeJob(job);
    this._saveStore();
    this._armTimer();
    return true;
  }

  /**
   * 列出所有任务（默认只显示启用的）
   */
  listJobs(includeDisabled = false): CronJob[] {
    const store = this._getStore();
    const jobs = includeDisabled ? store.jobs : store.jobs.filter((j) => j.enabled);
    return jobs.slice().sort((a, b) => (a.state.nextRunAtMs ?? Infinity) - (b.state.nextRunAtMs ?? Infinity));
  }

  /** 获取服务状态摘要 */
  status(): { running: boolean; jobCount: number; nextWakeAtMs?: number } {
    return {
      running: this.running,
      jobCount: this._getStore().jobs.length,
      nextWakeAtMs: this._getNextWakeMs(),
    };
  }

  // ─── 私有方法 ──────────────────────────────────────────────────────────────

  private _getStore(): CronStore {
    return this.store!;
  }

  private _loadStore(): void {
    if (!fs.existsSync(this.storeFile)) {
      this.store = { version: 1, jobs: [] };
      return;
    }
    try {
      const data = JSON.parse(fs.readFileSync(this.storeFile, 'utf-8')) as CronStore;
      this.store = { version: data.version ?? 1, jobs: data.jobs ?? [] };
    } catch {
      this.store = { version: 1, jobs: [] };
    }
  }

  private _saveStore(): void {
    if (!this.store) return;
    const dir = path.dirname(this.storeFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.storeFile, JSON.stringify(this.store, null, 2), 'utf-8');
  }

  private _recomputeNextRuns(): void {
    const now = Date.now();
    for (const job of this._getStore().jobs) {
      if (job.enabled) {
        job.state.nextRunAtMs = computeNextRun(job.schedule, now);
      }
    }
  }

  private _getNextWakeMs(): number | undefined {
    const times = this._getStore().jobs
      .filter((j) => j.enabled && j.state.nextRunAtMs)
      .map((j) => j.state.nextRunAtMs!);
    return times.length > 0 ? Math.min(...times) : undefined;
  }

  private _armTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    if (!this.running) return;

    const nextWake = this._getNextWakeMs();
    if (!nextWake) return;

    const delay = Math.max(0, nextWake - Date.now());
    this.timer = setTimeout(() => void this._onTimer(), delay);
  }

  private async _onTimer(): Promise<void> {
    if (!this.running || !this.store) return;

    const now = Date.now();
    const dueJobs = this.store.jobs.filter(
      (j) => j.enabled && j.state.nextRunAtMs && now >= j.state.nextRunAtMs,
    );

    for (const job of dueJobs) {
      await this._executeJob(job);
    }

    this._saveStore();
    this._armTimer();
  }

  private async _executeJob(job: CronJob): Promise<void> {
    const startMs = Date.now();
    console.info(`[CronService] 执行任务 '${job.name}' (${job.id})`);

    try {
      if (this.onJob) await this.onJob(job);
      job.state.lastStatus = 'ok';
      job.state.lastError = undefined;
    } catch (error) {
      job.state.lastStatus = 'error';
      job.state.lastError = error instanceof Error ? error.message : String(error);
      console.error(`[CronService] 任务 '${job.name}' 执行失败：${job.state.lastError}`);
    }

    job.state.lastRunAtMs = startMs;
    job.updatedAtMs = Date.now();

    // at 类型：执行一次后禁用或删除
    if (job.schedule.kind === 'at') {
      if (job.deleteAfterRun) {
        this._getStore().jobs = this._getStore().jobs.filter((j) => j.id !== job.id);
      } else {
        job.enabled = false;
        job.state.nextRunAtMs = undefined;
      }
    } else {
      // 计算下次执行时间
      job.state.nextRunAtMs = computeNextRun(job.schedule, Date.now());
    }
  }
}
