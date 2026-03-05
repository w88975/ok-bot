/**
 * Hono 中间件集合
 * - requestLogger：结构化请求日志
 * - bearerAuth：Bearer Token 认证
 */

import type { MiddlewareHandler } from 'hono';

/**
 * 请求日志中间件
 * 输出格式：[HTTP] METHOD /path 200 42ms
 */
export function requestLogger(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    const status = c.res.status;
    const method = c.req.method;
    const path = c.req.path;
    console.info(`[HTTP] ${method} ${path} ${status} ${ms}ms`);
  };
}

/**
 * Bearer Token 认证中间件
 * 跳过 GET /health（便于负载均衡探活不需要 token）
 *
 * @param token 期望的 Bearer Token 值
 */
export function bearerAuth(token: string): MiddlewareHandler {
  return async (c, next) => {
    // 健康检查免鉴权
    if (c.req.path === '/health') {
      return next();
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: '缺少 Authorization Bearer Token' }, 401);
    }

    const provided = authHeader.slice('Bearer '.length).trim();
    if (provided !== token) {
      return c.json({ error: 'Token 无效' }, 401);
    }

    return next();
  };
}
