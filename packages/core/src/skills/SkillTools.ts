/**
 * SkillTools — 将 workspace skills 注册为 LLM 工具
 *
 * 每个可用的 skill 对应一个 LLM 工具：
 *   - 工具名：skill_{name}（hyphen → underscore）
 *   - 描述：skill frontmatter 的 description（LLM 据此判断何时调用）
 *   - 执行：返回完整 SKILL.md 内容，LLM 读取后按流程执行
 */

import { z } from 'zod';
import type { ToolDefinition } from '../tools/ToolRegistry.js';
import type { SkillsLoader } from './SkillsLoader.js';

/**
 * 将 skill 名称转为合法的工具名（snake_case，前缀 skill_）
 * e.g. "hospital-registration" → "skill_hospital_registration"
 */
export function toSkillToolName(skillName: string): string {
  return `skill_${skillName.replace(/-/g, '_')}`;
}

/**
 * 从 SkillsLoader 创建所有可用 skill 的工具定义
 *
 * LLM 调用 skill 工具时，工具返回完整 SKILL.md 内容，
 * LLM 随后基于该内容严格执行技能流程。
 */
export function createSkillTools(skillsLoader: SkillsLoader): ToolDefinition[] {
  return skillsLoader
    .listSkills()
    .filter((entry) => entry.available)
    .map((entry) => ({
      name: toSkillToolName(entry.name),
      description: entry.meta.description,
      parameters: z.object({}),
      execute: async (): Promise<string> => {
        const content = skillsLoader.loadSkill(entry.name);
        if (!content) return `技能 "${entry.name}" 内容为空。`;
        return `# Skill: ${entry.name}\n\n${content}`;
      },
    }));
}
