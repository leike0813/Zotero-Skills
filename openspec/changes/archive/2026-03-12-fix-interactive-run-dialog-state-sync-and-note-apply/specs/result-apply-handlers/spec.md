## MODIFIED Requirements

### Requirement: 系统必须通过 applyResult + handlers 执行结果回写
系统 MUST 将 SkillRunner 成功结果通过标准化 `applyResult + handlers` 路径回写到 Zotero 数据层。

#### Scenario: literature-explainer note_path 以 bundle entry 语义消费
- **WHEN** `literature-explainer` 返回 `note_path`
- **THEN** applyResult MUST 从 bundle entry 读取 markdown
- **AND** 允许将绝对路径映射到 `artifacts|result|bundle` 后缀后再读取

#### Scenario: note_path 无效时安全跳过
- **WHEN** `note_path` 为空或无法在 bundle 中读取
- **THEN** applyResult MUST 返回 `skipped=true` 与可解释 reason
- **AND** 系统 MUST NOT 创建空 note

### Requirement: 结果回写必须具备幂等与安全语义
结果回写链路 MUST 在重试与异常场景下保持幂等、安全且可诊断。

#### Scenario: deferred terminal apply transient failure retries with backoff
- **WHEN** backend terminal state is `succeeded` but applyResult fails transiently
- **THEN** reconciler MUST retry apply with exponential backoff (max 5 attempts)
- **AND** retries MUST stop with `deferred-apply-exhausted` log after limit
