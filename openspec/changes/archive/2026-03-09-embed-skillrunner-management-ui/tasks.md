## 1. OpenSpec Artifacts

- [x] 1.1 新建 change 工件：`proposal.md`、`design.md`、`tasks.md`、`.openspec.yaml`
- [x] 1.2 新增 delta specs，定义 backend manager 管理页入口与管理页宿主能力

## 2. Backend Manager Entry

- [x] 2.1 SkillRunner profile 行动作列新增“进入管理页面”按钮
- [x] 2.2 入口点击读取当前行实时 `baseUrl`（含未保存编辑态）并校验 URL
- [x] 2.3 非法 URL 阻断打开并提示错误，不影响保存流程

## 3. Embedded Management Host

- [x] 3.1 新增 SkillRunner 管理页宿主模块（Zotero 对话框 + 内嵌浏览）
- [x] 3.2 目标地址固定为 `${baseUrl}/ui`，窗口标题包含 backend id/baseUrl
- [x] 3.3 保持单实例窗口复用（重复打开时聚焦并更新 URL）

## 4. Verification and Docs

- [x] 4.1 新增/更新 backend manager 回归测试（动作显示、URL 解析、行编辑态发射）
- [x] 4.2 回归现有 backend manager 风险用例（重复 id、bearer 必填、持久化异常）
- [x] 4.3 更新文档：`doc/components/providers.md`、`doc/dev_guide.md`
- [x] 4.4 运行验证：`npm run test:node:core`、`npm run test:node:ui`、`npx tsc --noEmit`
