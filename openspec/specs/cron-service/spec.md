## 新增需求

### 需求:支持三种调度类型
CronService 必须支持 `at`（一次性定时）、`every`（间隔重复）、`cron`（cron 表达式）三种调度类型。

#### 场景:一次性 at 调度
- **当** 添加 `schedule: { kind: "at", atMs: <timestamp> }` 的任务时
- **那么** 必须在指定时间戳执行一次，执行后禁用或删除（由 deleteAfterRun 决定）

#### 场景:间隔 every 调度
- **当** 添加 `schedule: { kind: "every", everyMs: <ms> }` 的任务时
- **那么** 必须每隔指定毫秒执行一次，持续重复

#### 场景:cron 表达式调度
- **当** 添加 `schedule: { kind: "cron", expr: "0 9 * * 1-5" }` 的任务时
- **那么** 必须按 cron 表达式计算下次执行时间并触发

### 需求:支持 IANA 时区
CronService 的 cron 表达式调度必须支持 IANA 时区（如 `Asia/Shanghai`、`America/Vancouver`）。

#### 场景:时区感知调度
- **当** 添加含 `tz: "America/Vancouver"` 的 cron 任务时
- **那么** 必须以该时区解析 cron 表达式，计算正确的 UTC 执行时间

#### 场景:时区仅限 cron 类型
- **当** 为 at 或 every 类型添加 tz 参数时
- **那么** 必须抛出验证错误

### 需求:持久化任务到 cron.json
CronService 必须将所有任务持久化到 `workspace/cron.json`，服务重启后自动恢复。

#### 场景:添加任务后持久化
- **当** 调用 `addJob(...)` 时
- **那么** 必须立即将任务写入 cron.json

#### 场景:服务启动时恢复任务
- **当** CronService 启动且 cron.json 存在时
- **那么** 必须从文件加载所有任务并重新计算下次执行时间

### 需求:timer 链式调度（非轮询）
CronService 必须使用 timer 链（每次执行完后 re-arm 下一个 timer），禁止使用固定间隔轮询。

#### 场景:精准 timer 调度
- **当** 存在多个任务时
- **那么** 必须找到最早的 nextRunAt，设置一个精准 timer，执行到期任务后重新 arm

### 需求:支持任务的增删查改
CronService 必须提供完整的任务管理 API：list、add、remove、enable/disable、run（手动触发）。

#### 场景:列出任务
- **当** 调用 `listJobs()` 时
- **那么** 必须按 nextRunAt 升序返回所有启用的任务

#### 场景:删除任务
- **当** 调用 `removeJob(jobId)` 时
- **那么** 必须从 cron.json 中删除并立即 re-arm timer
