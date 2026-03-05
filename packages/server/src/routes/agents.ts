/**
 * Agent CRUD 路由
 * GET    /agents          列出所有 agent
 * POST   /agents          创建 agent（可选内联 bootstrap 内容）
 * DELETE /agents/:agentId 停止并移除 agent
 */

import { Hono } from 'hono';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentManager } from '@ok-bot/core';

/** bootstrap 内联内容字段 → 文件名映射 */
const BOOTSTRAP_FILE_MAP: Record<string, string> = {
  agents: 'AGENTS.md',
  soul: 'SOUL.md',
  user: 'USER.md',
  tools: 'TOOLS.md',
};

/**
 * 将请求 body 中的 bootstrap 内联内容写入 workspace 目录
 * 只写有值的字段，不影响其他已存在的文件
 */
async function writeBootstrapFiles(
  workspace: string,
  bootstrap: Record<string, string>,
): Promise<void> {
  await fs.mkdir(workspace, { recursive: true });

  for (const [key, content] of Object.entries(bootstrap)) {
    const filename = BOOTSTRAP_FILE_MAP[key];
    if (!filename || typeof content !== 'string' || !content.trim()) continue;
    await fs.writeFile(path.join(workspace, filename), content, 'utf-8');
  }
}

export function agentsRouter(manager: AgentManager): Hono {
  const router = new Hono();

  /** 列出所有 agent */
  router.get('/', (c) => {
    return c.json({ agents: manager.listAgents() });
  });

  /**
   * 创建 agent
   *
   * Body 除标准 AgentConfig 字段外，还支持可选的 `bootstrap` 对象：
   * ```json
   * {
   *   "id": "my-agent",
   *   "workspace": "/path/to/ws",
   *   "provider": { "model": "openai-compat:GLM-4.7", ... },
   *   "bootstrap": {
   *     "agents": "# 角色\n你是一名...",
   *     "soul": "你的价值观是...",
   *     "user": "# 用户\n后端工程师...",
   *     "tools": "## 工具说明\n..."
   *   }
   * }
   * ```
   * 提供的字段会直接写入 workspace 目录下对应的 .md 文件，
   * 未提供的字段不受影响（保留已有文件）。
   */
  router.post('/', async (c) => {
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || !body['id'] || !body['workspace'] || !body['provider']) {
      return c.json({ error: '缺少必填字段：id、workspace、provider' }, 400);
    }

    const workspace = String(body['workspace']);

    // 如果传入了 bootstrap 内联内容，先写入文件
    const bootstrap = body['bootstrap'];
    if (bootstrap && typeof bootstrap === 'object' && !Array.isArray(bootstrap)) {
      try {
        await writeBootstrapFiles(workspace, bootstrap as Record<string, string>);
      } catch (err) {
        return c.json(
          { error: `写入 bootstrap 文件失败：${err instanceof Error ? err.message : String(err)}` },
          500,
        );
      }
    } else {
      // 没有传 bootstrap 时也确保 workspace 目录存在
      await fs.mkdir(workspace, { recursive: true }).catch(() => {});
    }

    // 从 body 中去掉 bootstrap 字段，再创建 agent
    const { bootstrap: _bootstrap, ...agentConfig } = body;
    const info = await manager.createAgent(agentConfig as never);
    return c.json({ agent: info }, 201);
  });

  /** 删除 agent */
  router.delete('/:agentId', async (c) => {
    const { agentId } = c.req.param();
    await manager.removeAgent(agentId);
    return c.body(null, 204);
  });

  return router;
}
