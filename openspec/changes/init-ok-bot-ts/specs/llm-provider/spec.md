## 新增需求

### 需求:统一封装 Vercel AI SDK generateText
VercelAIProvider 必须封装 Vercel AI SDK 的 `generateText`，提供统一的 `chat(messages, tools, options)` 接口，屏蔽各 provider 差异。

#### 场景:调用 LLM 并返回文本
- **当** 调用 `provider.chat({ messages, model, temperature, maxTokens })` 且 LLM 返回文本时
- **那么** 必须返回含 `content` 的 `LLMResponse`，`hasToolCalls` 为 false

#### 场景:调用 LLM 并返回工具调用
- **当** LLM 响应包含工具调用时
- **那么** 必须返回含 `toolCalls` 数组的 `LLMResponse`，每个 toolCall 含 `id`、`name`、`arguments`

### 需求:支持主流 LLM providers
VercelAIProvider 必须通过 Vercel AI SDK 支持 OpenAI、Anthropic、Google Gemini、Groq、DeepSeek 等 provider。

#### 场景:切换 provider
- **当** 配置不同的 model string（如 `openai:gpt-4o`、`anthropic:claude-3-5-sonnet`）时
- **那么** 必须路由到对应的 Vercel AI SDK provider，不需修改其他代码

### 需求:清理空内容防止 provider 报错
VercelAIProvider 必须在发送请求前过滤消息中的空字符串内容，防止各 provider 因空 content 返回 400 错误。

#### 场景:过滤空 content
- **当** messages 中存在 content 为空字符串的消息时
- **那么** 必须替换为占位文本 `"(empty)"` 或 null（assistant + tool_calls 时），再发送请求

### 需求:提供默认 model 名称
VercelAIProvider 必须提供 `getDefaultModel()` 方法，返回默认使用的 model 标识符。

#### 场景:获取默认 model
- **当** 调用 `provider.getDefaultModel()` 时
- **那么** 必须返回配置的默认 model 字符串（如 `"openai:gpt-4o-mini"`）
