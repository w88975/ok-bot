/**
 * ok-bot 快速启动脚本（CLI 交互模式，支持结构化事件流式输出）
 *
 * 运行：node start.mjs
 *
 * 使用 OnEvent API：message_start → think_* / text_delta / tool_* → message_end
 */

import {
  AgentLoop,
  VercelAIProvider,
  MessageBus,
} from "./packages/core/dist/index.js";
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
  maxIterations: 200,
  temperature: 0.1,
  maxTokens: 4096,
});

// 是否正在输出流式内容（用于在 tool_start 等前换行）
let streaming = false;
// 本轮是否已有流式输出（用于结束时判断是否再打印 response.content）
let hadStreamingThisTurn = false;

/**
 * 结构化事件回调 — 按 AgentEvent 类型在终端展示
 * @param {import('@ok-bot/core').AgentEvent} event
 */
function onEvent(event) {
  switch (event.type) {
    case "message_start":
      streaming = false;
      hadStreamingThisTurn = false;
      break;

    case "think_start":
      if (streaming) process.stdout.write("\n");
      process.stdout.write(dim("  💭 思考中…\n"));
      streaming = false;
      break;

    case "think_delta":
      process.stdout.write(dim(event.content));
      streaming = true;
      hadStreamingThisTurn = true;
      break;

    case "think_end":
      process.stdout.write("\n");
      streaming = false;
      break;

    case "text_delta":
      process.stdout.write(event.content);
      streaming = true;
      hadStreamingThisTurn = true;
      break;

    case "tool_start":
      if (streaming) process.stdout.write("\n");
      const argsPreview =
        typeof event.arguments?.command === "string"
          ? event.arguments.command.slice(0, 50)
          : JSON.stringify(event.arguments).slice(0, 50);
      process.stdout.write(dim(`  ⚙ ${event.name}(${argsPreview}${argsPreview.length >= 50 ? "…" : ""})\n`));
      streaming = false;
      break;

    case "tool_stdout":
      process.stdout.write(dim(event.data));
      streaming = true;
      break;

    case "tool_end":
      if (streaming) process.stdout.write("\n");
      streaming = false;
      break;

    case "message_end":
      if (streaming) process.stdout.write("\n");
      streaming = false;
      break;

    case "error":
      if (streaming) process.stdout.write("\n");
      process.stderr.write(`\x1b[31m错误: ${event.message}\x1b[0m\n`);
      streaming = false;
      break;

    default:
      break;
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

        const response = await agentLoop.processMessage(
          { channel: "cli", senderId: "user", chatId: "cli:local", content: text },
          onEvent,
        );

        if (response) {
          // 未走流式（如 /help、/new 等）时直接打印
          if (!hadStreamingThisTurn && response.content) {
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
