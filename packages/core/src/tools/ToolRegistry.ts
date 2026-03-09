/**
 * 工具注册中心
 * 管理所有可用工具的注册、查询和执行
 * 导出 Vercel AI SDK 兼容的 tools Record 供 generateText 使用
 */

import { tool as aiTool, type Tool } from 'ai';
import { z } from 'zod';

/** 工具执行上下文，供工具实现使用（如 ShellTool 的实时 stdout 推送） */
export interface ToolExecuteContext {
  /** 实时 stdout/stderr 数据回调（仅 ShellTool 等流式工具使用） */
  onStdout?: (data: string) => void;
}

/**
 * 工具定义接口
 * 每个工具需要提供名称、描述、参数 schema 和执行函数
 */
export interface ToolDefinition<T extends z.ZodTypeAny = z.ZodTypeAny> {
  /** 工具名称（唯一标识，snake_case） */
  name: string;
  /** 工具功能描述（提供给 LLM 理解用途） */
  description: string;
  /** 参数 schema（zod 定义） */
  parameters: T;
  /** 执行函数，接收解析后的参数和可选执行上下文，返回字符串结果 */
  execute: (args: z.infer<T>, context?: ToolExecuteContext) => Promise<string>;
}

/**
 * 支持运行时上下文注入的工具接口
 * 实现此接口的工具可在每轮对话前接收 channel/chatId 等上下文
 */
export interface ContextAwareTool {
  /** 注入运行时上下文 */
  setContext(channel: string, chatId: string, messageId?: string): void;
}

/**
 * ToolRegistry — 工具注册与执行中心
 *
 * 负责：
 * - 注册内置工具和 MCP 动态工具
 * - 将工具定义导出为 Vercel AI SDK 兼容格式
 * - 代理工具执行并捕获错误（不允许工具错误中断 agent loop）
 */
export class ToolRegistry {
  /** 已注册的工具定义 Map */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly tools = new Map<string, ToolDefinition<any>>();

  /**
   * 注册一个工具
   * @param definition 工具定义（含名称、描述、schema、执行函数）
   * @throws 若同名工具已存在则抛出错误
   */
  register<T extends z.ZodTypeAny>(definition: ToolDefinition<T>): void {
    if (this.tools.has(definition.name)) {
      throw new Error(`工具 "${definition.name}" 已注册，不允许重复注册`);
    }
    this.tools.set(definition.name, definition);
  }

  /**
   * 获取工具定义
   * @param name 工具名称
   * @returns 工具定义，若不存在则返回 undefined
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * 执行工具
   *
   * 错误会被捕获并以字符串形式返回，避免中断 AgentLoop。
   *
   * @param name 工具名称
   * @param args 工具参数（未经验证的原始对象）
   * @param context 可选执行上下文（如 onStdout 用于 ShellTool 流式输出）
   * @returns 执行结果字符串；工具不存在或执行失败时返回错误描述
   */
  async execute(name: string, args: Record<string, unknown>, context?: ToolExecuteContext): Promise<string> {
    const definition = this.tools.get(name);
    if (!definition) {
      return `错误：工具 "${name}" 未注册`;
    }

    try {
      // 使用 zod schema 解析并验证参数
      const parsed = definition.parameters.parse(args);
      return await definition.execute(parsed, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `工具 "${name}" 执行失败：${message}`;
    }
  }

  /**
   * 导出所有工具为 Vercel AI SDK 兼容的 tools Record
   * 可直接传入 generateText 的 tools 参数
   *
   * @returns Record<toolName, Tool>
   */
  getDefinitions(): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const [name, def] of this.tools) {
      result[name] = aiTool({
        description: def.description,
        parameters: def.parameters,
        // 不在 SDK 层执行，由 AgentLoop 手动调用 execute()
        execute: undefined,
      });
    }
    return result;
  }

  /**
   * 获取所有已注册工具的名称列表
   */
  listNames(): string[] {
    return [...this.tools.keys()];
  }

  /**
   * 注销工具（主要用于 MCP 连接断开时清理）
   * @param name 工具名称
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }
}
