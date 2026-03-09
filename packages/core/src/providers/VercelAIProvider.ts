/**
 * Vercel AI SDK Provider 封装
 * 统一封装 generateText/streamText，支持通过模型字符串切换不同 LLM provider
 * 模型格式："provider:model"，如 "openai:gpt-4o"、"anthropic:claude-3-5-sonnet-20241022"
 */

import { generateText, streamText, type CoreMessage, type Tool, type LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import type { ChatOptions, ILLMProvider, LLMResponse } from './types.js';

/**
 * 从 "provider:model" 字符串解析并创建 LanguageModel 实例
 * 支持的 provider：openai、anthropic、google、groq、openai-compat
 *
 * 当 provider 为 "openai-compat" 或传入 baseURL 时，使用自定义兼容端点。
 * 例如接入 GLM、DeepSeek、Qwen 等 OpenAI 兼容 API。
 */
function resolveModel(
  modelString: string,
  apiKey?: string,
  baseURL?: string,
): LanguageModelV1 {
  const colonIdx = modelString.indexOf(':');
  if (colonIdx === -1) {
    throw new Error(`模型格式无效："${modelString}"，请使用 "provider:model" 格式`);
  }

  const provider = modelString.slice(0, colonIdx);
  const model = modelString.slice(colonIdx + 1);

  // 若提供了 baseURL，或 provider 为 openai-compat，使用自定义 OpenAI 兼容端点
  if (baseURL || provider === 'openai-compat') {
    return createOpenAI({
      apiKey,
      baseURL,
      compatibility: 'compatible',
    })(model);
  }

  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey })(model);
    case 'anthropic':
      return createAnthropic({ apiKey })(model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(model);
    case 'groq':
      return createGroq({ apiKey })(model);
    default:
      throw new Error(
        `不支持的 LLM provider："${provider}"，支持的 provider：openai、anthropic、google、groq、openai-compat（自定义端点）`,
      );
  }
}

/**
 * 清理消息中的空 content，防止各 provider 因空字符串 content 返回 400 错误
 * 空 content 通常出现在 MCP 工具返回空结果时
 *
 * @param messages - 原始 CoreMessage 列表
 * @returns 已清理的消息列表（新数组，不修改原数组）
 */
export function sanitizeEmptyContent(messages: CoreMessage[]): CoreMessage[] {
  return messages.map((msg) => {
    const content = msg.content;

    // 字符串 content 为空时替换为占位文本
    if (typeof content === 'string' && content === '') {
      return { ...msg, content: '(empty)' } as CoreMessage;
    }

    // 数组 content：过滤掉空 text 块
    if (Array.isArray(content)) {
      const filtered = content.filter((item) => {
        if (
          typeof item === 'object' &&
          item !== null &&
          'type' in item &&
          item.type === 'text' &&
          'text' in item
        ) {
          return Boolean((item as { text: string }).text);
        }
        return true;
      });

      if (filtered.length !== content.length) {
        if (filtered.length === 0) {
          return { ...msg, content: '(empty)' } as CoreMessage;
        }
        return { ...msg, content: filtered } as CoreMessage;
      }
    }

    return msg;
  });
}

/** thinking 配置类型 */
interface ThinkingConfig {
  enabled: boolean;
  budgetTokens?: number;
}

/**
 * VercelAIProvider — 基于 Vercel AI SDK 的 LLM Provider 实现
 *
 * 通过 "provider:model" 格式的模型字符串，统一接入多种 LLM provider。
 *
 * @example
 * ```ts
 * const provider = new VercelAIProvider({
 *   model: 'openai:gpt-4o',
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 * const response = await provider.chat(messages, tools);
 * ```
 */
export class VercelAIProvider implements ILLMProvider {
  /** 默认模型字符串（格式：provider:model） */
  private readonly defaultModel: string;
  /** API Key（优先于对应的环境变量） */
  private readonly apiKey?: string;
  /**
   * 自定义 API 端点（适用于 OpenAI 兼容协议的第三方服务）
   * 例如：https://api.z.ai/api/coding/paas/v4
   */
  private readonly baseURL?: string;
  /** 深度思考配置（仅对支持 reasoning 的模型有效） */
  private readonly thinking?: ThinkingConfig;

  constructor(config: { model: string; apiKey?: string; baseURL?: string; thinking?: ThinkingConfig }) {
    this.defaultModel = config.model;
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
    this.thinking = config.thinking;
  }

  /**
   * 获取默认模型标识符
   * @returns 模型字符串，如 "openai:gpt-4o"
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * 发起 LLM chat 请求
   *
   * - 提供 `options.onEvent` 时：使用 `streamText + fullStream` 实时 emit 结构化事件
   * - 否则：使用 `generateText` 批量返回
   *
   * 工具调用在 AgentLoop 中手动迭代，因此 maxSteps 固定为 1。
   *
   * @param messages - CoreMessage 格式的消息列表
   * @param tools - Vercel AI SDK tool Record（可选，无工具时传 undefined）
   * @param options - 覆盖默认参数（model、temperature、maxTokens、onEvent）
   * @returns LLM 响应（含文本内容或工具调用列表）
   */
  async chat(
    messages: CoreMessage[],
    tools?: Record<string, Tool>,
    options?: ChatOptions,
  ): Promise<LLMResponse> {
    const modelString = options?.model ?? this.defaultModel;
    const languageModel = resolveModel(modelString, this.apiKey, this.baseURL);

    // 清理空 content，防止各 provider 返回 400 错误
    const cleanedMessages = sanitizeEmptyContent(messages);

    const hasTools = tools && Object.keys(tools).length > 0;

    // ── 流式模式（onEvent 存在时） ────────────────────────────────────────────
    if (options?.onEvent) {
      const onEvent = options.onEvent;

      // Anthropic 深度思考：仅当 provider 为 anthropic 且 thinking.enabled 时传入
      const providerName = modelString.slice(0, modelString.indexOf(':'));
      const thinkingCfg = this.thinking;
      const providerOptions =
        thinkingCfg?.enabled && providerName === 'anthropic'
          ? {
              anthropic: {
                thinking: {
                  type: 'enabled' as const,
                  budgetTokens: thinkingCfg.budgetTokens ?? 8000,
                },
              },
            }
          : undefined;

      const result = streamText({
        model: languageModel,
        messages: cleanedMessages,
        tools: hasTools ? tools : undefined,
        temperature: options?.temperature ?? 0.1,
        maxTokens: options?.maxTokens ?? 4096,
        maxSteps: 1,
        providerOptions,
      });

      // 遍历 fullStream，按 chunk 类型 dispatch 对应 AgentEvent
      let thinkingActive = false;
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'reasoning') {
          if (!thinkingActive) {
            await onEvent({ type: 'think_start' });
            thinkingActive = true;
          }
          await onEvent({ type: 'think_delta', content: chunk.textDelta });
        } else if (chunk.type === 'text-delta') {
          if (thinkingActive) {
            await onEvent({ type: 'think_end' });
            thinkingActive = false;
          }
          await onEvent({ type: 'text_delta', content: chunk.textDelta });
        }
        // tool-call、finish、error 由 AgentLoop 通过 result.toolCalls 处理
      }

      // 确保 think_end 配对（边缘情况：流结束时仍在 thinking 状态）
      if (thinkingActive) {
        await onEvent({ type: 'think_end' });
      }

      const text = await result.text;
      const rawToolCalls = await result.toolCalls;
      const finishReason = await result.finishReason;
      const usage = await result.usage;

      const toolCalls = rawToolCalls.map((tc) => ({
        id: tc.toolCallId,
        name: tc.toolName,
        arguments: tc.args as Record<string, unknown>,
      }));

      return {
        content: text || null,
        toolCalls,
        finishReason,
        usage: usage
          ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens }
          : undefined,
      };
    }

    // ── 非流式模式（原有实现） ────────────────────────────────────────────────
    const result = await generateText({
      model: languageModel,
      messages: cleanedMessages,
      tools: hasTools ? tools : undefined,
      temperature: options?.temperature ?? 0.1,
      maxTokens: options?.maxTokens ?? 4096,
      maxSteps: 1,
    });

    const toolCalls = result.toolCalls.map((tc) => ({
      id: tc.toolCallId,
      name: tc.toolName,
      arguments: tc.args as Record<string, unknown>,
    }));

    return {
      content: result.text || null,
      toolCalls,
      finishReason: result.finishReason,
      usage: result.usage
        ? {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
          }
        : undefined,
    };
  }
}
