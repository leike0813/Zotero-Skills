## Context

项目现状是“实现先行、规范滞后”：

- 已具备工作流执行链路，但能力边界分散在代码与测试中。
- 已有 Provider/Handler/Runtime 组件，但跨组件契约未集中沉淀。
- 新变更（例如 pass-through provider）需要稳定的前置基线来引用。

因此需要先建立 M2 基线，让后续 change 在统一术语和约束下推进。

## Goals / Non-Goals

**Goals:**

- 用 OpenSpec 固化 M2 阶段的核心能力定义与边界。
- 提供后续 change 可引用的基础 capability。
- 明确“哪些是系统保证、哪些是后续演进点”。

**Non-Goals:**

- 不新增业务功能。
- 不重构现有运行时代码。
- 不在本 change 中引入新 provider 或新 workflow。

## Decisions

### Decision 1: 基线先行，能力拆分

M2 baseline 按职责拆分为 5 个 capability（selection-context / provider-adapter / workflow-execution-pipeline / result-apply-handlers / task-runtime-ui），并额外保留一个基线总则 capability。

### Decision 2: 文档化对齐而非行为改造

本 change 目标是“把已实现行为变成正式规范”，默认不做行为修复；若发现偏差，记录为后续 change 处理。

### Decision 3: 约束后续 change 的引用关系

后续变更（例如新增 provider）应在 proposal/design 中显式引用本基线，减少重复定义和语义漂移。

## Risks / Trade-offs

- 风险：当前实现可能存在隐式行为，文档化时容易遗漏。  
  应对：通过测试与代码路径反向核对，先覆盖主流程。
- 风险：基线过细导致维护成本上升。  
  应对：只定义 M2 核心稳定能力，避免过度细节化。

## Migration Plan

1. 盘点现有实现与测试中的稳定行为。
2. 形成 baseline proposal/design/tasks。
3. 按 capability 拆分规格文档。
4. 对照现有实现做一致性核查，记录后续差异项。
5. 产出 `traceability.md`，沉淀测试映射与 ready 结论。

## Open Questions

- 无阻塞问题；若后续发现基线与实现差异，作为增量 change 处理。

## Traceability

- 详见：`openspec/changes/m2-baseline/traceability.md`
