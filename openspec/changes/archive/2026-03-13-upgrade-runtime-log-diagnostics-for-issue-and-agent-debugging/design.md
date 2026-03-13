## Context

插件已经具备 runtime log 基础能力，但当前实现偏“阶段级记录”，缺乏可用于远程协作排障的诊断载体。  
现状约束如下：

- 日志以 `runtimeLogManager` 为中心，但字段维度较浅，跨 provider 链路关联不足。
- log viewer 支持常规 copy/export，但缺少标准化诊断包与 issue 摘要。
- retention 文档与实现已有漂移（实现已持久化，spec 仍表述为会话内存态）。
- 现有用户目标是“可复制给 issue 与 agent 直接使用”，要求机器可消费、可关联、可脱敏。

## Goals / Non-Goals

**Goals:**

- 建立 runtime 诊断日志的插件侧 SSOT（字段、模式、预算、导出协议）。
- 在不改后端协议前提下，覆盖 SkillRunner / generic-http / pass-through 三类 provider 的诊断采集。
- 提供 `RuntimeDiagnosticBundleV1` 与 issue 摘要复制能力，满足人工与 agent 双消费。
- 保持向后兼容：旧日志可读，旧调用点不改也可工作。

**Non-Goals:**

- 不变更后端 API。
- 不新增后端存储或服务端诊断协议。
- 不重做 Dashboard 全部日志 UI，仅增加导出入口与必要提示。

## Decisions

### Decision 1: 日志模型扩展采用“可选字段 + 统一归一化”

- 选择：在 `RuntimeLogEntry/RuntimeLogInput` 上扩展可选上下文字段，不强制所有调用点一次性升级。
- 原因：降低回归风险，允许分阶段补齐埋点。
- 备选：引入全新 entry schema 并强制迁移；代价是大规模改造与测试不稳定。

### Decision 2: 诊断模式作为会话级开关

- 选择：默认关闭；开启后允许 debug 与更细粒度 transport 采集。
- 原因：平衡日常低噪声与排障高信息密度。
- 备选：默认常开；会造成普通场景噪声与性能压力。

### Decision 3: 诊断导出协议固定为 `RuntimeDiagnosticBundleV1` JSON

- 选择：统一 JSON 结构（meta/filters/timeline/incidents/entries）。
- 原因：issue 与 agent 都可直接消费，减少二次转换。
- 备选：多格式并存（zip/html）；初期复杂度高且收益有限。

### Decision 4: 脱敏采用“强规则 + 平衡可观测”

- 选择：密钥字段强制脱敏；文本字段做截断 + 摘要哈希；大 payload 仅保留 preview/statistics。
- 原因：既避免泄漏敏感信息，又保留故障关联能力。
- 备选：全量脱敏（可读性不足）或弱脱敏（泄漏风险高）。

### Decision 5: 预算策略分模式

- 选择：
  - 常规模式：维持现有策略（兼容当前行为）。
  - 诊断模式：`3000 entries + 20MB` 双阈值滚动淘汰，并记录 budget 命中原因。
- 原因：排障场景需更大窗口，但不能无界增长。
- 备选：仅条数阈值；无法控制大 payload 体积。

### Decision 6: incidents 聚合在导出阶段构建

- 选择：不在写入路径维护复杂状态机，导出时按 request/job/run 链路聚合。
- 原因：减少运行时写路径复杂度与耦合。
- 备选：实时维护 incident 索引；实现复杂且易与历史兼容冲突。

## Risks / Trade-offs

- [Risk] 埋点扩展导致日志量增加与 UI 刷新压力  
  → Mitigation: 诊断模式默认关闭，且导出/列表均支持过滤与限制。

- [Risk] 脱敏策略过严影响排障  
  → Mitigation: 保留截断片段 + 哈希 + 结构化上下文，避免“全黑盒”。

- [Risk] 多模块同步改动引入回归  
  → Mitigation: 先补测试（manager/viewer/instrumentation），再分层实现并回归。

- [Risk] spec 与实现再次漂移  
  → Mitigation: 本次同步更新 `runtime-log-pipeline`、`log-viewer-window`、`log-retention-control`、`task-runtime-ui`，并在归档前严格校验。

## Migration Plan

1. 新建并完成 change 工件（proposal/design/specs/tasks）。
2. 先扩展单测（runtime log manager / viewer / instrumentation）建立回归基线。
3. 实现日志模型、诊断模式、导出协议与 UI 操作。
4. 扩展 provider/client/queue/reconciler 埋点。
5. 跑 `npm run test:node:core`、`npm run test:node:workflow`、`npx tsc --noEmit`。
6. 执行 `openspec validate --changes --strict`，通过后再归档。

回滚策略：若诊断模式引发线上问题，可将开关默认关闭并停用导出入口，不影响常规日志链路。

## Open Questions

- `RuntimeDiagnosticBundleV1` 是否需要在下一阶段加签名字段（完整性校验）；本次先不做。
- Issue 摘要模板是否需要可配置；本次先采用固定 Markdown 模板。
