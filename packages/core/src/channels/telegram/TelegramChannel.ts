/**
 * TelegramChannel — Telegram bot channel adapter（long polling 模式）
 *
 * 使用 grammy 库以 long polling 接收 Telegram 消息，
 * 将消息转为 InboundMessage 投递到 AgentManager，
 * 并将 OutboundMessage 通过 grammy 回复给用户。
 */

import { Bot, type Context } from 'grammy';
import type { AgentManager } from '../../agent/AgentManager.js';
import type { OutboundMessage } from '../../bus/events.js';

/** Telegram 单条消息最大字符数 */
const TELEGRAM_MAX_LENGTH = 4096;

/**
 * Telegram Channel 配置
 */
export interface TelegramChannelConfig {
  /** Telegram Bot Token */
  token: string;
  /** chat_id → agentId 路由映射（key 为 string 类型的 chat_id） */
  chatToAgent?: Record<string, string>;
  /** 默认 agentId（未配置路由时使用） */
  defaultAgentId?: string;
}

/**
 * TelegramChannel — Telegram bot 收发消息的 channel adapter
 *
 * @example
 * ```ts
 * const channel = new TelegramChannel({
 *   token: process.env.TELEGRAM_BOT_TOKEN!,
 *   defaultAgentId: 'my-agent',
 * }, agentManager);
 * await channel.start();
 * ```
 */
export class TelegramChannel {
  private readonly bot: Bot;
  private readonly config: TelegramChannelConfig;
  private readonly manager: AgentManager;
  private running = false;

  constructor(config: TelegramChannelConfig, manager: AgentManager) {
    this.config = config;
    this.manager = manager;
    this.bot = new Bot(config.token);
    this._setupHandlers();
  }

  /** 启动 long polling */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.info('[TelegramChannel] 启动 long polling...');
    // 非阻塞启动
    void this.bot.start({
      onStart: (info) => {
        console.info(`[TelegramChannel] Bot @${info.username} 已连接`);
      },
    });
  }

  /** 停止 polling */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.bot.stop();
    console.info('[TelegramChannel] 已停止');
  }

  /**
   * 向指定 chat 发送消息（供外部调用或出站消息处理）
   * 超长消息自动分割
   */
  async sendMessage(chatId: string | number, content: string): Promise<void> {
    const chunks = this._splitMessage(content);
    for (const chunk of chunks) {
      await this.bot.api.sendMessage(chatId, chunk, { parse_mode: 'Markdown' }).catch(async () => {
        // Markdown 解析失败时回退为纯文本
        await this.bot.api.sendMessage(chatId, chunk);
      });
    }
  }

  // ─── 私有方法 ──────────────────────────────────────────────────────────────

  private _setupHandlers(): void {
    // 处理文本消息
    this.bot.on('message:text', async (ctx) => {
      await this._handleTextMessage(ctx);
    });

    // 处理图片消息
    this.bot.on('message:photo', async (ctx) => {
      await this._handlePhotoMessage(ctx);
    });

    // 错误处理
    this.bot.catch((err) => {
      console.error('[TelegramChannel] Bot 错误：', err);
    });
  }

  private async _handleTextMessage(ctx: Context): Promise<void> {
    const chatId = String(ctx.chat?.id);
    const text = ctx.message?.text;
    if (!text) return;

    const agentId = this._resolveAgentId(chatId);
    if (!agentId) {
      console.warn(`[TelegramChannel] chat ${chatId} 没有对应的 agent，忽略消息`);
      return;
    }

    try {
      const response = await this.manager.chat({
        agentId,
        content: text,
        channel: 'telegram',
        chatId,
        metadata: {
          messageId: ctx.message?.message_id,
          userId: ctx.from?.id,
          username: ctx.from?.username,
        },
      });

      await this.sendMessage(chatId, response.content);
    } catch (error) {
      console.error(`[TelegramChannel] 处理消息出错：`, error);
      await ctx.reply('抱歉，处理您的消息时出错了。').catch(() => {});
    }
  }

  private async _handlePhotoMessage(ctx: Context): Promise<void> {
    const chatId = String(ctx.chat?.id);
    const photos = ctx.message?.photo;
    if (!photos || photos.length === 0) return;

    const agentId = this._resolveAgentId(chatId);
    if (!agentId) return;

    // 取最高分辨率图片
    const photo = photos[photos.length - 1]!;
    const caption = ctx.message?.caption ?? '请描述这张图片';

    try {
      // 下载图片到临时文件
      const file = await ctx.api.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${this.config.token}/${file.file_path}`;

      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());

      const os = await import('node:os');
      const fsPromises = await import('node:fs/promises');
      const tmpFile = `${os.tmpdir()}/tg_${photo.file_id}.jpg`;
      await fsPromises.writeFile(tmpFile, buffer);

      const result = await this.manager.chat({
        agentId,
        content: caption,
        channel: 'telegram',
        chatId,
        media: [tmpFile],
      });

      await this.sendMessage(chatId, result.content);

      // 清理临时文件
      await fsPromises.rm(tmpFile, { force: true }).catch(() => {});
    } catch (error) {
      console.error('[TelegramChannel] 处理图片出错：', error);
      await ctx.reply('处理图片时出错。').catch(() => {});
    }
  }

  /** 根据 chatId 解析目标 agentId */
  private _resolveAgentId(chatId: string): string | null {
    if (this.config.chatToAgent?.[chatId]) {
      return this.config.chatToAgent[chatId]!;
    }
    return this.config.defaultAgentId ?? null;
  }

  /**
   * 将长消息分割为 Telegram 支持的最大长度片段
   * 优先在换行符处分割，保持消息可读性
   */
  private _splitMessage(content: string): string[] {
    if (content.length <= TELEGRAM_MAX_LENGTH) return [content];

    const chunks: string[] = [];
    let remaining = content;

    while (remaining.length > TELEGRAM_MAX_LENGTH) {
      // 尝试在最后一个换行处分割
      let splitAt = remaining.lastIndexOf('\n', TELEGRAM_MAX_LENGTH);
      if (splitAt <= 0) splitAt = TELEGRAM_MAX_LENGTH;

      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }

    if (remaining) chunks.push(remaining);
    return chunks;
  }
}

/**
 * ChannelManager — 统一管理所有 channel 的生命周期
 */
export class ChannelManager {
  private readonly channels: TelegramChannel[] = [];

  /** 注册一个 channel */
  add(channel: TelegramChannel): void {
    this.channels.push(channel);
  }

  /** 启动所有 channel */
  async start(): Promise<void> {
    await Promise.all(this.channels.map((c) => c.start()));
  }

  /** 停止所有 channel */
  async stop(): Promise<void> {
    await Promise.all(this.channels.map((c) => c.stop()));
  }
}
