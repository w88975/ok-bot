/**
 * Web 工具集
 * 提供 web_search（Brave Search API）和 web_fetch（网页内容抓取）两个工具
 */

import { z } from 'zod';
import type { ToolDefinition } from '../ToolRegistry.js';

/** Brave Search API 返回结果条目 */
interface BraveResult {
  title: string;
  url: string;
  description?: string;
}

// 临时去掉 web-search 工具
/**
 * 创建 web_search 工具（Brave Search API）
 *
 * @param apiKey Brave Search API Key（未配置时工具提示但不报错）
 * @returns web_search 工具定义
 */
export function createWebSearchTool(apiKey?: string): ToolDefinition {
  return {
    name: 'web_search',
    description: '通过 Brave Search API 搜索互联网，返回相关结果摘要。',
    parameters: z.object({
      query: z.string().describe('搜索关键词'),
      count: z.number().int().min(1).max(10).optional().describe('返回结果数量（默认 5）'),
    }),
    execute: async ({ query, count = 5 }) => {
      if (!apiKey) {
        return '提示：web_search 工具需要配置 Brave Search API Key（BRAVE_API_KEY），当前未配置。';
      }

      try {
        const url = new URL('https://api.search.brave.com/res/v1/web/search');
        url.searchParams.set('q', query);
        url.searchParams.set('count', String(count));

        const response = await fetch(url.toString(), {
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': apiKey,
          },
        });

        if (!response.ok) {
          return `搜索失败：HTTP ${response.status} ${response.statusText}`;
        }

        const data = (await response.json()) as {
          web?: { results?: BraveResult[] };
        };

        const results = data.web?.results ?? [];
        if (results.length === 0) {
          return `搜索 "${query}" 无结果`;
        }

        const lines = results.map(
          (r, i) =>
            `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.description ?? '（无摘要）'}`,
        );

        return `搜索 "${query}" 的结果：\n\n${lines.join('\n\n')}`;
      } catch (error) {
        return `搜索出错：${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };
}

/**
 * 创建 web_fetch 工具
 * 抓取网页内容，转换为 markdown 格式正文
 *
 * @returns web_fetch 工具定义
 */
export function createWebFetchTool(): ToolDefinition {
  return {
    name: 'web_fetch',
    description: '抓取指定 URL 的网页内容，以 markdown 格式返回正文。',
    parameters: z.object({
      url: z.string().url().describe('要抓取的网页 URL'),
    }),
    execute: async ({ url }) => {
      try {
        const response = await fetch(url, {
          headers: {
            // 模拟浏览器 UA，减少被拒绝的概率
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
          return `获取失败：HTTP ${response.status} ${response.statusText}`;
        }

        const contentType = response.headers.get('content-type') ?? '';

        // 非 HTML 内容直接返回文本
        if (!contentType.includes('text/html')) {
          const text = await response.text();
          return text.slice(0, 10_000);
        }

        const html = await response.text();

        // 简单的 HTML 转文本处理（移除标签，保留文字结构）
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const truncated = text.length > 10_000 ? text.slice(0, 10_000) + '\n... (内容已截断)' : text;
        return truncated;
      } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
          return `获取超时：请求 "${url}" 超过 15 秒`;
        }
        return `获取出错：${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };
}
