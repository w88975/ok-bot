## 新增需求

### 需求:群组定义与内存存储
WebChannel 必须在内存中维护群组定义（`Map<groupId, GroupInfo>`），服务器重启后群组丢失，客户端重建。

#### 场景:创建群组
- **当** 客户端发送 `{ type: "create-group", groupId: "g1", agentIds: ["a", "b"] }`
- **那么** 服务器创建群组，推送 `{ type: "group-created", group: GroupInfo }` 给所有客户端

#### 场景:agentId 不存在时拒绝创建
- **当** agentIds 中包含不存在的 agent
- **那么** 服务器推送 `{ type: "error", message: "Agent xxx 不存在" }` 给发起方

---

### 需求:群组消息广播
群组消息必须并发发送给群组内所有（或 mention 指定的）agent，各 agent 回复独立推送。

#### 场景:无 mention 时广播全部 agent
- **当** 客户端发送 `{ type: "group-chat", groupId: "g1", content: "大家好" }`（无 mentions）
- **那么** 消息并发发送给 g1 内所有 agent，各 agent 回复独立以 `{ type: "message", agentId, groupId: "g1", content }` 推送给发起方

#### 场景:@mention 路由到指定 agent
- **当** 客户端发送 `{ type: "group-chat", groupId: "g1", content: "@a 你好", mentions: ["a"] }`
- **那么** 只有 agent "a" 收到消息并回复，其他 agent 不响应

#### 场景:某个 agent 回复失败不影响其他
- **当** 群组内某个 agent 回复出错
- **那么** 推送该 agent 的错误消息，其他 agent 的正常回复照常推送

---

### 需求:群组成员管理
必须支持向现有群组添加或移除 agent 成员。

#### 场景:添加 agent 到群组
- **当** 客户端发送 `{ type: "update-group", groupId: "g1", addAgentIds: ["c"] }`
- **那么** agent "c" 加入群组，服务器广播更新后的 `group-status`

#### 场景:从群组移除 agent
- **当** 客户端发送 `{ type: "update-group", groupId: "g1", removeAgentIds: ["b"] }`
- **那么** agent "b" 离开群组，服务器广播更新后的 `group-status`

#### 场景:群组成员少于 2 时自动解散
- **当** 移除后群组内 agent 数量少于 2
- **那么** 群组自动解散，推送 `{ type: "group-dissolved", groupId }`
