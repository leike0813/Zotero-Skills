## 1. OpenSpec Artifacts

- [x] 1.1 补齐 `proposal/design/tasks/specs` 工件，明确输入路由、可选 note 产出与非幂等语义

## 2. Workflow Implementation

- [x] 2.1 新增 `workflows/literature-explainer/workflow.json`（skillrunner + interactive + source_path 上传）
- [x] 2.2 新增 `filterInputs`，实现与 literature-digest 对齐的 1-5 规则（不做已有产物跳过）
- [x] 2.3 新增 `applyResult`，仅在 `note_path` 可读时创建 `Conversation Note yymmddhhmm` 笔记并写入 payload/HTML
- [x] 2.4 保持 note 创建为新增模式，不实现更新/去重

## 3. Tests & Verification

- [x] 3.1 新增 workflow manifest 与请求构建测试
- [x] 3.2 新增 filterInputs 路由策略测试，覆盖规则 1-5
- [x] 3.3 新增 applyResult 测试，覆盖 note_path 存在/为空/不存在分支
- [x] 3.4 运行 `npm run test:node:workflow`
- [x] 3.5 运行 `npm run test:node:core`
- [x] 3.6 运行 `npx tsc --noEmit`
