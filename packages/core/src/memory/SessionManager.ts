/**
 * Session 管理器
 * 基于 JSONL 文件持久化对话历史，每行一条 CoreMessage JSON
 * 每个 session 对应 workspace/sessions/{sessionKey}.jsonl 文件
 */

import fs from 'node:fs';
import path from 'node:path';
import type { CoreMessage } from 'ai';

/** JSONL 文件中存储的消息格式（带时间戳） */
export interface StoredMessage extends Record<string, unknown> {
  /** 消息角色 */
  role: string;
  /** 消息内容 */
  content: unknown;
  /** 写入时间（ISO 字符串） */
  timestamp?: string;
}

/**
 * Session — 单个对话会话
 *
 * 持有消息历史和 consolidation 进度指针。
 */
export class Session {
  /** 会话唯一 key（格式：channel:chatId） */
  readonly key: string;
  /** 消息历史（已存储的 CoreMessage 列表） */
  messages: StoredMessage[];
  /** 最后一次 consolidation 的消息索引（已归档到此位置） */
  lastConsolidated: number;
  /** 最后更新时间 */
  updatedAt: Date;

  constructor(key: string, messages: StoredMessage[] = [], lastConsolidated = 0) {
    this.key = key;
    this.messages = messages;
    this.lastConsolidated = lastConsolidated;
    this.updatedAt = new Date();
  }

  /**
   * 获取最近的历史消息（滑动窗口）
   * @param maxMessages 最大消息数（默认返回全部）
   * @returns CoreMessage 数组（最新的 maxMessages 条）
   */
  getHistory(maxMessages?: number): CoreMessage[] {
    const msgs = this.messages as unknown as CoreMessage[];
    if (!maxMessages || maxMessages >= msgs.length) return msgs;
    return msgs.slice(-maxMessages);
  }

  /**
   * 清空会话历史
   */
  clear(): void {
    this.messages = [];
    this.lastConsolidated = 0;
    this.updatedAt = new Date();
  }
}

/**
 * SessionManager — 管理所有 session 的持久化和缓存
 *
 * 使用 JSONL 格式存储：每行一条 JSON 消息。
 * 内存缓存避免频繁磁盘 IO。
 */
export class SessionManager {
  /** sessions 目录路径 */
  private readonly sessionsDir: string;
  /** 内存缓存：sessionKey → Session */
  private readonly cache = new Map<string, Session>();

  constructor(workspace: string) {
    this.sessionsDir = path.join(workspace, 'sessions');
  }

  /**
   * 获取或创建 session
   * 优先从内存缓存返回；不存在时从磁盘加载；磁盘不存在时创建新 session
   *
   * @param sessionKey 会话 key（如 "telegram:12345"）
   * @returns Session 实例
   */
  getOrCreate(sessionKey: string): Session {
    const cached = this.cache.get(sessionKey);
    if (cached) return cached;

    const session = this._loadFromDisk(sessionKey);
    this.cache.set(sessionKey, session);
    return session;
  }

  /**
   * 持久化 session 到磁盘（JSONL 格式）
   * @param session 要保存的 session
   */
  save(session: Session): void {
    // 自动创建 sessions 目录
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }

    const filePath = this._getFilePath(session.key);

    if (session.messages.length === 0) {
      // 清空后删除文件
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return;
    }

    // 每行写一条 JSON 消息
    const lines = session.messages.map((msg) => JSON.stringify(msg));
    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
  }

  /**
   * 使内存缓存失效，下次 getOrCreate 时强制从磁盘重新加载
   * @param sessionKey 要失效的 session key
   */
  invalidate(sessionKey: string): void {
    this.cache.delete(sessionKey);
  }

  /**
   * 列出所有已存储 session 的 key 和消息数量
   * @returns { sessionKey, messageCount }[] 列表
   */
  listSessions(): Array<{ sessionKey: string; messageCount: number }> {
    if (!fs.existsSync(this.sessionsDir)) return [];

    const files = fs.readdirSync(this.sessionsDir).filter((f) => f.endsWith('.jsonl'));
    return files.map((file) => {
      const sessionKey = file.replace(/\.jsonl$/, '').replace(/__/g, ':');
      const filePath = path.join(this.sessionsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const messageCount = content
        .split('\n')
        .filter((l) => l.trim()).length;
      return { sessionKey, messageCount };
    });
  }

  // ─── 私有方法 ──────────────────────────────────────────────────────────────

  /** 从磁盘加载 session（文件不存在时返回空 session） */
  private _loadFromDisk(sessionKey: string): Session {
    const filePath = this._getFilePath(sessionKey);
    if (!fs.existsSync(filePath)) {
      return new Session(sessionKey);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const messages: StoredMessage[] = content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line) as StoredMessage;
        } catch {
          return null;
        }
      })
      .filter((msg): msg is StoredMessage => msg !== null);

    return new Session(sessionKey, messages);
  }

  /**
   * 将 sessionKey 转为安全的文件名
   * 将 ":" 替换为 "__"（避免路径问题）
   */
  private _getFilePath(sessionKey: string): string {
    const safeKey = sessionKey.replace(/:/g, '__');
    return path.join(this.sessionsDir, `${safeKey}.jsonl`);
  }
}
