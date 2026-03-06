/**
 * ok-bot 共享类型定义
 * 供 AgentManager、AgentLoop、AgentWorker 等模块共用
 */

/** Agent 运行状态 */
export type AgentStatus = 'starting' | 'running' | 'stopped' | 'error';

/**
 * Agent 配置项
 * 创建 AgentInstance 时传入的完整配置
 */
export interface AgentConfig {
  /** agent 唯一标识符 */
  id: string;
  /** workspace 绝对路径 */
  workspace: string;
  /** LLM provider 配置 */
  provider: ProviderConfig;
  /** 最大迭代次数（默认 40） */
  maxIterations?: number;
  /** 模型温度参数（默认 0.1） */
  temperature?: number;
  /** 最大输出 token 数（默认 4096） */
  maxTokens?: number;
  /** 会话历史滑动窗口大小（默认 100） */
  memoryWindow?: number;
  /** 是否限制文件操作在 workspace 内（默认 false） */
  restrictToWorkspace?: boolean;
  /** Brave Search API Key（用于 web_search 工具） */
  braveApiKey?: string;
  /** Shell 工具配置 */
  execConfig?: ExecConfig;
  /** MCP server 配置（server 名称 → 连接配置） */
  mcpServers?: Record<string, McpServerConfig>;
  /** Heartbeat 检查间隔秒数（默认 1800） */
  heartbeatIntervalSeconds?: number;
}

/** LLM Provider 配置 */
export interface ProviderConfig {
  /**
   * 模型标识符，格式："{provider}:{model}"
   * 例如："openai:gpt-4o"、"openai-compat:GLM-4.7"
   * 支持的 provider：openai、anthropic、google、groq、openai-compat
   */
  model: string;
  /** API Key（优先于环境变量） */
  apiKey?: string;
  /**
   * 自定义 API 端点（OpenAI 兼容协议）
   * 用于接入 GLM、DeepSeek、Qwen 等第三方服务
   * 例如："https://api.z.ai/api/coding/paas/v4"
   */
  baseURL?: string;
}

/** Shell exec 工具配置 */
export interface ExecConfig {
  /** 命令超时秒数（默认 60） */
  timeout?: number;
  /** 追加到 PATH 的额外路径 */
  pathAppend?: string;
}

/** MCP server 连接配置 */
export interface McpServerConfig {
  /** 传输类型 */
  transport: 'stdio' | 'sse';
  /** stdio 模式：命令路径 */
  command?: string;
  /** stdio 模式：命令参数 */
  args?: string[];
  /** SSE 模式：服务器 URL */
  url?: string;
  /** 环境变量（stdio 模式） */
  env?: Record<string, string>;
}

/** Agent 运行时状态信息 */
export interface AgentInfo {
  /** agent id */
  id: string;
  /** workspace 路径 */
  workspace: string;
  /** 当前运行状态 */
  status: AgentStatus;
}

/** Worker Thread 消息协议 — 入站（主线程 → Worker） */
export interface WorkerInboundMessage {
  type: 'message' | 'shutdown';
  /** 入站消息载荷（type='message' 时有效） */
  payload?: import('./bus/events.js').InboundMessage;
  /** 请求 ID，用于匹配响应 */
  requestId?: string;
}

/** Worker Thread 消息协议 — 出站（Worker → 主线程） */
export interface WorkerOutboundMessage {
  type: 'response' | 'error' | 'ready' | 'token' | 'progress';
  /** 出站消息载荷（type='response' 时有效） */
  payload?: import('./bus/events.js').OutboundMessage;
  /** 对应请求 ID */
  requestId?: string;
  /** 错误信息（type='error' 时有效） */
  error?: string;
  /** 流式 token 文本（type='token' 时有效） */
  token?: string;
  /** 工具调用进度提示（type='progress' 时有效） */
  hint?: string;
}
