/**
 * AgentEvent — agent 执行过程的结构化事件类型
 *
 * 覆盖五个阶段：消息生命周期、深度思考、文本输出、工具调用、错误。
 * SSE event name 直接等于 AgentEvent.type，server 层零转换。
 */

/** agent 执行过程中产生的结构化事件联合类型 */
export type AgentEvent =
  // ── 消息生命周期 ──────────────────────────────────────────────────────────
  /** 整个 processMessage 开始，必须是第一个事件 */
  | { type: 'message_start' }
  /** 整个 processMessage 结束，content 为 LLM 最终输出文本；必须是最后一个正常事件 */
  | { type: 'message_end'; content: string }

  // ── 深度思考（仅支持 reasoning 的模型才会 emit） ──────────────────────────
  | { type: 'think_start' }
  /** LLM 推理过程的增量文本片段，多个 think_delta 拼接等于完整推理内容 */
  | { type: 'think_delta'; content: string }
  | { type: 'think_end' }

  // ── 文本输出 ─────────────────────────────────────────────────────────────
  /** LLM 输出文本的增量 token */
  | { type: 'text_delta'; content: string }

  // ── 工具调用 ─────────────────────────────────────────────────────────────
  /** 工具调用开始，callId 在同一次调用的三个事件中保持一致 */
  | { type: 'tool_start'; callId: string; name: string; arguments: Record<string, unknown> }
  /** 工具（如 Shell）执行期间的实时 stdout/stderr 数据片段 */
  | { type: 'tool_stdout'; callId: string; data: string }
  /** 工具调用结束，result 为完整返回值，不截断 */
  | { type: 'tool_end'; callId: string; result: string }

  // ── 错误 ──────────────────────────────────────────────────────────────────
  /** 执行过程中发生错误，message_end 不会再出现 */
  | { type: 'error'; message: string };

/**
 * OnEvent 回调类型
 * 接收 AgentEvent，替代原有的 OnToken + OnProgress 双回调。
 * 可以是同步或异步函数。
 */
export type OnEvent = (event: AgentEvent) => Promise<void> | void;
