## 新增需求

### 需求:ProviderConfig 支持 thinking 字段
`ProviderConfig` 必须支持可选的 `thinking` 字段，类型为 `{ enabled: boolean; budgetTokens?: number }`。`budgetTokens` 仅对 Anthropic provider 有效，其他 provider 必须忽略此字段而不报错。

#### 场景:Anthropic 模型开启深度思考
- **当** `ProviderConfig.thinking.enabled` 为 `true` 且 provider 为 `anthropic`
- **那么** `VercelAIProvider` 必须在调用 `streamText` 时传入 `providerOptions: { anthropic: { thinking: { type: 'enabled', budgetTokens: N } } }`

#### 场景:非 Anthropic 模型忽略 thinking 配置
- **当** `ProviderConfig.thinking.enabled` 为 `true` 且 provider 为 `openai-compat` 或其他
- **那么** `VercelAIProvider` 必须不传任何 thinking 相关参数，不得抛出错误

#### 场景:未配置 thinking 时默认关闭
- **当** `ProviderConfig.thinking` 未配置或为 `undefined`
- **那么** `VercelAIProvider` 禁止传入任何 thinking 参数

---

### 需求:think_start/delta/end 事件在推理时 emit
系统必须在 LLM 输出 reasoning 内容时 emit `think_start`、`think_delta`（N 次）、`think_end` 事件。如果模型不输出 reasoning 内容，这三个事件必须不出现在事件流中。

#### 场景:有 reasoning 内容时三个事件成对出现
- **当** `VercelAIProvider.fullStream` 产生至少一个 `reasoning` chunk
- **那么** 必须先 emit `think_start`，然后每个 chunk emit `think_delta { content }`，最后 emit `think_end`

#### 场景:无 reasoning 内容时不 emit think 事件
- **当** `VercelAIProvider.fullStream` 没有任何 `reasoning` chunk（如 GLM-4.7、qwen-max）
- **那么** 事件流中禁止出现 `think_start`、`think_delta`、`think_end`

#### 场景:think_delta 内容为流式分片
- **当** LLM 推理过程中 emit `think_delta`
- **那么** 每个 `think_delta.content` 为字符级别的增量文本片段，多个 think_delta 拼接后等于完整推理内容
