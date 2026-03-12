## 1. OpenSpec

- [x] 1.1 新建 `integrate-tag-regulator-suggest-intake-with-staged-inbox` change 工件
- [x] 1.2 新增/更新 delta specs：`tag-regulator-workflow`、`workflow-editor-host`、`tag-vocabulary-management-workflow`

## 2. Editor Host Contract

- [x] 2.1 扩展 `WorkflowEditorOpenArgs`：支持 `actions` 与 `closeActionId`
- [x] 2.2 扩展 `WorkflowEditorOpenResult`：返回 `actionId`
- [x] 2.3 保持默认 Save/Cancel 旧流程兼容

## 3. Tag Regulator Suggest Intake

- [x] 3.1 将 suggest dialog 改造为条目级即时动作（加入/拒绝）
- [x] 3.2 实现三全局动作（全部加入/全部暂存/全部拒绝）
- [x] 3.3 实现 10 秒倒计时并超时默认暂存
- [x] 3.4 实现 close=>stage-all 默认关闭策略
- [x] 3.5 接入 staged 持久化并写入 `sourceFlow=tag-regulator-suggest`

## 4. Tests & Verification

- [x] 4.1 更新 `workflow-tag-regulator` suggest-intake 单测
- [x] 4.2 更新 `workflow-editor-host` 合同扩展单测
- [x] 4.3 运行 `npm run test:node:workflow`
- [x] 4.4 运行 `npm run test:node:ui`
- [x] 4.5 运行 `npm run test:node:core`
- [x] 4.6 运行 `npx tsc --noEmit`
