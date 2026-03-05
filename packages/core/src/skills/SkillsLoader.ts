/**
 * Skills 加载器
 * 读取和管理 workspace/skills/ 及内置 builtin-skills/ 目录下的 SKILL.md 文件
 * workspace skills 优先覆盖内置 skills（同名时 workspace 版本优先）
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import matter from 'gray-matter';
import { fileURLToPath } from 'node:url';

/** 内置 skills 目录路径（相对于此文件） */
const BUILTIN_SKILLS_DIR = path.resolve(
  fileURLToPath(import.meta.url),
  '../../../builtin-skills',
);

/** Skill 元数据（来自 frontmatter） */
export interface SkillMeta {
  /** skill 名称 */
  name: string;
  /** skill 描述 */
  description: string;
  /** 是否始终注入 system prompt */
  always: boolean;
  /** 依赖项检查 */
  requires: {
    /** 要求存在于 PATH 的命令 */
    bins: string[];
    /** 要求设置的环境变量 */
    env: string[];
  };
}

/** Skill 条目（列表项） */
export interface SkillEntry {
  /** skill 名称（目录名） */
  name: string;
  /** SKILL.md 绝对路径 */
  filePath: string;
  /** 来源：workspace 或 builtin */
  source: 'workspace' | 'builtin';
  /** 是否可用（依赖项满足） */
  available: boolean;
  /** 元数据 */
  meta: SkillMeta;
}

/**
 * SkillsLoader — Skill 加载与管理器
 *
 * 职责：
 * - 扫描 workspace/skills/ 和 builtin-skills/ 目录
 * - 解析 SKILL.md frontmatter（gray-matter）
 * - 检查依赖项（bins、env）
 * - 提供 always-skills 内容和 XML 摘要供 ContextBuilder 使用
 * - 内存缓存：同进程内 skills 只读一次磁盘
 */
export class SkillsLoader {
  /** workspace 下的 skills 目录 */
  private readonly workspaceSkillsDir: string;
  /** 内置 skills 目录 */
  private readonly builtinSkillsDir: string;

  /** 内存缓存：skill 名称 → 原始文件内容 */
  private readonly contentCache = new Map<string, string>();
  /** 内存缓存：扫描结果 */
  private cachedEntries: SkillEntry[] | null = null;

  constructor(workspace: string, builtinSkillsDir?: string) {
    this.workspaceSkillsDir = path.join(workspace, 'skills');
    this.builtinSkillsDir = builtinSkillsDir ?? BUILTIN_SKILLS_DIR;
  }

  /**
   * 列出所有可用 skill（workspace 优先，同名时 builtin 被覆盖）
   * 结果缓存在内存中
   */
  listSkills(): SkillEntry[] {
    if (this.cachedEntries) return this.cachedEntries;

    const entries = new Map<string, SkillEntry>();

    // 先加载 builtin（低优先级）
    this._scanDir(this.builtinSkillsDir, 'builtin', entries);
    // 再加载 workspace（高优先级，覆盖同名 builtin）
    this._scanDir(this.workspaceSkillsDir, 'workspace', entries);

    this.cachedEntries = [...entries.values()];
    return this.cachedEntries;
  }

  /**
   * 加载指定 skill 的原始内容（含 frontmatter）
   * 结果缓存在内存中
   */
  loadSkillRaw(name: string): string | null {
    // 优先检查内存缓存
    const cached = this.contentCache.get(name);
    if (cached !== undefined) return cached;

    // workspace 优先
    const wsPath = path.join(this.workspaceSkillsDir, name, 'SKILL.md');
    if (fs.existsSync(wsPath)) {
      const content = fs.readFileSync(wsPath, 'utf-8');
      this.contentCache.set(name, content);
      return content;
    }

    // 回退到 builtin
    const builtinPath = path.join(this.builtinSkillsDir, name, 'SKILL.md');
    if (fs.existsSync(builtinPath)) {
      const content = fs.readFileSync(builtinPath, 'utf-8');
      this.contentCache.set(name, content);
      return content;
    }

    return null;
  }

  /**
   * 加载 skill 内容（已 strip frontmatter，适合注入 system prompt）
   */
  loadSkill(name: string): string | null {
    const raw = this.loadSkillRaw(name);
    if (!raw) return null;
    return this._stripFrontmatter(raw);
  }

  /**
   * 加载多个 skills 内容并格式化（用于 always-skills 注入）
   */
  loadSkillsForContext(names: string[]): string {
    const parts: string[] = [];
    for (const name of names) {
      const content = this.loadSkill(name);
      if (content) {
        parts.push(`### Skill: ${name}\n\n${content}`);
      }
    }
    return parts.join('\n\n---\n\n');
  }

  /**
   * 获取所有标记为 always=true 且可用的 skill 名称列表
   */
  getAlwaysSkills(): string[] {
    return this.listSkills()
      .filter((s) => s.available && s.meta.always)
      .map((s) => s.name);
  }

  /**
   * 构建 XML 格式的 skills 摘要
   * 供 ContextBuilder 注入 system prompt，让 agent 知道可用 skills
   */
  buildSkillsSummary(): string {
    const entries = this.listSkills();
    if (entries.length === 0) return '';

    const escXml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const lines = ['<skills>'];
    for (const entry of entries) {
      lines.push(`  <skill available="${entry.available}">`);
      lines.push(`    <name>${escXml(entry.name)}</name>`);
      lines.push(`    <description>${escXml(entry.meta.description)}</description>`);
      lines.push(`    <location>${escXml(entry.filePath)}</location>`);

      // 不可用时列出缺少的依赖
      if (!entry.available) {
        const missing = this._getMissingRequirements(entry.meta);
        if (missing) {
          lines.push(`    <requires>${escXml(missing)}</requires>`);
        }
      }

      lines.push(`  </skill>`);
    }
    lines.push('</skills>');

    return lines.join('\n');
  }

  // ─── 私有方法 ─────────────────────────────────────────────────────────────

  /** 扫描指定目录，填充 entries Map */
  private _scanDir(
    dir: string,
    source: 'workspace' | 'builtin',
    entries: Map<string, SkillEntry>,
  ): void {
    if (!fs.existsSync(dir)) return;

    let subdirs: string[];
    try {
      subdirs = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const name of subdirs) {
      const skillFile = path.join(dir, name, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;

      const raw = fs.readFileSync(skillFile, 'utf-8');
      const meta = this._parseMeta(raw, name);
      const available = this._checkRequirements(meta);

      entries.set(name, { name, filePath: skillFile, source, available, meta });
      // 缓存内容（workspace 的会覆盖 builtin 的，因为 workspace 后扫描）
      this.contentCache.set(name, raw);
    }
  }

  /** 解析 SKILL.md frontmatter，提取 ok-bot 元数据 */
  private _parseMeta(raw: string, fallbackName: string): SkillMeta {
    try {
      const parsed = matter(raw);
      const frontmatter = parsed.data as Record<string, unknown>;
      const okBot = (frontmatter['ok-bot'] ?? {}) as {
        always?: boolean;
        requires?: { bins?: string[]; env?: string[] };
      };

      return {
        name: String(frontmatter['name'] ?? fallbackName),
        description: String(frontmatter['description'] ?? fallbackName),
        always: Boolean(okBot.always),
        requires: {
          bins: okBot.requires?.bins ?? [],
          env: okBot.requires?.env ?? [],
        },
      };
    } catch {
      return {
        name: fallbackName,
        description: fallbackName,
        always: false,
        requires: { bins: [], env: [] },
      };
    }
  }

  /** 检查 skill 的依赖项是否满足 */
  private _checkRequirements(meta: SkillMeta): boolean {
    for (const bin of meta.requires.bins) {
      try {
        execSync(`which ${bin}`, { stdio: 'ignore' });
      } catch {
        return false;
      }
    }
    for (const envVar of meta.requires.env) {
      if (!process.env[envVar]) return false;
    }
    return true;
  }

  /** 获取缺少的依赖项描述 */
  private _getMissingRequirements(meta: SkillMeta): string {
    const missing: string[] = [];
    for (const bin of meta.requires.bins) {
      try {
        execSync(`which ${bin}`, { stdio: 'ignore' });
      } catch {
        missing.push(`CLI: ${bin}`);
      }
    }
    for (const envVar of meta.requires.env) {
      if (!process.env[envVar]) missing.push(`ENV: ${envVar}`);
    }
    return missing.join(', ');
  }

  /** 移除 SKILL.md 内容的 frontmatter 部分 */
  private _stripFrontmatter(raw: string): string {
    try {
      const parsed = matter(raw);
      return parsed.content.trim();
    } catch {
      return raw;
    }
  }
}
