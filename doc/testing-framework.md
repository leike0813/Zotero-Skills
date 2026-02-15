# 测试框架设计与落地方案

## 目标

提供可复现的双环境测试：

- Zotero 真实环境回归（交付基线）
- Node + mock 快速回归（开发加速）

并以双套件门禁执行：

- PR Gate：`lite`（阻塞）
- Release Gate：`full`（阻塞）

## 入口命令

### 套件命令

- `npm run test` -> `npm run test:lite`
- `npm run test:lite`
- `npm run test:full`
- `npm run test:gate:pr`
- `npm run test:gate:release`

### Node 命令

- `npm run test:node` / `npm run test:node:lite`
- `npm run test:node:full`
- `npm run test:node:core` / `npm run test:node:core:full`
- `npm run test:node:ui` / `npm run test:node:ui:full`
- `npm run test:node:workflow` / `npm run test:node:workflow:full`

### Zotero 命令

- `npm run test:zotero` / `npm run test:zotero:lite`
- `npm run test:zotero:full`
- `npm run test:zotero:core` / `npm run test:zotero:core:full`
- `npm run test:zotero:ui` / `npm run test:zotero:ui:full`
- `npm run test:zotero:workflow` / `npm run test:zotero:workflow:full`

## 测试域分类（Domain Taxonomy）

当前测试套件按一级域组织：

- `test/core/*.test.ts`
- `test/ui/*.test.ts`
- `test/workflow-*/**/*.test.ts`

详细迁移映射见 `doc/components/test-taxonomy-domain-map.md`。

## lite/full 规则

### 设计准则（客观标准）

`lite` 收录：

- 覆盖主执行链路的高信号 smoke/integration 用例
- 对 PR 阻断价值高、执行时长可控、稳定性高的用例

`full` 收录：

- `lite` 全集
- 深度回归、环境依赖、长耗时或低频风险用例

约束：

- `full` 必须是 `lite` 的严格超集
- 任何从 `lite` 移出的用例都要有可审计理由

### 当前实现

lite 模式下：

- 下列套件为 full-only：
  - `test/core/10-selection-context-schema.test.ts`
  - `test/core/12-handlers.test.ts`
  - `test/core/32-job-queue-transport-integration.test.ts`
  - `test/core/34-generic-http-provider-e2e.test.ts`
  - `test/workflow-literature-digest/23-workflow-literature-digest-fixtures.test.ts`
  - `test/workflow-literature-digest/50-workflow-literature-digest-mock-e2e.test.ts`
- `test/core/11-selection-context-rebuild.test.ts` 仅运行 `selection-context-mix-all-top3-parents` 子夹具
- 在 workflow/ui 的高复杂度测试文件内，部分边界/兼容性用例通过 `itFullOnly` 下沉到 `full`
  - 代表性文件：`test/workflow-reference-matching/24-workflow-reference-matching.test.ts`、`test/workflow-literature-digest/21-workflow-literature-digest.test.ts`、`test/workflow-mineru/39-workflow-mineru.test.ts`、`test/ui/40-gui-preferences-menu-scan.test.ts`
- `selection-context` 的 lite 子夹具执行后保留重建产物（不清理）

full 模式下：

- 运行全部套件与全部 case（包含 `selection-context` 全矩阵）

## selection-context lite 子夹具

路径：

- `test/fixtures/selection-context/selection-context-mix-all-top3-parents.ts`

规则：

- 来源于 `selection-context-mix-all` 的前 3 个 parent
- 明确排除 standalone notes
- 仅用于 lite 模式下的 `selection-context rebuild`

## 门禁语义（Blocking vs Warning）

- `test:gate:pr`：阻塞（失败即 PR Gate 失败）
- `test:gate:release`：阻塞（失败即 Release Gate 失败）
- 非门禁型信息任务（如诊断采样）可配置为 warning，不覆盖上述阻塞结论

## 域分组执行机制

通过环境变量 `ZOTERO_TEST_DOMAIN` 执行一级域分组：

- `all`（默认）
- `core`
- `ui`
- `workflow`

本次仅提供一级域分组，不提供 per-workflow 命令面。

## 相关文档

- `doc/components/test-taxonomy-domain-map.md`
- `doc/components/test-suite-governance.md`
- `doc/components/zotero-mock-parity.md`
