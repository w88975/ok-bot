/**
 * SkillsLoader 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SkillsLoader } from './SkillsLoader.js';

let tmpWorkspace: string;
let tmpBuiltin: string;

beforeEach(async () => {
  tmpWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'ok-bot-ws-'));
  tmpBuiltin = await fs.mkdtemp(path.join(os.tmpdir(), 'ok-bot-builtin-'));
});

afterEach(async () => {
  await fs.rm(tmpWorkspace, { recursive: true, force: true });
  await fs.rm(tmpBuiltin, { recursive: true, force: true });
});

/** 在指定目录创建一个 skill */
async function createSkill(
  dir: string,
  name: string,
  content: string,
): Promise<void> {
  await fs.mkdir(path.join(dir, 'skills', name), { recursive: true });
  await fs.writeFile(path.join(dir, 'skills', name, 'SKILL.md'), content, 'utf-8');
}

async function createBuiltinSkill(name: string, content: string): Promise<void> {
  await fs.mkdir(path.join(tmpBuiltin, name), { recursive: true });
  await fs.writeFile(path.join(tmpBuiltin, name, 'SKILL.md'), content, 'utf-8');
}

describe('listSkills', () => {
  it('列出 workspace skills', async () => {
    await createSkill(tmpWorkspace, 'my-skill', '---\nname: my-skill\ndescription: 测试\n---\n# 内容');
    const loader = new SkillsLoader(tmpWorkspace, tmpBuiltin);
    const skills = loader.listSkills();
    expect(skills.some((s) => s.name === 'my-skill')).toBe(true);
  });

  it('列出 builtin skills', async () => {
    await createBuiltinSkill('builtin-skill', '---\nname: builtin-skill\ndescription: 内置\n---\n# 内容');
    const loader = new SkillsLoader(tmpWorkspace, tmpBuiltin);
    const skills = loader.listSkills();
    expect(skills.some((s) => s.name === 'builtin-skill')).toBe(true);
  });

  it('workspace skill 覆盖同名 builtin skill', async () => {
    await createBuiltinSkill('shared', '---\nname: shared\ndescription: builtin 版本\n---\n# builtin');
    await createSkill(tmpWorkspace, 'shared', '---\nname: shared\ndescription: workspace 版本\n---\n# workspace');
    const loader = new SkillsLoader(tmpWorkspace, tmpBuiltin);
    const skills = loader.listSkills();
    const shared = skills.find((s) => s.name === 'shared');
    expect(shared?.source).toBe('workspace');
    expect(shared?.meta.description).toBe('workspace 版本');
  });
});

describe('frontmatter 解析', () => {
  it('正确解析 always 和 requires', async () => {
    const content = `---
name: test-skill
description: 测试 skill
ok-bot:
  always: true
  requires:
    bins: []
    env: []
---
# 内容`;
    await createSkill(tmpWorkspace, 'test-skill', content);
    const loader = new SkillsLoader(tmpWorkspace, tmpBuiltin);
    const skills = loader.listSkills();
    const skill = skills.find((s) => s.name === 'test-skill');
    expect(skill?.meta.always).toBe(true);
    expect(skill?.meta.requires.bins).toEqual([]);
  });

  it('无 frontmatter 时使用默认值', async () => {
    await createSkill(tmpWorkspace, 'no-fm', '# 无 frontmatter\n内容');
    const loader = new SkillsLoader(tmpWorkspace, tmpBuiltin);
    const skills = loader.listSkills();
    const skill = skills.find((s) => s.name === 'no-fm');
    expect(skill?.meta.always).toBe(false);
    expect(skill?.available).toBe(true);
  });
});

describe('loadSkill（strip frontmatter）', () => {
  it('返回不含 frontmatter 的内容', async () => {
    await createSkill(tmpWorkspace, 'strip-test', '---\nname: strip-test\ndescription: 测试\n---\n# 正文内容');
    const loader = new SkillsLoader(tmpWorkspace, tmpBuiltin);
    const content = loader.loadSkill('strip-test');
    expect(content).not.toContain('---');
    expect(content).toContain('正文内容');
  });

  it('不存在的 skill 返回 null', async () => {
    const loader = new SkillsLoader(tmpWorkspace, tmpBuiltin);
    expect(loader.loadSkill('nonexistent')).toBeNull();
  });
});

describe('getAlwaysSkills', () => {
  it('只返回 always=true 且可用的 skills', async () => {
    await createSkill(tmpWorkspace, 'always-skill', '---\nname: always-skill\ndescription: 总是加载\nok-bot:\n  always: true\n---\n# 内容');
    await createSkill(tmpWorkspace, 'normal-skill', '---\nname: normal-skill\ndescription: 正常\n---\n# 内容');
    const loader = new SkillsLoader(tmpWorkspace, tmpBuiltin);
    const alwaysSkills = loader.getAlwaysSkills();
    expect(alwaysSkills).toContain('always-skill');
    expect(alwaysSkills).not.toContain('normal-skill');
  });
});

describe('buildSkillsSummary', () => {
  it('生成合法的 XML 格式', async () => {
    await createSkill(tmpWorkspace, 'xml-test', '---\nname: xml-test\ndescription: XML 测试\n---\n# 内容');
    const loader = new SkillsLoader(tmpWorkspace, tmpBuiltin);
    const summary = loader.buildSkillsSummary();
    expect(summary).toContain('<skills>');
    expect(summary).toContain('</skills>');
    expect(summary).toContain('<skill available="true">');
    expect(summary).toContain('xml-test');
  });
});

describe('内存缓存', () => {
  it('第二次调用不重新读取磁盘（通过删除文件验证）', async () => {
    await createSkill(tmpWorkspace, 'cache-test', '---\nname: cache-test\ndescription: 缓存测试\n---\n# 内容');
    const loader = new SkillsLoader(tmpWorkspace, tmpBuiltin);

    // 第一次加载（读取磁盘）
    const first = loader.loadSkill('cache-test');
    expect(first).toBeTruthy();

    // 删除文件（模拟磁盘变化）
    await fs.rm(path.join(tmpWorkspace, 'skills', 'cache-test'), { recursive: true });

    // 第二次应从缓存返回
    const second = loader.loadSkill('cache-test');
    expect(second).toBe(first);
  });
});
