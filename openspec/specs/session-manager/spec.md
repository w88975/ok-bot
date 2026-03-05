## 新增需求

### 需求:基于 JSONL 文件持久化会话历史
SessionManager 必须将每个 session 的消息历史存储为 JSONL 文件（`workspace/sessions/{sessionKey}.jsonl`），每行一条 JSON 消息。

#### 场景:保存会话
- **当** 调用 `save(session)` 时
- **那么** 必须将 session.messages 写入对应的 JSONL 文件，自动创建目录

#### 场景:加载已有会话
- **当** 调用 `getOrCreate(sessionKey)` 且对应 JSONL 文件存在时
- **那么** 必须从文件读取所有消息，返回完整的 Session 对象

#### 场景:创建新会话
- **当** 调用 `getOrCreate(sessionKey)` 且文件不存在时
- **那么** 必须返回空 Session 对象（messages 为空数组，lastConsolidated 为 0）

### 需求:支持滑动窗口读取历史
SessionManager 必须支持按最大消息数截取最近的历史记录，避免 context 过长。

#### 场景:截取最近历史
- **当** 调用 `session.getHistory(maxMessages: 100)` 时
- **那么** 必须返回最后 maxMessages 条消息

### 需求:支持清空会话
SessionManager 必须支持清空指定 session 的所有消息，并从磁盘删除对应文件。

#### 场景:清空会话
- **当** 调用 `session.clear()` 后再 `save(session)` 时
- **那么** 对应 JSONL 文件必须被清空或删除

### 需求:使缓存失效
SessionManager 必须提供使内存缓存失效的方法，强制下次 getOrCreate 从磁盘重新读取。

#### 场景:失效缓存
- **当** 调用 `invalidate(sessionKey)` 时
- **那么** 下次 getOrCreate 必须重新从磁盘读取，而非返回缓存
