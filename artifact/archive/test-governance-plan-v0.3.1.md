# 测试治理计划修订版：`test-governance-plan-v0.3.1-revised`

## Context

当前仓库测试现状：

- 测试文件总数：**89**
- 测试代码总行数：**约 33,210 行**
- 当前主要痛点：
  - 冗余场景偏多，`lite` 回归反馈偏慢
  - Zotero 真实宿主中混入了不适合该宿主执行的测试
  - 3 个巨型文件已经影响维护、定位与拆错回归的成本

当前超大测试文件：

| 文件 | 行数 | 备注 |
|------|------|------|
| `test/core/73-skillrunner-local-runtime-manager.test.ts` | 2354 | 核心 giant file |
| `test/core/70-skillrunner-task-reconciler.test.ts` | 1993 | 核心 giant file |
| `test/workflow-tag-regulator/64-workflow-tag-regulator.test.ts` | 1968 | 核心 giant file |
| `test/ui/40-gui-preferences-menu-scan.test.ts` | 1446 | 第二优先级 |
| `test/node/core/20-workflow-loader-validation.test.ts` | 1415 | 第二优先级 |
| `test/workflow-reference-matching/24-workflow-reference-matching.test.ts` | 1405 | 第二优先级 |
| `test/workflow-literature-digest/21-workflow-literature-digest.test.ts` | 835 | 暂不列为首批拆分 |

本轮治理目标不是删测试，而是先完成三件事：

1. 明确新的测试分层规则
2. 做第一批参数化合并与 `full-only` / `node-only` 调整
3. 拆分 3 个巨型文件

---

## 治理主轴

不再使用旧版 Tier 1~4 作为运行主机制，而改成更贴合当前仓库的三维治理：

### 1. 执行成本

- `lite`
- `full`

### 2. 运行宿主

- `node-only`
- `zotero-safe`
- `zotero-unsafe`

### 3. 价值等级

- `critical`
- `standard`

说明：

- 本轮**不新增新的 runner、Tier 执行器或元数据编译机制**
- 继续沿用当前：
  - `itFullOnly`
  - `npm run test:*`
  - `ZOTERO_TEST_DOMAIN`
- 上述三维规则先作为**治理文档与测试编排规则**落地

---

## 新的测试分层规则

### A. lite / full

`lite`：

- 只保留 PR 关键路径
- 只保留高信号、稳定、执行成本可控的场景
- 优先保留 `critical` 与高价值 `standard`

`full`：

- 是 `lite` 的严格超集
- 保留深度回归、环境依赖、遗留兼容、长链路场景

### B. node-only / zotero-safe / zotero-unsafe

`node-only`：

- package helper 测试
- runtime seam 测试
- mock-heavy 测试
- 依赖多 realm 注入、宿主隔离、fake DOM 细节结构的测试

`zotero-safe`：

- 可以在真实 Zotero 宿主稳定执行
- 不依赖真实 editor / picker / dialog 打开
- 不依赖只在某一 JS realm 有效的 mock 注入

`zotero-unsafe`：

- 真实宿主可能弹出 editor / file picker / dialog
- 或严重依赖复杂 UI override、多 realm 注入、长异步链路
- 这类测试不得进入 Zotero 环境常规运行

### C. 轻量注释约定

允许在测试文件或 describe 上增加轻量注释，作为后续治理依据：

- `@mode lite|full`
- `@runtime node-only|zotero-safe|zotero-unsafe`
- `@priority critical|standard`

注意：

- 这些注释当前只用于文档化与治理说明
- 不参与 runner 行为

### D. 强约束

Zotero 环境测试中禁止引入以下真实 UI 打开路径：

- editor
- file picker
- dialog

现有此类测试必须：

- 在 Zotero 环境中 `it.skip`
- 或迁移为 `node-only`

---

## 第一批参数化合并

### 1. `test/workflow-reference-matching/24-workflow-reference-matching.test.ts`

目标：

- 合并 `filterInputs` 正反例
- 合并 bbt-lite 模板错误回退族

处理方式：

- `filterInputs` 正反场景合并为一个参数化测试
- bbt-lite 模板错误回退保留为 `itFullOnly` 参数化测试

规则：

- 不把 `it` 和 `itFullOnly` 硬并到同一个测试体中

### 2. `test/workflow-literature-digest/21-workflow-literature-digest.test.ts`

目标：

- 合并幂等 / skip 族
- 拆成 lite 与 full 两组参数化测试

处理方式：

- `lite`：保留核心幂等 / skip 主路径
- `full`：保留 legacy note 兼容与边缘 skip 计数

说明：

- 本文件当前只有约 835 行，不再列为首批拆分对象

### 3. `test/ui/40-gui-preferences-menu-scan.test.ts`

目标：

- 合并 `requiresSelection` 正反场景
- 合并 disabled state / no-valid-input hint 相关场景

处理方式：

- 同宿主、同执行模式下收口为参数化测试

### 4. `test/node/core/20-workflow-loader-validation.test.ts`

目标：

- 合并 normalizeSettings 诊断族
- 合并 schema 正负验证对

处理方式：

- `normalizeSettings` 三类诊断合并为一个参数化测试
- schema 验证按字段拆成 4 个参数化测试：
  - `parameters.allowCustom`
  - `execution.feedback.showNotifications`
  - `trigger.requiresSelection`
  - `execution.skillrunner_mode`

参数化合并原则：

- 保留原断言覆盖面
- 不减少场景，只减少样板代码和重复 setup
- 参数表显式写出“输入 + 预期”
- 不能把大量条件分支塞进单个测试内部

---

## 第一批 full-only 与 runtime affinity 调整

本轮不再使用“Tier 4 可删除”的表述，而只做两类治理：

- `full-only`
- `node-only`

### 建议调整

#### `test/core/73-skillrunner-local-runtime-manager.test.ts`

下沉为 `itFullOnly`：

- 本地化 fallback 文案
- Windows 长路径 / 重试边缘失败
- persistent log whitelist helper
- manual deploy command 细节

#### `test/core/70-skillrunner-task-reconciler.test.ts`

下沉为 `itFullOnly`：

- toast 格式验证
- 日志节流验证

#### `test/workflow-tag-regulator/64-workflow-tag-regulator.test.ts`

明确归类为 `node-only` 或 `full-only`：

- dialog layout
- renderer DOM 细节
- fake HTML 结构断言

---

## 巨型文件拆分优先级

### 第一批拆分

#### 1. `test/core/73-skillrunner-local-runtime-manager.test.ts`

拆成：

- `73a-skillrunner-deploy-lifecycle.test.ts`
- `73b-skillrunner-oneclick-start-stop.test.ts`
- `73c-skillrunner-auto-start-session.test.ts`

#### 2. `test/core/70-skillrunner-task-reconciler.test.ts`

拆成：

- `70a-skillrunner-task-reconciler-state-restore.test.ts`
- `70b-skillrunner-task-reconciler-apply-bundle-retry.test.ts`
- `70c-skillrunner-task-reconciler-ledger-reconcile.test.ts`

#### 3. `test/workflow-tag-regulator/64-workflow-tag-regulator.test.ts`

拆成：

- `64a-workflow-tag-regulator-request-building.test.ts`
- `64b-workflow-tag-regulator-apply-intake.test.ts`
- `64c-workflow-tag-regulator-dialog-rendering.test.ts`

### 拆分约束

- 保留原编号前缀，新增 `a/b/c`
- 每个新文件必须自带最小依赖与独立 helper
- 不跨文件共享隐式状态
- 拆分完成后删除原文件，避免双重执行

### 第二优先级

- `test/ui/40-gui-preferences-menu-scan.test.ts`
- `test/workflow-reference-matching/24-workflow-reference-matching.test.ts`

### 当前不建议优先拆分

- `test/workflow-literature-digest/21-workflow-literature-digest.test.ts`

原因：

- 文件体量已明显下降
- 当前收益低于前三个 giant file

---

## 文档与落地方式

本轮需要同步修订：

- `artifact/test-governance-plan-v0.3.1.md`
- `doc/testing-framework.md`
- `doc/components/test-suite-governance.md`

至少补充以下规则：

- 何时使用 `itFullOnly`
- 何时必须 `node-only`
- Zotero-safe 测试的禁止项
- 参数化合并规则

---

## 批次化测试计划

每完成一个治理批次，只跑最小定向回归：

### 参数化合并后

- 跑对应文件的 Node 定向 mocha

### runtime affinity 调整后

- 跑定向 Zotero 测试
- 确认不再因 editor / picker / dialog 卡死

### 巨型文件拆分后

- 跑新旧集合等价的定向回归
- 确认覆盖不回退

### 每批次统一要求

- `npx tsc --noEmit`
- 对应 Node mocha 定向测试
- 涉及 Zotero-safe 改动时，补一轮：
  - `npm run test:zotero:raw -- --no-watch`

---

## 验收标准

- `lite` 用例数与总时长可观察下降
- Zotero workflow 域中不再出现因 editor / picker / dialog 导致的卡死
- 拆分后的 giant file 覆盖不回退
- 不新增 flaky 测试

---

## 假设与默认

- 默认不引入新的测试 runner
- 默认保留现有 `itFullOnly`
- 默认不新增 `itLiteOnly`
- 默认不做大规模删测，只在证据明确时合并
- 默认先治理 `73 / 70 / 64`，再处理 `40 / 24`
- 默认把 `zotero-safe` 作为强约束，优先级高于“是否方便测”
