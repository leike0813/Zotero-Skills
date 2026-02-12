## M2 Baseline Traceability

本文件用于完成 `m2-baseline` 的实现核查：模块边界盘点、覆盖范围定义、术语对齐、测试映射与差异清单。

## 1. M2 当前实现盘点（模块边界）

### 1.1 Selection Context

- 主要实现：`src/modules/selectionContext.ts`
- 职责：
  - 将当前选择重建为统一 `SelectionContext`
  - 输出 `parents/children/attachments/notes` 分组与 `summary`
  - 统一附带 `warnings` 与 `sampledAt`

### 1.2 Workflow Execution Pipeline

- 主要实现：
  - `src/workflows/loader.ts`
  - `src/workflows/runtime.ts`
  - `src/workflows/declarativeRequestCompiler.ts`
  - `src/modules/workflowExecute.ts`
  - `src/modules/workflowExecuteMessage.ts`
- 职责：
  - workflow manifest/hook 加载与校验
  - 输入过滤与 unit 拆分
  - 声明式请求编译
  - provider 执行与结果回写串联
  - 执行结果摘要生成

### 1.3 Provider Adapter

- 主要实现：
  - `src/providers/registry.ts`
  - `src/providers/contracts.ts`
  - `src/providers/types.ts`
  - `src/providers/skillrunner/*`
  - `src/providers/generic-http/provider.ts`
- 职责：
  - 基于 `requestKind + backend.type` 解析 provider
  - 执行 provider 并返回统一结果结构
  - 管理 provider runtime options 的 schema/normalize

### 1.4 Result Apply + Handlers

- 主要实现：
  - `src/handlers/index.ts`
  - workflow hooks（`workflows/*/hooks/applyResult.js`）
- 职责：
  - handlers 提供 item/note/attachment/tag/collection/command 操作
  - `applyResult` 承接 provider 结果并执行业务回写

### 1.5 Task Runtime UI

- 主要实现：
  - `src/modules/taskRuntime.ts`
  - `src/modules/taskManagerDialog.ts`
  - `src/modules/workflowExecute.ts`（任务更新入口）
- 职责：
  - 维护任务记录（runId + jobId 稳定键）
  - 订阅/列出/清理任务
  - UI 层展示任务状态并清理已完成记录

## 2. Baseline 覆盖范围

### 2.1 纳入（In-Scope）

- Selection Context 的结构化输出与输入单元化语义
- Workflow 加载、请求构建、provider 执行、结果应用主链路
- Provider 解析与统一结果契约
- Handlers 的回写边界与错误语义
- Task Runtime 的记录模型与 UI 最小可观测能力

### 2.2 不纳入（Out-of-Scope）

- 新业务 workflow 功能开发（例如 reference-matching）
- 新 provider 类型引入（例如 pass-through）
- 缓存层与高级任务控制（取消/重试/详情日志）
- 跨后端策略优化与性能优化专题

## 3. 术语对齐

- `workflow`：由 `workflow.json + hooks` 组成的可执行包
- `provider`：消费 request payload 并返回统一执行结果的协议适配器
- `handler`：对 Zotero 对象执行落库操作的底层能力层
- `task`：workflow 每个输入单元的一次执行记录
- `runtime`：连接 workflow/provider/handler/queue 的执行期上下文

## 4. 规格与测试映射

### 4.1 selection-context

- 对应测试：
  - `test/zotero/10-selection-context-schema.test.ts`
  - `test/zotero/11-selection-context-rebuild.test.ts`

### 4.2 provider-adapter

- 对应测试：
  - `test/zotero/33-provider-backend-registry.test.ts`
  - `test/zotero/34-generic-http-provider-e2e.test.ts`
  - `test/zotero/36-skillrunner-model-catalog.test.ts`

### 4.3 workflow-execution-pipeline

- 对应测试：
  - `test/zotero/20-workflow-loader-validation.test.ts`
  - `test/zotero/21-workflow-literature-digest.test.ts`
  - `test/zotero/22-literature-digest-filter-inputs.test.ts`
  - `test/zotero/23-workflow-literature-digest-fixtures.test.ts`
  - `test/zotero/24-workflow-execute-message.test.ts`
  - `test/zotero/35-workflow-settings-execution.test.ts`
  - `test/zotero/41-workflow-scan-registration.test.ts`
  - `test/zotero/50-workflow-literature-digest-mock-e2e.test.ts`

### 4.4 result-apply-handlers

- 对应测试：
  - `test/zotero/12-handlers.test.ts`
  - `test/zotero/21-workflow-literature-digest.test.ts`（applyResult 路径）
  - `test/zotero/34-generic-http-provider-e2e.test.ts`

### 4.5 task-runtime-ui

- 对应测试：
  - `test/zotero/42-task-runtime.test.ts`
  - `test/zotero/40-gui-preferences-menu-scan.test.ts`（任务管理入口）

## 5. 差异清单（已支持 / 未覆盖）

### 5.1 已支持

- 核心执行链路（load -> build -> execute -> apply -> summary）
- selection context 基础结构与 schema 稳定性
- provider 注册解析与 runtime options 规范化
- handlers 常见回写能力
- task runtime 记录与清理

### 5.2 未覆盖或待后续 change

- 本地执行型 provider（`pass-through`）不在本 baseline 实现范围
- 任务运行态不支持取消、重试、日志详情查看
- Selection `note` 输入单元的场景覆盖相对附件/父条目更少
- 本地缓存（`local-cache`）仍为占位设计

## 6. Baseline Ready 结论

- `m2-baseline` 的 capability 与可追溯映射已完成。
- 后续 change 可以 `m2-baseline` 作为依赖前置并在 proposal/design 中引用。
