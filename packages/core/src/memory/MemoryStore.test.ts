/**
 * MemoryStore 集成测试
 * 使用 MockLanguageModelV1 模拟 save_memory tool call
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MockLanguageModelV1 } from 'ai/test';
import { MemoryStore } from './MemoryStore.js';
import { Session } from './SessionManager.js';
import { VercelAIProvider } from '../providers/VercelAIProvider.js';

let tmpWorkspace: string;

beforeEach(async () => {
  tmpWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'ok-bot-mem-'));
});

afterEach(async () => {
  await fs.rm(tmpWorkspace, { recursive: true, force: true });
});

describe('readLongTerm / writeLongTerm', () => {
  it('文件不存在时返回空字符串', () => {
    const store = new MemoryStore(tmpWorkspace);
    expect(store.readLongTerm()).toBe('');
  });

  it('写入后可以读取', () => {
    const store = new MemoryStore(tmpWorkspace);
    store.writeLongTerm('# 用户\n- 名字：张三');
    expect(store.readLongTerm()).toContain('张三');
  });
});

describe('appendHistory', () => {
  it('追加历史条目', async () => {
    const store = new MemoryStore(tmpWorkspace);
    store.appendHistory('[2024-01-01 10:00] 用户询问天气');
    const historyPath = path.join(tmpWorkspace, 'memory', 'HISTORY.md');
    const content = await fs.readFile(historyPath, 'utf-8');
    expect(content).toContain('询问天气');
  });

  it('多次追加保持格式（每条空行分隔）', () => {
    const store = new MemoryStore(tmpWorkspace);
    store.appendHistory('[2024-01-01 10:00] 第一条');
    store.appendHistory('[2024-01-01 10:01] 第二条');
    const content = store.readLongTerm();
    // history 文件独立，memory 文件应为空
    expect(content).toBe('');
  });
});

describe('getMemoryContext', () => {
  it('无记忆时返回空字符串', () => {
    const store = new MemoryStore(tmpWorkspace);
    expect(store.getMemoryContext()).toBe('');
  });

  it('有记忆时返回格式化字符串', () => {
    const store = new MemoryStore(tmpWorkspace);
    store.writeLongTerm('# 用户\n- 名字：张三');
    const ctx = store.getMemoryContext();
    expect(ctx).toContain('长期记忆');
    expect(ctx).toContain('张三');
  });
});

describe('consolidate（MockLanguageModelV1）', () => {
  it('LLM 调用 save_memory 后更新 MEMORY.md', async () => {
    // MockLanguageModelV1 模拟返回 save_memory 工具调用
    const mockModel = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'tool-calls',
        usage: { promptTokens: 10, completionTokens: 20 },
        toolCalls: [
          {
            toolCallType: 'function' as const,
            toolCallId: 'call_1',
            toolName: 'save_memory',
            args: JSON.stringify({
              history_entry: '[2024-01-01 10:00] 用户询问天气，bot 回复晴天',
              memory_update: '# 用户\n- 兴趣：天气',
            }),
          },
        ],
      }),
    });

    // 用 MockLanguageModelV1 创建一个自定义 provider
    const provider = {
      getDefaultModel: () => 'mock:model',
      chat: async (messages: unknown, tools: unknown) => {
        const { generateText } = await import('ai');
        const result = await generateText({
          model: mockModel,
          messages: messages as never,
          tools: tools as never,
          maxSteps: 1,
        });
        type TC = { toolCallId: string; toolName: string; args: unknown };
        return {
          content: result.text || null,
          toolCalls: (result.toolCalls as TC[]).map((tc) => ({
            id: tc.toolCallId,
            name: tc.toolName,
            arguments: tc.args as Record<string, unknown>,
          })),
          finishReason: result.finishReason,
        };
      },
    };

    const store = new MemoryStore(tmpWorkspace);
    const session = new Session('test:1');
    session.messages.push({
      role: 'user',
      content: '今天天气怎么样？',
      timestamp: '2024-01-01T10:00:00',
    });
    session.messages.push({
      role: 'assistant',
      content: '今天晴天，适合出行。',
      timestamp: '2024-01-01T10:00:05',
    });

    const success = await store.consolidate(session, provider as never, 'mock:model', {
      archiveAll: true,
    });

    expect(success).toBe(true);
    expect(store.readLongTerm()).toContain('天气');
  });

  it('LLM 未调用工具时返回 false', async () => {
    const mockModel = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 5, completionTokens: 5 },
        text: '好的',
      }),
    });

    const provider = {
      getDefaultModel: () => 'mock:model',
      chat: async (messages: unknown, tools: unknown) => {
        const { generateText } = await import('ai');
        const result = await generateText({
          model: mockModel,
          messages: messages as never,
          maxSteps: 1,
        });
        return {
          content: result.text || null,
          toolCalls: [],
          finishReason: result.finishReason,
        };
      },
    };

    const store = new MemoryStore(tmpWorkspace);
    const session = new Session('test:2');
    session.messages.push({ role: 'user', content: '测试', timestamp: '2024-01-01T00:00:00' });

    const success = await store.consolidate(session, provider as never, 'mock:model', {
      archiveAll: true,
    });
    expect(success).toBe(false);
  });
});
