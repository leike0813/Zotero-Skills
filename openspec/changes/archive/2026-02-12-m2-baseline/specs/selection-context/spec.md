## ADDED Requirements

### Requirement: 系统必须构建结构化 Selection Context
系统 MUST 将当前用户选择重建为统一的结构化上下文，作为 workflow 输入与请求编译的单一来源。

#### Scenario: 混合选择输入
- **WHEN** 用户选择包含 parent/item/attachment/note 的混合集合
- **THEN** 系统输出结构化 `selectionContext`
- **AND** 提供可用于后续 unit 拆分的稳定字段

### Requirement: 系统必须支持按 workflow 输入策略裁剪上下文
系统 MUST 支持按 workflow 的 `inputs.unit` 语义（如 parent/attachment/note）进行输入单元化处理。

#### Scenario: unit 裁剪
- **WHEN** workflow 声明了特定输入 unit
- **THEN** 系统按 unit 生成可执行的输入上下文
- **AND** 无合法单元时返回可解释的跳过结果
