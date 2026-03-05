/**
 * 文件系统工具单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createListDirTool,
} from './FileSystemTools.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ok-bot-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('read_file', () => {
  it('读取已存在的文件', async () => {
    await fs.writeFile(path.join(tmpDir, 'test.txt'), 'hello world', 'utf-8');
    const tool = createReadFileTool({ workspace: tmpDir });
    const result = await tool.execute({ path: path.join(tmpDir, 'test.txt') });
    expect(result).toBe('hello world');
  });

  it('文件不存在时返回错误信息（不抛异常）', async () => {
    const tool = createReadFileTool({ workspace: tmpDir });
    const result = await tool.execute({ path: path.join(tmpDir, 'notfound.txt') });
    expect(result).toContain('不存在');
  });

  it('workspace 限制模式下拒绝越界访问', async () => {
    const tool = createReadFileTool({ workspace: tmpDir, allowedDir: tmpDir });
    await expect(tool.execute({ path: '/etc/passwd' })).rejects.toThrow('访问被拒绝');
  });
});

describe('write_file', () => {
  it('写入文件内容', async () => {
    const tool = createWriteFileTool({ workspace: tmpDir });
    await tool.execute({ path: path.join(tmpDir, 'out.txt'), content: 'new content' });
    const content = await fs.readFile(path.join(tmpDir, 'out.txt'), 'utf-8');
    expect(content).toBe('new content');
  });

  it('自动创建父目录', async () => {
    const tool = createWriteFileTool({ workspace: tmpDir });
    const nested = path.join(tmpDir, 'a', 'b', 'c.txt');
    await tool.execute({ path: nested, content: 'nested' });
    const content = await fs.readFile(nested, 'utf-8');
    expect(content).toBe('nested');
  });
});

describe('edit_file', () => {
  it('替换文件中第一个匹配的字符串', async () => {
    await fs.writeFile(path.join(tmpDir, 'edit.txt'), 'hello world hello', 'utf-8');
    const tool = createEditFileTool({ workspace: tmpDir });
    await tool.execute({
      path: path.join(tmpDir, 'edit.txt'),
      old_str: 'hello',
      new_str: 'hi',
    });
    const content = await fs.readFile(path.join(tmpDir, 'edit.txt'), 'utf-8');
    // 只替换第一个
    expect(content).toBe('hi world hello');
  });

  it('字符串不存在时返回错误信息', async () => {
    await fs.writeFile(path.join(tmpDir, 'edit2.txt'), 'content', 'utf-8');
    const tool = createEditFileTool({ workspace: tmpDir });
    const result = await tool.execute({
      path: path.join(tmpDir, 'edit2.txt'),
      old_str: 'notfound',
      new_str: 'replacement',
    });
    expect(result).toContain('未找到');
  });
});

describe('list_dir', () => {
  it('列出目录内容', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.txt'), '');
    await fs.mkdir(path.join(tmpDir, 'subdir'));
    const tool = createListDirTool({ workspace: tmpDir });
    const result = await tool.execute({ path: tmpDir });
    expect(result).toContain('a.txt');
    expect(result).toContain('subdir/');
  });

  it('目录不存在时返回错误信息', async () => {
    const tool = createListDirTool({ workspace: tmpDir });
    const result = await tool.execute({ path: path.join(tmpDir, 'nonexistent') });
    expect(result).toContain('不存在');
  });
});
