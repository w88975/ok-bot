import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 扫描所有 package 下的测试文件
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/src/**/*.spec.ts',
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // 使用 node 环境运行测试
    environment: 'node',
    // 全局 API（describe, it, expect）
    globals: true,
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.spec.ts'],
    },
  },
  resolve: {
    // 支持 workspace 包的别名解析（测试时直接指向 src，无需编译）
    alias: {
      '@ok-bot/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
      '@ok-bot/server': new URL('./packages/server/src/index.ts', import.meta.url).pathname,
    },
  },
});
