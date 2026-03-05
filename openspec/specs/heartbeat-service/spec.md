## 新增需求

### 需求:定时检查 HEARTBEAT.md
HeartbeatService 必须每隔 `intervalSeconds`（默认 1800s）读取 `workspace/HEARTBEAT.md`，判断是否有活跃任务。

#### 场景:定时触发检查
- **当** HeartbeatService 运行且到达检查间隔时
- **那么** 必须读取 HEARTBEAT.md，进行两阶段决策

#### 场景:文件不存在时跳过
- **当** HEARTBEAT.md 不存在或为空时
- **那么** 必须跳过本次检查，不调用 LLM，不报错

### 需求:Phase 1 — LLM tool-call 决策 skip/run
HeartbeatService 必须通过 LLM 的 `heartbeat` 虚拟工具（action: skip|run）决定是否执行任务，禁止文本解析。

#### 场景:LLM 决策 skip
- **当** HEARTBEAT.md 无活跃任务，LLM 返回 `action: "skip"` 时
- **那么** 必须跳过执行阶段，记录日志

#### 场景:LLM 决策 run
- **当** HEARTBEAT.md 有活跃任务，LLM 返回 `action: "run", tasks: "..."` 时
- **那么** 必须进入 Phase 2 执行阶段

#### 场景:LLM 未调用工具
- **当** LLM 响应不含工具调用时
- **那么** 必须默认 skip，不执行

### 需求:Phase 2 — 调用 onExecute 执行任务
当 Phase 1 决策为 run 时，HeartbeatService 必须调用 `onExecute(tasks)` 回调进入完整 agent loop。

#### 场景:执行回调并通知
- **当** Phase 1 返回 run 且 onExecute 已设置时
- **那么** 必须调用 `onExecute(tasks)` 获取结果，若有结果且 onNotify 已设置则调用通知回调

### 需求:支持手动触发
HeartbeatService 必须提供 `triggerNow()` 方法，允许手动立即执行一次 heartbeat 检查。

#### 场景:手动触发
- **当** 调用 `triggerNow()` 时
- **那么** 必须立即执行完整的两阶段流程，返回执行结果
