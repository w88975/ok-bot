/**
 * WebChannel — 基于 WebSocket 的双向 channel adapter
 *
 * 通过 attach(app, upgradeWebSocket) 将 /ws 端点注册到现有 Hono app。
 * upgradeWebSocket 由外部（服务器层）提供，core 包仅依赖 hono 类型。
 *
 * @example
 * ```ts
 * // 在 server 包中：
 * const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });
 * const channel = new WebChannel({ manager, authToken: 'secret' });
 * channel.attach(app, upgradeWebSocket);
 * // 然后：
 * const server = serve({ fetch: app.fetch, port: 3000 });
 * injectWebSocket(server);
 * ```
 */

import type { Hono } from 'hono';
import type { UpgradeWebSocket, WSContext } from 'hono/ws';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AgentManager } from '../../agent/AgentManager.js';
import type { AgentInfo } from '../../types.js';
import type {
  ClientMessage,
  ServerMessage,
  GroupInfo,
} from './types.js';

/** WebChannel 配置 */
export interface WebChannelConfig {
  /** AgentManager 实例 */
  manager: AgentManager;
  /** Bearer Token（握手时通过 ?token= query param 验证，不设置则无需鉴权） */
  authToken?: string;
}

/** bootstrap 内联内容字段 → 文件名映射 */
const BOOTSTRAP_FILE_MAP: Record<string, string> = {
  agents: 'AGENTS.md',
  soul: 'SOUL.md',
  user: 'USER.md',
  tools: 'TOOLS.md',
};

/** WebSocket 发送函数类型 */
type WsSendFn = (data: string) => void;

/**
 * WebChannel — WebSocket channel adapter
 *
 * 支持单聊、群组聊天、创建 agent/群组、实时状态广播。
 * Bear Token 鉴权通过 ?token= query param 实现。
 */
export class WebChannel {
  private readonly manager: AgentManager;
  private readonly authToken?: string;

  /** clientId → WebSocket 发送函数 */
  private readonly clients = new Map<string, WsSendFn>();

  /** groupId → GroupInfo */
  private readonly groups = new Map<string, GroupInfo>();

  constructor(config: WebChannelConfig) {
    this.manager = config.manager;
    this.authToken = config.authToken;
  }

  /**
   * 将 /ws WebSocket 端点挂载到 Hono app
   *
   * @param app Hono app 实例
   * @param upgradeWebSocket 由平台适配器提供的 WebSocket 升级函数
   *   (Node.js: from `createNodeWebSocket({ app })`)
   */
  attach(app: Hono, upgradeWebSocket: UpgradeWebSocket): void {
    app.get(
      '/ws',
      upgradeWebSocket((c) => {
        // Bearer Token 鉴权
        if (this.authToken) {
          const token = c.req.query('token');
          if (token !== this.authToken) {
            return {
              onOpen: (_evt: Event, ws: WSContext) => {
                ws.close(4001, 'Unauthorized');
              },
            };
          }
        }

        const clientId = randomUUID();

        return {
          onOpen: (_evt: Event, ws: WSContext) => {
            const send: WsSendFn = (data) => ws.send(data);
            this.clients.set(clientId, send);

            // 发送 connected + 当前 agent 状态
            this._sendTo(clientId, { type: 'connected', clientId });
            this._sendTo(clientId, { type: 'agent-status', agents: this._getAgents() });
          },

          onMessage: (event: MessageEvent, ws: WSContext) => {
            const send = (msg: ServerMessage) => ws.send(JSON.stringify(msg));
            void this._handleMessage(clientId, send, String(event.data));
          },

          onClose: () => {
            this.clients.delete(clientId);
          },

          onError: (error: Event) => {
            console.error(`[WebChannel] client ${clientId} 错误：`, error);
            this.clients.delete(clientId);
          },
        };
      }),
    );
  }

  // ─── 消息处理 ──────────────────────────────────────────────────────────────

  private async _handleMessage(
    clientId: string,
    send: (msg: ServerMessage) => void,
    raw: string,
  ): Promise<void> {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      send({ type: 'error', message: '无效的 JSON 消息' });
      return;
    }

    try {
      switch (msg.type) {
        case 'chat':
          await this._handleChat(clientId, send, msg);
          break;
        case 'group-chat':
          await this._handleGroupChat(clientId, send, msg);
          break;
        case 'create-agent':
          await this._handleCreateAgent(clientId, send, msg);
          break;
        case 'list-agents':
          send({ type: 'agent-status', agents: this._getAgents() });
          break;
        case 'create-group':
          this._handleCreateGroup(clientId, send, msg);
          break;
        case 'update-group':
          this._handleUpdateGroup(clientId, send, msg);
          break;
        default:
          send({ type: 'error', message: `未知消息类型` });
      }
    } catch (error) {
      send({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async _handleChat(
    _clientId: string,
    send: (msg: ServerMessage) => void,
    msg: import('./types.js').ChatMessage,
  ): Promise<void> {
    const sessionKey = msg.sessionKey ?? `web:${msg.agentId}`;
    const response = await this.manager.chat({
      agentId: msg.agentId,
      content: msg.content,
      sessionKey,
      channel: 'web',
      chatId: sessionKey,
    });
    send({
      type: 'message',
      agentId: msg.agentId,
      content: response.content,
      sessionKey,
    });
  }

  private async _handleGroupChat(
    _clientId: string,
    send: (msg: ServerMessage) => void,
    msg: import('./types.js').GroupChatMessage,
  ): Promise<void> {
    const group = this.groups.get(msg.groupId);
    if (!group) {
      send({ type: 'error', message: `群组 "${msg.groupId}" 不存在` });
      return;
    }

    // 确定要发消息的 agent 列表（有 mention 则定向，否则广播）
    const targetIds =
      msg.mentions && msg.mentions.length > 0
        ? msg.mentions.filter((id) => group.agentIds.includes(id))
        : group.agentIds;

    if (targetIds.length === 0) {
      send({ type: 'error', message: '没有有效的目标 agent' });
      return;
    }

    // 并发发送，各回复独立推送
    await Promise.all(
      targetIds.map(async (agentId) => {
        try {
          const sessionKey = `web-group:${msg.groupId}:${agentId}`;
          const response = await this.manager.chat({
            agentId,
            content: msg.content,
            sessionKey,
            channel: 'web-group',
            chatId: sessionKey,
          });
          send({
            type: 'message',
            agentId,
            content: response.content,
            sessionKey,
            groupId: msg.groupId,
          });
        } catch (error) {
          send({
            type: 'error',
            message: `Agent "${agentId}" 回复失败：${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }),
    );
  }

  private async _handleCreateAgent(
    _clientId: string,
    send: (msg: ServerMessage) => void,
    msg: import('./types.js').CreateAgentMessage,
  ): Promise<void> {
    const { config, bootstrap } = msg;

    // 写入 bootstrap 文件（如有内联内容）
    if (bootstrap && config.workspace) {
      await fs.mkdir(config.workspace, { recursive: true });
      for (const [key, content] of Object.entries(bootstrap)) {
        const filename = BOOTSTRAP_FILE_MAP[key];
        if (filename && typeof content === 'string' && content.trim()) {
          await fs.writeFile(path.join(config.workspace, filename), content, 'utf-8');
        }
      }
    } else if (config.workspace) {
      await fs.mkdir(config.workspace, { recursive: true }).catch(() => {});
    }

    const info = await this.manager.createAgent(config);
    const agentInfo: AgentInfo = {
      id: info.id,
      workspace: info.workspace,
      status: info.status,
    };

    send({ type: 'agent-created', agent: agentInfo });
    // 广播新 agent 状态给所有客户端
    this._broadcast({ type: 'agent-status', agents: this._getAgents() });
  }

  private _handleCreateGroup(
    _clientId: string,
    send: (msg: ServerMessage) => void,
    msg: import('./types.js').CreateGroupMessage,
  ): void {
    const agents = this._getAgents();
    const agentIds = agents.map((a) => a.id);
    const invalidIds = msg.agentIds.filter((id) => !agentIds.includes(id));
    if (invalidIds.length > 0) {
      send({ type: 'error', message: `Agent 不存在：${invalidIds.join(', ')}` });
      return;
    }

    if (msg.agentIds.length < 2) {
      send({ type: 'error', message: '群组至少需要 2 个 agent' });
      return;
    }

    const group: GroupInfo = {
      id: msg.groupId,
      name: msg.name ?? msg.groupId,
      agentIds: msg.agentIds,
      createdAt: Date.now(),
    };
    this.groups.set(msg.groupId, group);

    send({ type: 'group-created', group });
    this._broadcast({ type: 'group-status', group });
  }

  private _handleUpdateGroup(
    _clientId: string,
    send: (msg: ServerMessage) => void,
    msg: import('./types.js').UpdateGroupMessage,
  ): void {
    const group = this.groups.get(msg.groupId);
    if (!group) {
      send({ type: 'error', message: `群组 "${msg.groupId}" 不存在` });
      return;
    }

    let members = [...group.agentIds];

    if (msg.addAgentIds) {
      for (const id of msg.addAgentIds) {
        if (!members.includes(id)) members.push(id);
      }
    }

    if (msg.removeAgentIds) {
      members = members.filter((id) => !msg.removeAgentIds!.includes(id));
    }

    // 成员少于 2 时自动解散
    if (members.length < 2) {
      this.groups.delete(msg.groupId);
      this._broadcast({ type: 'group-dissolved', groupId: msg.groupId });
      return;
    }

    const updated: GroupInfo = { ...group, agentIds: members };
    this.groups.set(msg.groupId, updated);
    this._broadcast({ type: 'group-status', group: updated });
  }

  // ─── 工具方法 ──────────────────────────────────────────────────────────────

  private _getAgents(): AgentInfo[] {
    return this.manager.listAgents();
  }

  private _sendTo(clientId: string, msg: ServerMessage): void {
    const send = this.clients.get(clientId);
    if (send) {
      try {
        send(JSON.stringify(msg));
      } catch {
        this.clients.delete(clientId);
      }
    }
  }

  /** 向所有已连接客户端广播消息 */
  private _broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const [clientId, sendFn] of this.clients) {
      try {
        sendFn(data);
      } catch {
        this.clients.delete(clientId);
      }
    }
  }
}
