## ADDED Requirements

### Requirement: Workflow MUST accept both references-note selection and parent-item selection
`reference-matching` workflow MUST 将合法输入扩展为两类入口：直接选中 references note，或选中父条目后在其子 note 中发现 references note。

#### Scenario: Direct references note is selected
- **WHEN** 选中项中存在 `data-zs-note-kind="references"` 或 `data-zs-payload="references-json"` 的 note
- **THEN** workflow MUST 保留该 note 作为合法执行单元输入

#### Scenario: Parent item with references note is selected
- **WHEN** 选中父条目且其子 note 中至少存在一个合法 references note
- **THEN** workflow MUST 将该 references note 纳入合法执行单元输入

#### Scenario: Parent item without references note is selected
- **WHEN** 选中父条目但其子 note 中不存在合法 references note
- **THEN** workflow MUST 过滤该输入单元
- **AND** MUST NOT 触发匹配回写

### Requirement: Workflow MUST emit one request record per resolved input unit
对于由 `filterInputs` 解析出的多个合法输入单元，系统 MUST 逐单元构建请求记录，不得将多个父条目或多个 references note 打包为单条请求。

#### Scenario: Two parent items each resolve to one references note
- **WHEN** 一次选中两个父条目，且每个父条目都解析出一个合法 references note
- **THEN** 系统 MUST 生成两条独立请求记录
- **AND** 每条记录 MUST 仅包含一个 references note 选择上下文

#### Scenario: Mixed valid and invalid parent selections
- **WHEN** 一次选中多个父条目，其中仅部分父条目可解析出合法 references note
- **THEN** 系统 MUST 仅为合法单元生成请求记录
- **AND** MUST 将其余单元计为 skipped
