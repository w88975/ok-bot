/**
 * ok-bot 快速启动脚本（CLI 交互模式，支持流式进度输出）
 *
 * 运行：node start.mjs
 */

import { AgentLoop, VercelAIProvider, MessageBus } from "./packages/core/dist/index.js";
import readline from "node:readline";
import os from "node:os";
import path from "node:path";

const WORKSPACE = path.join(os.homedir(), "ok-bot-workspace/华二");

// ANSI 颜色辅助
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

const provider = new VercelAIProvider({
  model: "openai-compat:qwen-max",
  apiKey: "sk-c98a09f4df3442f49ab7e7b5b132b49e",
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const bus = new MessageBus();

const agentLoop = new AgentLoop({
  id: "default",
  workspace: WORKSPACE,
  provider,
  bus,
  maxIterations: 20,
  temperature: 0.1,
  maxTokens: 4096,
});

// 追踪上一次输出是否为流式 token（用于在 onProgress 前换行）
let lastWasToken = false;
// 追踪本轮是否有过 token 输出（用于判断结束时是否需要额外换行）
let tokenStreamed = false;

/**
 * SSE 流式 token 回调 — LLM 每生成一个 token 立即调用
 * @param {string} token
 */
function onToken(token) {
  process.stdout.write(token);
  lastWasToken = true;
  tokenStreamed = true;
}

/**
 * 进度回调 — 在 AgentLoop 每轮工具迭代时调用（工具提示等）
 * @param {string} content
 * @param {{ toolHint?: boolean }} [opts]
 */
function onProgress(content, opts) {
  if (!content) return;
  // 若前面有流式 token 输出，先补一个换行避免内容粘连
  if (lastWasToken) {
    process.stdout.write("\n");
    lastWasToken = false;
  }
  if (opts?.toolHint) {
    process.stdout.write(dim(`  ⚙ ${content}`) + "\n");
  } else {
    process.stdout.write(dim(`  ${content}`) + "\n");
  }
}

async function main() {
  console.log("正在启动 ok-bot...");
  console.log(`✅ ok-bot 已就绪（workspace: ${WORKSPACE}）`);
  console.log("输入消息开始对话，输入 /exit 退出\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const ask = () => {
    rl.question("你: ", async (input) => {
      const text = input.trim();
      if (!text) {
        ask();
        return;
      }
      if (text === "/exit" || text === "/quit") {
        console.log("正在关闭...");
        rl.close();
        process.exit(0);
      }

      try {
        process.stdout.write("\n" + cyan("ok-bot:") + "\n");

        // 重置流式状态
        lastWasToken = false;
        tokenStreamed = false;

        const response = await agentLoop.processMessage(
          { channel: "cli", senderId: "user", chatId: "cli:local", content: text },
          onProgress,
          onToken,
        );

        if (response) {
          if (tokenStreamed) {
            // 内容已通过 onToken 逐 token 输出，只需补换行
            process.stdout.write("\n");
          } else {
            // 未使用流式（如 /help 等内置命令），直接打印
            console.log(response.content);
          }
        }
        console.log();
      } catch (err) {
        console.error("错误:", err.message);
      }
      ask();
    });
  };

  ask();
}

main().catch((err) => {
  console.error("启动失败:", err);
  process.exit(1);
});
