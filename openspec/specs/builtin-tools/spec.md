## 新增需求

### 需求:文件系统工具（read/write/edit/list）
必须提供读取、写入、编辑（字符串替换）、列目录四个文件系统工具，支持 workspace 限制模式。

#### 场景:读取文件
- **当** agent 调用 `read_file(path)` 时
- **那么** 必须返回文件内容；文件不存在时返回错误描述

#### 场景:写入文件
- **当** agent 调用 `write_file(path, content)` 时
- **那么** 必须写入内容，自动创建父目录

#### 场景:编辑文件（字符串替换）
- **当** agent 调用 `edit_file(path, old_str, new_str)` 时
- **那么** 必须在文件中替换第一个匹配的 old_str；old_str 不存在时返回错误

#### 场景:列目录
- **当** agent 调用 `list_dir(path)` 时
- **那么** 必须返回目录内容的文件/目录名称列表（含类型标记）

#### 场景:workspace 限制模式
- **当** 启用 `restrictToWorkspace: true` 且访问 workspace 外路径时
- **那么** 必须拒绝操作并返回权限错误

### 需求:Shell 执行工具（exec）
必须提供执行 shell 命令的工具，支持超时控制和危险命令黑名单。

#### 场景:正常执行命令
- **当** agent 调用 `exec(command)` 时
- **那么** 必须在 workspace 目录执行命令，返回 stdout + stderr（合并）

#### 场景:超时控制
- **当** 命令执行时间超过 `timeout`（默认 60s）时
- **那么** 必须强制终止进程，返回超时错误信息

#### 场景:危险命令拦截
- **当** 命令匹配危险模式（如 `rm -rf /`、`dd`、`shutdown`、`format` 等）时
- **那么** 必须拒绝执行，返回安全提示

#### 场景:输出截断
- **当** 命令输出超过 10000 字符时
- **那么** 必须截断并追加截断说明

### 需求:Web 搜索工具（web_search）
必须提供 web 搜索工具（Brave Search API），查询并返回搜索结果摘要。

#### 场景:正常搜索
- **当** agent 调用 `web_search(query)` 时
- **那么** 必须返回搜索结果列表（标题、URL、摘要）

#### 场景:API Key 未配置
- **当** Brave API Key 未配置时
- **那么** 必须返回提示信息，不抛出异常

### 需求:Web 抓取工具（web_fetch）
必须提供抓取网页内容的工具，返回 markdown 格式正文。

#### 场景:抓取网页
- **当** agent 调用 `web_fetch(url)` 时
- **那么** 必须返回网页正文的 markdown 格式内容

### 需求:消息发送工具（message）
必须提供向指定 channel/chat_id 发送消息的工具，并追踪本轮是否已发送。

#### 场景:发送消息
- **当** agent 调用 `message(content, channel?, chat_id?)` 时
- **那么** 必须通过 MessageBus 发布 OutboundMessage 到目标

#### 场景:本轮已发送标记
- **当** 本轮 agent loop 中 message 工具被调用时
- **那么** AgentLoop 必须跳过最终的默认回复（避免双重响应）

### 需求:Spawn 子 agent 工具（spawn）
必须提供触发后台子 agent 的工具，使主 agent 可以委托长任务。

#### 场景:派生子 agent
- **当** agent 调用 `spawn(task, label?)` 时
- **那么** 必须启动后台 SubagentManager.spawn，立即返回确认消息
