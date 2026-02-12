# 测试框架设计与落地方案

## 目标

提供可复现的双环境测试：

- Zotero 真实环境回归（交付基线）
- Node + mock 快速回归（开发加速）

## 入口

- Zotero lite：`npm run test` / `npm run test:zotero`
- Zotero full：`npm run test:full` / `npm run test:zotero:full`
- Node lite：`npm run test:node`
- Node full：`npm run test:node:full`

测试模式由 `ZOTERO_TEST_MODE=lite|full` 控制（默认 `lite`）。

## lite/full 规则（当前实现）

### lite（默认）

- 跳过整套件：
  - `10-selection-context-schema.test.ts`
  - `12-handlers.test.ts`
  - `23-workflow-literature-digest-fixtures.test.ts`
  - `32-job-queue-transport-integration.test.ts`
  - `34-generic-http-provider-e2e.test.ts`
  - `50-workflow-literature-digest-mock-e2e.test.ts`
- `11-selection-context-rebuild.test.ts` 仅执行 `selection-context-mix-all.json`
- `30-transport-skillrunner-mock.test.ts` 保留首个主链路 case，第二个 case（result fetch）为 full-only
- 其他 full-only case 由各测试套件内部 `isFullTestMode()` 控制

### full

- 执行全部测试套件与全部 case

## 当前测试套件清单（`test/zotero/*.test.ts`）

1. `00-startup.test.ts`
2. `01-startup-workflow-menu-init.test.ts`
3. `10-selection-context-schema.test.ts`
4. `11-selection-context-rebuild.test.ts`
5. `12-handlers.test.ts`
6. `20-workflow-loader-validation.test.ts`
7. `21-workflow-literature-digest.test.ts`
8. `22-literature-digest-filter-inputs.test.ts`
9. `23-workflow-literature-digest-fixtures.test.ts`
10. `24-workflow-execute-message.test.ts`
11. `24-workflow-reference-matching.test.ts`
12. `25-reference-matching-citekey-fixture.test.ts`
13. `30-transport-skillrunner-mock.test.ts`
14. `31-transport-upload-fallback.test.ts`
15. `32-job-queue-transport-integration.test.ts`
16. `33-provider-backend-registry.test.ts`
17. `34-generic-http-provider-e2e.test.ts`
18. `35-workflow-settings-execution.test.ts`
19. `36-skillrunner-model-catalog.test.ts`
20. `37-pass-through-provider.test.ts`
21. `38-generic-http-steps-provider.test.ts`
22. `39-workflow-mineru.test.ts`
23. `40-gui-preferences-menu-scan.test.ts`
24. `41-workflow-scan-registration.test.ts`
25. `42-hooks-startup-template-cleanup.test.ts`
26. `42-task-runtime.test.ts`
27. `43-workflow-reference-note-editor.test.ts`
28. `44-reference-table-rendering-parity.test.ts`
29. `44-workflow-editor-host.test.ts`
30. `45-runtime-log-manager.test.ts`
31. `46-log-viewer-behavior.test.ts`
32. `47-workflow-log-instrumentation.test.ts`
33. `50-workflow-literature-digest-mock-e2e.test.ts`

## Mock 策略

### Zotero mock（Node）

- 文件：`test/setup/zotero-mock.ts`
- 通过 `--require` 自动注入全局 `Zotero`
- 目标是行为近似，不替代 Zotero 实机验证

### SkillRunner mock

- 文件：`test/mock-skillrunner/server.ts`
- 覆盖 create/upload/poll/bundle/result 的最小链路
- 用于 provider/jobQueue/integration 回归

## 约束

- 交付前必须跑 Zotero 环境测试
- Node 测试仅用于开发提速与快速定位

## reference-matching BBT-Lite 覆盖

- `test/zotero/24-workflow-reference-matching.test.ts`：
  - 合法 BBT-Lite 表达式命中预测 CiteKey；
  - `year` 从 `date` 回退提取；
  - 解析失败/对象不支持时回退评分匹配；
  - payload JSON 与 HTML 表格 citekey 列同步回归。
- `test/zotero/35-workflow-settings-execution.test.ts`：
  - BBT-Lite 模板持久化与执行上下文生效；
  - 非法模板回退到最近有效模板或默认模板。
