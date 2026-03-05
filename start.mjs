/**
 * ok-bot 快速启动脚本（CLI 交互模式）
 * 使用 GLM-4.7 模型，workspace: ~/ok-bot-workspace/
 *
 * 运行：node start.mjs
 */

import { AgentManager } from './packages/core/dist/index.js';
import readline from 'node:readline';
import os from 'node:os';
import path from 'node:path';

const WORKSPACE = path.join(os.homedir(), 'ok-bot-workspace');
const AGENT_ID = 'default';

const manager = new AgentManager();

async function main() {
  console.log('正在启动 ok-bot（GLM-4.7）...');

  await manager.createAgent({
    id: AGENT_ID,
    workspace: WORKSPACE,
    provider: {
      model: 'openai-compat:GLM-4.7',
      apiKey: 'b48f6385caae44199023e2bbd5aad30b.W9S0WZRbBO8OBbuO',
      baseURL: 'https://api.z.ai/api/coding/paas/v4',
    },
    maxIterations: 20,
    temperature: 0.1,
    maxTokens: 4096,
  });

  console.log(`✅ ok-bot 已就绪（workspace: ${WORKSPACE}）`);
  console.log('输入消息开始对话，输入 /exit 退出\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const ask = () => {
    rl.question('你: ', async (input) => {
      const text = input.trim();
      if (!text) { ask(); return; }
      if (text === '/exit' || text === '/quit') {
        console.log('正在关闭...');
        await manager.shutdown();
        rl.close();
        process.exit(0);
      }

      try {
        process.stdout.write('ok-bot: ');
        const response = await manager.chat({
          agentId: AGENT_ID,
          content: text,
          channel: 'cli',
          chatId: 'cli:local',
        });
        console.log(response.content);
        console.log();
      } catch (err) {
        console.error('错误:', err.message);
      }
      ask();
    });
  };

  ask();
}

main().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
