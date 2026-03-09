/**
 * LLM Provider 接口类型定义
 * 封装 Vercel AI SDK 的调用细节，向上层暴露统一接口
 */

import type { CoreMessage } from 'ai';
import type { OnEvent } from '../agent/AgentEvent.js';

/** 工具调用请求 — LLM 要求执行的工具 */
export interface ToolCallRequest {
  /** 工具调用唯一 ID */
  id: string;
  /** 工具名称 */
  name: string;
  /** 工具参数（已解析的对象） */
  arguments: Record<string, unknown>;
}

/** LLM 响应结果 */
export interface LLMResponse {
  /** 文本内容（无工具调用时有值） */
  content: string | null;
  /** 工具调用列表 */
  toolCalls: ToolCallRequest[];
  /** 结束原因 */
  finishReason: 'stop' | 'tool-calls' | 'length' | 'error' | string;
  /** Token 用量统计 */
  usage?: { promptTokens: number; completionTokens: number };
}

/** LLMResponse 便捷属性：是否含工具调用 */
export function hasToolCalls(response: LLMResponse): boolean {
  return response.toolCalls.length > 0;
}

/** LLM Provider 抽象接口 */
export interface ILLMProvider {
  /**
   * 发起 chat 请求
   * @param messages 消息列表（CoreMessage 格式）
   * @param tools Vercel AI SDK tools Record
   * @param options 可选参数覆盖
   */
  chat(
    messages: CoreMessage[],
    tools?: Record<string, import('ai').Tool>,
    options?: ChatOptions,
  ): Promise<LLMResponse>;

  /** 获取默认模型标识符 */
  getDefaultModel(): string;
}

/** chat 请求可选参数 */
export interface ChatOptions {
  /** 覆盖默认模型 */
  model?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大输出 token */
  maxTokens?: number;
  /**
   * 结构化 agent 事件回调
   * 提供时使用 fullStream 替代 generateText，实时 emit think/text/tool 等事件
   */
  onEvent?: OnEvent;
}

export type { OnEvent };
