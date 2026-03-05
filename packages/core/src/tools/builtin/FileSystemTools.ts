/**
 * 文件系统内置工具集
 * 提供 read_file、write_file、edit_file、list_dir 四个工具
 * 支持 workspace 限制模式，防止越权访问
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { ToolDefinition } from '../ToolRegistry.js';

/**
 * 文件系统工具配置项
 */
export interface FileSystemToolsConfig {
  /** workspace 根目录绝对路径（用于相对路径解析） */
  workspace: string;
  /** 若设置，限制文件访问在此目录内（推荐使用 workspace 路径） */
  allowedDir?: string;
}

/**
 * 验证路径是否在允许目录内
 * @throws 若路径越界则抛出错误
 */
function assertAllowed(resolved: string, allowedDir: string): void {
  const normalizedAllowed = path.resolve(allowedDir);
  if (!resolved.startsWith(normalizedAllowed + path.sep) && resolved !== normalizedAllowed) {
    throw new Error(`访问被拒绝：路径 "${resolved}" 超出允许的目录 "${normalizedAllowed}"`);
  }
}

/**
 * 解析路径（支持绝对路径和相对路径）
 * 相对路径以 workspace 为根目录解析
 */
function resolvePath(filePath: string, workspace: string): string {
  if (path.isAbsolute(filePath)) {
    return path.resolve(filePath);
  }
  return path.resolve(workspace, filePath);
}

/**
 * 创建 read_file 工具
 * 读取文件内容，支持文本文件
 */
export function createReadFileTool(config: FileSystemToolsConfig): ToolDefinition {
  return {
    name: 'read_file',
    description: '读取文件内容。path 可以是绝对路径或相对 workspace 的路径。',
    parameters: z.object({
      path: z.string().describe('文件路径（绝对路径或相对 workspace 的路径）'),
    }),
    execute: async ({ path: filePath }) => {
      const resolved = resolvePath(filePath, config.workspace);
      if (config.allowedDir) assertAllowed(resolved, config.allowedDir);

      try {
        const content = await fs.readFile(resolved, 'utf-8');
        return content;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return `错误：文件不存在 "${resolved}"`;
        }
        throw error;
      }
    },
  };
}

/**
 * 创建 write_file 工具
 * 写入文件内容，自动创建父目录
 */
export function createWriteFileTool(config: FileSystemToolsConfig): ToolDefinition {
  return {
    name: 'write_file',
    description: '将内容写入文件。若文件或父目录不存在，自动创建。',
    parameters: z.object({
      path: z.string().describe('目标文件路径'),
      content: z.string().describe('要写入的内容'),
    }),
    execute: async ({ path: filePath, content }) => {
      const resolved = resolvePath(filePath, config.workspace);
      if (config.allowedDir) assertAllowed(resolved, config.allowedDir);

      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, 'utf-8');
      return `已写入文件 "${resolved}"（${content.length} 字符）`;
    },
  };
}

/**
 * 创建 edit_file 工具
 * 在文件中进行字符串替换（替换第一个匹配项）
 */
export function createEditFileTool(config: FileSystemToolsConfig): ToolDefinition {
  return {
    name: 'edit_file',
    description:
      '在文件中替换第一个匹配的字符串。修改前请先用 read_file 确认内容。',
    parameters: z.object({
      path: z.string().describe('目标文件路径'),
      old_str: z.string().describe('要替换的原始字符串（必须在文件中唯一匹配）'),
      new_str: z.string().describe('替换后的新字符串'),
    }),
    execute: async ({ path: filePath, old_str, new_str }) => {
      const resolved = resolvePath(filePath, config.workspace);
      if (config.allowedDir) assertAllowed(resolved, config.allowedDir);

      let content: string;
      try {
        content = await fs.readFile(resolved, 'utf-8');
      } catch {
        return `错误：文件不存在 "${resolved}"`;
      }

      if (!content.includes(old_str)) {
        return `错误：在文件 "${resolved}" 中未找到指定字符串，请先用 read_file 确认内容`;
      }

      const updated = content.replace(old_str, new_str);
      await fs.writeFile(resolved, updated, 'utf-8');
      return `已编辑文件 "${resolved}"`;
    },
  };
}

/**
 * 创建 list_dir 工具
 * 列出目录内容（文件和子目录）
 */
export function createListDirTool(config: FileSystemToolsConfig): ToolDefinition {
  return {
    name: 'list_dir',
    description: '列出目录内容（文件和子目录）。',
    parameters: z.object({
      path: z
        .string()
        .optional()
        .describe('目录路径（默认为 workspace 根目录）'),
    }),
    execute: async ({ path: dirPath }) => {
      const resolved = resolvePath(dirPath ?? '.', config.workspace);
      if (config.allowedDir) assertAllowed(resolved, config.allowedDir);

      try {
        const entries = await fs.readdir(resolved, { withFileTypes: true });
        if (entries.length === 0) {
          return `目录 "${resolved}" 为空`;
        }
        const lines = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
        return lines.join('\n');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return `错误：目录不存在 "${resolved}"`;
        }
        throw error;
      }
    },
  };
}

/**
 * 一次性创建所有文件系统工具
 * @returns 文件系统工具定义数组
 */
export function createFileSystemTools(config: FileSystemToolsConfig): ToolDefinition[] {
  return [
    createReadFileTool(config),
    createWriteFileTool(config),
    createEditFileTool(config),
    createListDirTool(config),
  ];
}
