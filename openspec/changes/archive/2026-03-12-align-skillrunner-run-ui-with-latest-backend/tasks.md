## 1. OpenSpec & Contracts

- [x] 1.1 新建 `align-skillrunner-run-ui-with-latest-backend` change 工件（proposal/design/tasks/.openspec.yaml）
- [x] 1.2 更新 `task-runtime-ui` delta：SkillRunner Run 表格新增本地 `engine` 列
- [x] 1.3 更新 `task-dashboard-skillrunner-observe` delta：Run Dialog 支持 thinking 与 waiting 卡片交互

## 2. Local Task Model (Engine)

- [x] 2.1 在 run seam 入队 meta 写入 `engine`
- [x] 2.2 扩展 `WorkflowTaskRecord` 与 history record 支持 `engine`
- [x] 2.3 Dashboard SkillRunner backend 表格新增 `engine` 列（无 `model` 列）

## 3. Run Dialog Status Alignment

- [x] 3.1 Run session/snapshot 增加 `engine`、`model`
- [x] 3.2 状态区显示 `engine/model`，移除 `loading` 行展示

## 4. Run Dialog Conversation & Cards

- [x] 4.1 对话区对齐 E2E：普通气泡 + thinking 聚合气泡（可折叠）
- [x] 4.2 新增 `running` thinking 提示卡
- [x] 4.3 新增 `waiting_user` 交互卡（基于 `pending + ui_hints`）
- [x] 4.4 新增 `waiting_auth` 交互卡（phase + `ui_hints`），并支持 `import_files`

## 5. Client & Bridge

- [x] 5.1 扩展 run-dialog bridge 动作：结构化 reply / auth import
- [x] 5.2 扩展 management client：新增 auth import 提交与错误透传

## 6. Tests & Verification

- [x] 6.1 更新/新增 core 测试：任务模型 engine 写入、history 回放、snapshot 列渲染
- [x] 6.2 更新/新增 core 测试：Run Dialog thinking/pending/auth 映射与 auth import 调用
- [x] 6.3 运行 `npm run test:node:core`（本地 `127.0.0.1:8030` 被占用，改用 `npm run test:node:raw:core` 验证）
- [x] 6.4 运行 `npm run test:node:ui`（使用 `npm run test:node:raw:ui`）
- [x] 6.5 运行 `npm run test:node:workflow`（使用 `npm run test:node:raw:workflow`）
- [x] 6.6 运行 `npx tsc --noEmit`
