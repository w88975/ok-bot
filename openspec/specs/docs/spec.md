## 新增需求

### 需求:TypeDoc 从 JSDoc 生成 API 文档
必须配置 TypeDoc，从 `@ok-bot/core` 的 JSDoc 注释自动生成 HTML API 参考文档（含参数、返回值、类型）。

#### 场景:生成 API 文档
- **当** 运行 `pnpm docs:api` 时
- **那么** 必须在 `apps/docs/docs/api/` 目录生成所有公开 API 的 markdown 文档

### 需求:Docusaurus 文档站集成
必须配置 Docusaurus，将 TypeDoc 输出和手写文档整合为可访问的文档站点。

#### 场景:启动文档站
- **当** 运行 `pnpm docs:dev` 时
- **那么** 必须启动 Docusaurus 开发服务器，可在浏览器中访问包含 API 参考和指南的文档站

#### 场景:构建文档站
- **当** 运行 `pnpm docs:build` 时
- **那么** 必须生成静态文档站，可部署到 Vercel/GitHub Pages 等静态托管

### 需求:文档包含核心模块的完整 API 参考
文档必须覆盖 `@ok-bot/core` 所有公开导出的类、接口、函数，精确到参数类型和描述。

#### 场景:API 参考覆盖率
- **当** 文档站构建完成时
- **那么** AgentManager、AgentLoop、ContextBuilder、SkillsLoader、MemoryStore、SessionManager、CronService、HeartbeatService、ToolRegistry 必须各有独立文档页
