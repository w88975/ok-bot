/**
 * Shell 执行工具（exec）
 * 在 workspace 目录执行 shell 命令，支持超时控制和危险命令拦截
 */

import { spawn } from 'node:child_process';
import { z } from 'zod';
import type { ToolDefinition, ToolExecuteContext } from '../ToolRegistry.js';

/** 输出最大字符数（超出截断） */
const MAX_OUTPUT_CHARS = 10_000;

/**
 * 危险命令模式列表
 * 匹配后拒绝执行，保护系统安全
 */
const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+(-rf|-r\s+-f|-f\s+-r)\s+\//,  // rm -rf / (含各种参数顺序)
  /\bdd\b/,                   // dd（磁盘写入）
  /\bmkfs\b/,                 // 格式化
  /\bshutdown\b/,             // 关机
  /\breboot\b/,               // 重启
  /\bpoweroff\b/,             // 断电
  /\bchmod\s+777\s+\//,      // 危险权限变更
  /\bchown\s+.*\s+\//,       // 危险所有权变更
  /:\s*\(\s*\)\s*\{.*\}\s*;.*:/, // fork bomb
  /\bsudo\s+rm\s+-rf/,        // sudo rm -rf
];

/**
 * 检查命令是否匹配危险模式
 */
function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

/** Shell 工具配置 */
export interface ShellToolConfig {
  /** 命令执行的工作目录（通常为 workspace） */
  workingDir: string;
  /** 超时秒数（默认 60） */
  timeout?: number;
  /** 追加到 PATH 的额外路径（用于访问自定义工具） */
  pathAppend?: string;
}

/**
 * 创建 exec 工具（shell 命令执行）
 *
 * @param config Shell 工具配置
 * @returns exec 工具定义
 */
export function createShellTool(config: ShellToolConfig): ToolDefinition {
  const timeout = (config.timeout ?? 60) * 1000;

  return {
    name: 'exec',
    description:
      '在 workspace 目录执行 shell 命令，返回 stdout + stderr 合并输出。' +
      '危险命令（如 rm -rf /、dd、shutdown）会被拒绝。超时默认 60 秒。',
    parameters: z.object({
      command: z.string().describe('要执行的 shell 命令'),
    }),
    execute: async ({ command }, context?: ToolExecuteContext) => {
      // 危险命令拦截
      if (isDangerous(command)) {
        return `安全拒绝：命令 "${command}" 匹配危险模式，已阻止执行`;
      }

      return new Promise<string>((resolve) => {
        let output = '';
        let timedOut = false;

        // 构建环境变量
        const env = { ...process.env };
        if (config.pathAppend) {
          env['PATH'] = `${env['PATH'] ?? ''}:${config.pathAppend}`;
        }

        const child = spawn('sh', ['-c', command], {
          cwd: config.workingDir,
          env,
          // 合并 stdout 和 stderr（通过 pipe 分别收集）
        });

        child.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();
          output += chunk;
          context?.onStdout?.(chunk);
        });

        child.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString();
          output += chunk;
          context?.onStdout?.(chunk);
        });

        // 超时处理
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, timeout);

        child.on('close', (code) => {
          clearTimeout(timer);

          if (timedOut) {
            resolve(
              `命令超时（${config.timeout ?? 60}s）已终止。部分输出：\n${output.slice(0, MAX_OUTPUT_CHARS)}`,
            );
            return;
          }

          // 截断过长输出
          if (output.length > MAX_OUTPUT_CHARS) {
            output = output.slice(0, MAX_OUTPUT_CHARS) + '\n... (输出已截断)';
          }

          const exitInfo = code !== 0 ? `\n[退出码: ${code}]` : '';
          resolve(output + exitInfo || '（无输出）');
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          resolve(`执行错误：${err.message}`);
        });
      });
    },
  };
}
