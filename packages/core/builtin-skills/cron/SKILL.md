---
name: cron
description: 设置定时提醒和周期性任务
ok-bot:
  always: false
  requires:
    bins: []
    env: []
---

# Cron（定时任务）

使用 `cron` 工具设置提醒或周期性任务。

## 三种模式

1. **提醒** — 直接向用户发送消息
2. **任务** — 描述一个任务，到期时 agent 执行并发送结果
3. **一次性** — 指定时间执行一次后自动删除

## 示例

固定间隔提醒：
```
cron(action="add", message="该休息了！", every_seconds=1200)
```

动态任务（每次执行时 agent 处理）：
```
cron(action="add", message="检查 GitHub 最新 PR 并汇报", every_seconds=3600)
```

一次性定时任务（从当前时间计算 ISO datetime）：
```
cron(action="add", message="提醒我开会", at="<ISO datetime>")
```

时区感知的 cron 表达式：
```
cron(action="add", message="早会提醒", cron_expr="0 9 * * 1-5", tz="Asia/Shanghai")
```

列出 / 删除：
```
cron(action="list")
cron(action="remove", job_id="abc123")
```

## 时间表达式参考

| 用户表述 | 参数 |
|---------|------|
| 每 20 分钟 | every_seconds: 1200 |
| 每小时 | every_seconds: 3600 |
| 每天早上 8 点 | cron_expr: "0 8 * * *" |
| 工作日下午 5 点 | cron_expr: "0 17 * * 1-5" |
| 上海时间每天 9 点 | cron_expr: "0 9 * * *", tz: "Asia/Shanghai" |
| 指定时刻 | at: ISO datetime 字符串（从当前时间计算） |

## 时区说明

`tz` 参数使用 IANA 时区名称（如 `Asia/Shanghai`、`America/Vancouver`）。
不指定 `tz` 时使用服务器本地时区。
`tz` 参数仅对 `cron_expr` 模式有效。
