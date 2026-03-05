## 新增需求

### 需求:从 workspace 加载引导文件
FileBootstrapLoader 必须从 workspace 根目录读取预定义的引导文件列表（AGENTS.md、SOUL.md、USER.md、TOOLS.md），拼接为一个字符串注入 system prompt。

#### 场景:文件存在时加载
- **当** workspace 根目录存在 AGENTS.md 等引导文件时
- **那么** 必须读取文件内容，以 `## {filename}\n\n{content}` 格式拼接，各文件之间用 `\n\n` 分隔

#### 场景:文件不存在时跳过
- **当** workspace 根目录不存在某个引导文件时
- **那么** 必须静默跳过该文件，不报错，不影响其他文件加载

#### 场景:所有文件均不存在
- **当** workspace 根目录不存在任何引导文件时
- **那么** 必须返回空字符串，ContextBuilder 不应注入空节

### 需求:引导文件加载顺序固定
FileBootstrapLoader 必须按固定顺序加载：AGENTS.md → SOUL.md → USER.md → TOOLS.md。

#### 场景:顺序一致性
- **当** 多次调用 `load()` 时
- **那么** 每次返回内容的文件顺序必须相同
