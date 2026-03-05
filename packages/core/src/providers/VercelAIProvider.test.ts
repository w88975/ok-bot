/**
 * VercelAIProvider 单元测试
 * 使用 Vercel AI SDK 的 MockLanguageModelV1 模拟 LLM 行为
 */

import { describe, it, expect } from 'vitest';
import { MockLanguageModelV1 } from 'ai/test';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { sanitizeEmptyContent } from './VercelAIProvider.js';
import type { CoreMessage } from 'ai';

// ─── sanitizeEmptyContent 测试 ──────────────────────────────────────────────

describe('sanitizeEmptyContent', () => {
  it('字符串 content 为空时替换为 (empty)', () => {
    const messages: CoreMessage[] = [
      { role: 'user', content: '' },
      { role: 'user', content: 'hello' },
    ];
    const result = sanitizeEmptyContent(messages);
    expect(result[0]?.content).toBe('(empty)');
    expect(result[1]?.content).toBe('hello');
  });

  it('数组 content 中过滤空 text 块', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: '' },
          { type: 'text', text: 'hello' },
        ],
      },
    ];
    const result = sanitizeEmptyContent(messages);
    const content = result[0]?.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    expect(content[0]?.text).toBe('hello');
  });

  it('数组 content 全为空时替换为 (empty)', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: '' }],
      },
    ];
    const result = sanitizeEmptyContent(messages);
    expect(result[0]?.content).toBe('(empty)');
  });

  it('正常 content 不被修改', () => {
    const messages: CoreMessage[] = [
      { role: 'user', content: 'hello world' },
      { role: 'assistant', content: 'hi there' },
    ];
    const result = sanitizeEmptyContent(messages);
    expect(result[0]?.content).toBe('hello world');
    expect(result[1]?.content).toBe('hi there');
  });
});

// ─── MockLanguageModelV1 行为测试 ────────────────────────────────────────────

describe('LLM 行为测试（MockLanguageModelV1）', () => {
  it('LLM 返回纯文本响应', async () => {
    const model = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: '你好，我是 ok-bot！',
      }),
    });

    const result = await generateText({
      model,
      messages: [{ role: 'user', content: '你好' }],
      maxSteps: 1,
    });

    expect(result.text).toBe('你好，我是 ok-bot！');
    expect(result.finishReason).toBe('stop');
    expect(result.toolCalls).toHaveLength(0);
  });

  it('LLM 返回工具调用', async () => {
    const model = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'tool-calls',
        usage: { promptTokens: 15, completionTokens: 10 },
        toolCalls: [
          {
            toolCallType: 'function' as const,
            toolCallId: 'call_abc123',
            toolName: 'read_file',
            args: JSON.stringify({ path: '/workspace/test.txt' }),
          },
        ],
      }),
    });

    const result = await generateText({
      model,
      messages: [{ role: 'user', content: '读取文件' }],
      tools: {
        read_file: tool({
          description: '读取文件内容',
          parameters: z.object({ path: z.string() }),
          execute: async () => 'file content',
        }),
      },
      maxSteps: 1,
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.toolName).toBe('read_file');
    expect(result.finishReason).toBe('tool-calls');
  });
});
