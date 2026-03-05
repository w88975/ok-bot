## 新增需求

### 需求:读写长期记忆文件
MemoryStore 必须支持读写 `workspace/memory/MEMORY.md`，存储跨会话的长期事实。

#### 场景:读取长期记忆
- **当** 调用 `readLongTerm()` 时
- **那么** 必须返回 MEMORY.md 内容；文件不存在时返回空字符串

#### 场景:写入长期记忆
- **当** 调用 `writeLongTerm(content)` 时
- **那么** 必须将内容写入 MEMORY.md，自动创建 memory 目录（若不存在）

### 需求:追加历史日志
MemoryStore 必须支持向 `workspace/memory/HISTORY.md` 追加 grep-searchable 的历史条目。

#### 场景:追加历史条目
- **当** 调用 `appendHistory(entry)` 时
- **那么** 必须以追加模式写入 HISTORY.md，每条条目以 `[YYYY-MM-DD HH:MM]` 开头，末尾空行分隔

### 需求:LLM 驱动的记忆 consolidation
MemoryStore 必须支持通过 LLM tool-call（`save_memory` 虚拟工具）将旧会话消息 consolidate 到 MEMORY.md 和 HISTORY.md。

#### 场景:正常 consolidation
- **当** 调用 `consolidate(session, provider, model)` 时
- **那么** 必须提取待归档消息，调用 LLM 的 save_memory tool，将结果写入 MEMORY.md 和 HISTORY.md，更新 session.lastConsolidated

#### 场景:LLM 未调用 save_memory 工具
- **当** LLM 响应不含 save_memory 工具调用时
- **那么** consolidate 必须返回 false，不修改任何文件

#### 场景:全量归档（/new 命令）
- **当** 以 `archiveAll: true` 调用 `consolidate` 时
- **那么** 必须归档 session 中所有消息，consolidation 完成后 session 可安全清空

### 需求:提供记忆上下文字符串
MemoryStore 必须提供格式化的记忆上下文供 ContextBuilder 注入 system prompt。

#### 场景:获取记忆上下文
- **当** 调用 `getMemoryContext()` 时
- **那么** 若 MEMORY.md 有内容，必须返回 `## Long-term Memory\n{content}` 格式字符串；无内容时返回空字符串
