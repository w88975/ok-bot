---
name: memory
description: 管理 agent 的长期记忆和历史日志
ok-bot:
  always: true
  requires:
    bins: []
    env: []
---

# Memory（记忆管理）

## 记忆文件位置

- **长期记忆**：`{workspace}/memory/MEMORY.md`（写入重要事实、用户偏好、项目信息）
- **历史日志**：`{workspace}/memory/HISTORY.md`（grep 可搜索的时间线，每条以 `[YYYY-MM-DD HH:MM]` 开头）

## 何时写入记忆

主动将以下内容写入 MEMORY.md：
- 用户的重要偏好、习惯、个人信息
- 项目关键决策和背景
- 你学到的重要事实

## 使用 read_file 和 edit_file 管理记忆

读取当前记忆：
```
read_file("{workspace}/memory/MEMORY.md")
```

更新记忆（追加新内容）：
```
edit_file("{workspace}/memory/MEMORY.md", old_str="...", new_str="...")
```

搜索历史（使用 exec）：
```
exec("grep '关键词' {workspace}/memory/HISTORY.md")
```

## 记忆格式示例

```markdown
# 用户信息
- 名字：张三
- 时区：Asia/Shanghai
- 偏好：简洁回答，中文交流

# 项目
- ok-bot：TypeScript 多 agent 框架，位于 ~/workspace/ok-bot

# 偏好
- 代码注释：中文
- 包管理器：pnpm
```
