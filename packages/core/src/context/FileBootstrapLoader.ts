/**
 * 文件式引导文件加载器
 * 按固定顺序从 workspace 根目录读取 AGENTS.md、SOUL.md、USER.md、TOOLS.md
 * 将内容组合为 system prompt 的 bootstrap 节
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 引导文件加载顺序（固定，与 nanobot 保持一致）
 */
const BOOTSTRAP_FILES = ['AGENTS.md', 'SOUL.md', 'USER.md', 'TOOLS.md'] as const;

/**
 * FileBootstrapLoader — 从 workspace 文件系统加载引导内容
 *
 * 每个存在的文件以 `## {filename}\n\n{content}` 格式包含。
 * 不存在的文件被静默跳过。
 */
export class FileBootstrapLoader {
  constructor(private readonly workspace: string) {}

  /**
   * 加载所有引导文件内容
   * @returns 合并后的引导内容字符串；若所有文件均不存在，返回空字符串
   */
  async load(): Promise<string> {
    const parts: string[] = [];

    for (const filename of BOOTSTRAP_FILES) {
      const filePath = path.join(this.workspace, filename);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        parts.push(`## ${filename}\n\n${content.trim()}`);
      } catch {
        // 文件不存在时静默跳过
      }
    }

    return parts.join('\n\n');
  }
}
