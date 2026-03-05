/**
 * MCP Client — Model Context Protocol 客户端
 *
 * 支持 stdio 和 SSE 两种传输方式连接 MCP servers。
 * 连接成功后将 MCP server 暴露的工具动态注册到 ToolRegistry。
 * 实现 lazy 连接：首次消息时连接，失败时下次重试。
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { z } from 'zod';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { McpServerConfig } from '../types.js';

/** 单个 MCP server 的连接状态 */
interface McpConnection {
  name: string;
  client: Client;
  toolNames: string[];
}

/**
 * McpClient — 管理多个 MCP server 连接
 *
 * 使用方式：
 * 1. 创建 McpClient 实例
 * 2. 调用 connect(toolRegistry) 连接所有 server 并注册工具
 * 3. 调用 close() 断开所有连接（在 AgentLoop 关闭时）
 */
export class McpClient {
  private readonly configs: Record<string, McpServerConfig>;
  private readonly connections: McpConnection[] = [];
  private connected = false;
  private connecting = false;

  constructor(configs: Record<string, McpServerConfig>) {
    this.configs = configs;
  }

  /**
   * 连接所有配置的 MCP server，并将工具注册到 ToolRegistry
   * Lazy 连接：连接失败时记录错误但不阻断 agent 启动
   *
   * @param registry 工具注册中心
   */
  async connect(registry: ToolRegistry): Promise<void> {
    if (this.connected || this.connecting) return;
    if (Object.keys(this.configs).length === 0) return;

    this.connecting = true;

    for (const [serverName, config] of Object.entries(this.configs)) {
      try {
        await this._connectServer(serverName, config, registry);
        console.info(`[McpClient] 已连接 MCP server：${serverName}`);
      } catch (error) {
        console.error(
          `[McpClient] 连接 MCP server "${serverName}" 失败（下次消息时重试）：`,
          error,
        );
      }
    }

    this.connected = true;
    this.connecting = false;
  }

  /**
   * 关闭所有 MCP server 连接（有序断开）
   */
  async close(): Promise<void> {
    for (const conn of this.connections) {
      try {
        await conn.client.close();
        console.info(`[McpClient] 已断开 MCP server：${conn.name}`);
      } catch (error) {
        console.warn(`[McpClient] 断开 "${conn.name}" 时出错：`, error);
      }
    }
    this.connections.length = 0;
    this.connected = false;
  }

  /** 重置连接状态（下次 connect 调用时重新连接） */
  reset(): void {
    this.connected = false;
    this.connecting = false;
  }

  // ─── 私有方法 ──────────────────────────────────────────────────────────────

  private async _connectServer(
    serverName: string,
    config: McpServerConfig,
    registry: ToolRegistry,
  ): Promise<void> {
    const client = new Client(
      { name: 'ok-bot', version: '0.1.0' },
      { capabilities: {} },
    );

    // 根据传输类型创建连接
    if (config.transport === 'stdio') {
      if (!config.command) throw new Error(`MCP server "${serverName}" 缺少 command 配置`);

      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args ?? [],
        env: config.env,
      });
      await client.connect(transport);
    } else if (config.transport === 'sse') {
      if (!config.url) throw new Error(`MCP server "${serverName}" 缺少 url 配置`);

      const transport = new SSEClientTransport(new URL(config.url));
      await client.connect(transport);
    } else {
      throw new Error(`MCP server "${serverName}" 不支持的传输类型`);
    }

    // 列出 server 提供的工具
    const toolsResult = await client.listTools();
    const registeredNames: string[] = [];

    for (const mcpTool of toolsResult.tools) {
      const toolName = `${serverName}__${mcpTool.name}`;

      try {
        // 将 MCP tool 的 inputSchema 转为 zod schema（兜底为空 object）
        const schema = z.object({}).passthrough();

        registry.register({
          name: toolName,
          description: mcpTool.description ?? `MCP 工具：${mcpTool.name}（来自 ${serverName}）`,
          parameters: schema,
          execute: async (args) => {
            try {
              const result = await client.callTool({
                name: mcpTool.name,
                arguments: args as Record<string, unknown>,
              });
              // 将 MCP 结果转为字符串
              if (Array.isArray(result.content)) {
                return result.content
                  .map((item) => {
                    if (typeof item === 'object' && item !== null && 'text' in item) {
                      return String((item as { text: unknown }).text);
                    }
                    return JSON.stringify(item);
                  })
                  .join('\n');
              }
              return JSON.stringify(result.content);
            } catch (error) {
              return `MCP 工具 "${toolName}" 执行失败：${error instanceof Error ? error.message : String(error)}`;
            }
          },
        });

        registeredNames.push(toolName);
      } catch (error) {
        console.warn(`[McpClient] 注册 MCP 工具 "${toolName}" 失败：`, error);
      }
    }

    this.connections.push({ name: serverName, client, toolNames: registeredNames });
    console.info(
      `[McpClient] "${serverName}" 注册了 ${registeredNames.length} 个工具：${registeredNames.join(', ')}`,
    );
  }
}
