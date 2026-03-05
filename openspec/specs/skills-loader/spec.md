## 新增需求

### 需求:workspace skills 优先覆盖内置 skills
SkillsLoader 必须优先使用 `workspace/skills/{name}/SKILL.md`，若不存在则回退到 `builtin-skills/{name}/SKILL.md`。

#### 场景:workspace skill 覆盖内置
- **当** workspace 和 builtin 都存在同名 skill 时
- **那么** 必须使用 workspace 版本，忽略 builtin 版本

#### 场景:仅内置 skill 存在
- **当** workspace 不存在该 skill，但 builtin 存在时
- **那么** 必须返回 builtin 版本内容

### 需求:解析 SKILL.md frontmatter 元数据
SkillsLoader 必须解析 SKILL.md 的 YAML frontmatter，提取 `name`、`description`、`ok-bot.always`、`ok-bot.requires.bins`、`ok-bot.requires.env` 等字段。

#### 场景:解析带 frontmatter 的 SKILL.md
- **当** SKILL.md 以 `---` 开头包含 YAML frontmatter 时
- **那么** 必须正确解析所有元数据字段，加载内容时必须 strip 掉 frontmatter

#### 场景:无 frontmatter 的 SKILL.md
- **当** SKILL.md 不含 frontmatter 时
- **那么** 必须返回完整文件内容，元数据字段使用默认值

### 需求:检查 skill 可用性（bins + env）
SkillsLoader 必须检查 `ok-bot.requires.bins` 和 `ok-bot.requires.env` 的满足情况，决定 skill 是否可用。

#### 场景:所有依赖满足
- **当** requires.bins 中的所有命令存在于 PATH，requires.env 中的所有环境变量已设置时
- **那么** skill 的 available 必须为 true

#### 场景:缺少依赖
- **当** 某个 bin 不在 PATH 或某个 env 变量未设置时
- **那么** skill 的 available 必须为 false，缺少的依赖必须记录在 requires 字段中

### 需求:构建 XML 格式 skills 摘要
SkillsLoader 必须生成 XML 格式的 skills 摘要，供 ContextBuilder 注入 system prompt，agent 可用 read_file 按需加载完整内容。

#### 场景:构建 skills 摘要
- **当** 调用 `buildSkillsSummary()` 时
- **那么** 必须返回包含所有 skill 的 `<skills>` XML，每个 `<skill>` 包含 available、name、description、location 子元素

### 需求:获取 always skills 内容
SkillsLoader 必须返回所有标记为 `always: true` 且可用的 skill 的完整内容，供 ContextBuilder 始终注入 system prompt。

#### 场景:获取 always skills
- **当** 调用 `getAlwaysSkills()` 时
- **那么** 必须返回所有 `always: true` 且 available 为 true 的 skill 内容列表（已 strip frontmatter）

### 需求:缓存 skill 内容
SkillsLoader 在同一进程生命周期内必须缓存已读取的 skill 内容，避免重复磁盘 IO。

#### 场景:缓存命中
- **当** 同一 skill 被多次请求时
- **那么** 第二次及以后必须从内存缓存返回，不再读取磁盘
