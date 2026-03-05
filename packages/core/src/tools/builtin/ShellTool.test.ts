/**
 * ShellTool 单元测试
 * 测试超时控制、危险命令拦截、输出截断
 */

import { describe, it, expect } from 'vitest';
import { createShellTool } from './ShellTool.js';

describe('ShellTool', () => {
  const tool = createShellTool({ workingDir: '/tmp', timeout: 5 });

  it('执行正常命令并返回输出', async () => {
    const result = await tool.execute({ command: 'echo "hello ok-bot"' });
    expect(result).toContain('hello ok-bot');
  });

  it('返回非零退出码信息', async () => {
    const result = await tool.execute({ command: 'exit 1' });
    expect(result).toContain('退出码: 1');
  });

  it('拦截危险命令 rm -rf /', async () => {
    const result = await tool.execute({ command: 'rm -rf / --no-preserve-root' });
    expect(result).toContain('安全拒绝');
  });

  it('拦截 dd 命令', async () => {
    const result = await tool.execute({ command: 'dd if=/dev/zero of=/dev/sda' });
    expect(result).toContain('安全拒绝');
  });

  it('拦截 shutdown 命令', async () => {
    const result = await tool.execute({ command: 'shutdown -h now' });
    expect(result).toContain('安全拒绝');
  });

  it('命令超时时终止并返回提示', async () => {
    const slowTool = createShellTool({ workingDir: '/tmp', timeout: 1 });
    const result = await slowTool.execute({ command: 'sleep 10' });
    expect(result).toContain('超时');
  }, 5000);
});
