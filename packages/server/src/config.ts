/**
 * ok-bot server 配置类型定义与加载逻辑
 *
 * 配置来源优先级（从高到低）：
 * 1. 程序调用时直接传入的 ServerConfig 对象
 * 2. 环境变量 OK_BOT_CONFIG 指向的 JSON 文件路径
 * 3. 当前目录下的 ok-bot.config.json
 * 4. 默认值
 */

import fs from 'node:fs';
import path from 'node:path';
import type { AgentConfig } from '@ok-bot/core';

/**
 * 单个预配置 Agent 的定义
 * 服务器启动时自动创建
 */
export interface AgentPreset extends Omit<AgentConfig, 'id'> {
  /** agent 唯一标识符 */
  id: string;
}

/**
 * 单个 Telegram Channel 的配置
 */
export interface TelegramChannelPreset {
  /** Telegram Bot Token */
  token: string;
  /** 默认路由的 agentId（未配置 chatToAgent 路由时使用） */
  defaultAgentId?: string;
  /** chat_id → agentId 路由映射 */
  chatToAgent?: Record<string, string>;
}

/**
 * ok-bot server 配置
 */
export interface ServerConfig {
  /** 监听端口（默认 3000） */
  port?: number;
  /** 监听地址（默认 0.0.0.0） */
  hostname?: string;
  /**
   * Bearer Token 认证密钥
   * 设置后所有 API 请求须携带 Authorization: Bearer <token>
   * 不设置则不启用认证（仅限内网使用）
   */
  authToken?: string;
  /**
   * 服务器启动时自动创建的 Agent 列表
   * 每个 agent 会在 Worker Thread 中独立运行
   */
  agents?: AgentPreset[];
  /**
   * AgentManager 全局配置
   */
  managerOptions?: {
    /** 请求超时毫秒数（默认 5 分钟） */
    requestTimeoutMs?: number;
  };
  /**
   * Telegram Channel 列表
   * 服务器启动时自动创建并以 long polling 模式运行
   */
  telegramChannels?: TelegramChannelPreset[];
}

/** 默认配置 */
const DEFAULTS: Required<Pick<ServerConfig, 'port' | 'hostname'>> = {
  port: 3000,
  hostname: '0.0.0.0',
};

/**
 * 加载服务器配置
 * 若传入 config 对象则直接使用，否则从文件或环境变量读取
 */
export function loadConfig(override?: ServerConfig): ServerConfig {
  let fileConfig: ServerConfig = {};

  // 优先从环境变量指定的文件读取
  const configPath =
    process.env['OK_BOT_CONFIG'] ??
    (fs.existsSync(path.resolve('ok-bot.config.json'))
      ? path.resolve('ok-bot.config.json')
      : null);

  if (configPath && fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(raw) as ServerConfig;
      console.info(`[Config] 已加载配置文件：${configPath}`);
    } catch (err) {
      console.warn(`[Config] 读取配置文件失败（${configPath}）：`, err);
    }
  }

  // 合并：命令行 override > 文件 > 默认值
  return {
    ...DEFAULTS,
    ...fileConfig,
    ...override,
    // agents 列表直接覆盖，不合并
    agents: override?.agents ?? fileConfig.agents ?? [],
  };
}
