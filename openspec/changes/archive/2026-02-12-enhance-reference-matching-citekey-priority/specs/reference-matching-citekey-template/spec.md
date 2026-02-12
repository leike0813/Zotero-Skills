## ADDED Requirements

### Requirement: Workflow MUST expose configurable CiteKey template in Workflow Settings
`reference-matching` workflow MUST 提供 `citekey_template` 参数，并在 Workflow Settings 中允许用户配置。系统 MUST 为该参数提供默认值，默认语义 MUST 与 Better BibTeX 默认 CiteKey 生成风格一致。

#### Scenario: User does not override template
- **WHEN** 用户未在 Workflow Settings 设置 `citekey_template`
- **THEN** 系统 MUST 使用内置默认模板
- **AND** 默认模板语义 MUST 可生成“作者主键 + 年份 + 标题片段”风格的预测 CiteKey

#### Scenario: User overrides template with valid value
- **WHEN** 用户在 Workflow Settings 提供合法模板并保存成功
- **THEN** 系统 MUST 在后续运行中使用该模板生成预测 CiteKey
- **AND** MUST 覆盖默认模板行为

### Requirement: Template engine MUST generate deterministic predicted CiteKey from reference fields
模板引擎 MUST 基于参考文献结构化字段生成可复现的预测 CiteKey。至少 MUST 支持 `{author}`、`{year}`、`{title}` 占位符，并对结果执行统一归一化。

#### Scenario: Template contains supported placeholders
- **WHEN** 模板使用 `{author}`、`{year}`、`{title}` 的任意组合
- **THEN** 系统 MUST 从 reference 对应字段取值并替换占位符
- **AND** MUST 对输出做统一规范化（大小写、空白、常见标点）

#### Scenario: Reference field is missing
- **WHEN** 模板中某占位符对应字段在 reference 中缺失或为空
- **THEN** 系统 MUST 将该占位符替换为空串或安全降级值
- **AND** MUST 继续生成预测 CiteKey（不得抛错中断整条 workflow）

### Requirement: Invalid template input MUST fail-safe to last valid or default template
当用户配置的模板非法（空模板、仅空白、含不支持表达式导致不可解析）时，系统 MUST 采取失败安全策略，避免 workflow 运行时崩溃。

#### Scenario: Template is invalid at save-time
- **WHEN** Workflow Settings 接收到非法 `citekey_template`
- **THEN** 系统 MUST 拒绝该非法值
- **AND** MUST 保留最近一次有效模板或默认模板

#### Scenario: Legacy invalid value exists in persisted settings
- **WHEN** 历史配置中读取到非法 `citekey_template`
- **THEN** 系统 MUST 在运行时回退到最近有效模板或默认模板
- **AND** MUST 保证 reference-matching workflow 可继续执行
