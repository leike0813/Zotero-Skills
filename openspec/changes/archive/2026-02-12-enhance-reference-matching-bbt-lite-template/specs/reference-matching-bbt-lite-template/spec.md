## ADDED Requirements

### Requirement: reference-matching MUST accept BBT-Lite citekey expressions
`reference-matching` workflow MUST 支持 `citekey_template` 的 BBT-Lite 表达式语法，用于生成预测 CiteKey。BBT-Lite 语法 MUST 至少支持：

- 对象标识符：`auth`、`year`、`title`
- 对象链式方法调用：`<object>.<method>(...)`
- 字符串字面量（单引号）
- `+` 拼接表达式

#### Scenario: Valid BBT-Lite expression is accepted and evaluated
- **WHEN** `citekey_template` 设置为 `auth.lower + '_' + title.nopunct.skipwords.select(1,1).lower + '-' + title.nopunct.skipwords.select(2,1).lower + '_' + year`
- **THEN** workflow MUST 将该模板识别为合法 BBT-Lite 表达式
- **AND** MUST 在预测 CiteKey 阶段执行该表达式

### Requirement: Auth/Year/Title method compatibility MUST be provided in BBT-Lite mode
在 BBT-Lite 模式下，系统 MUST 为 `auth`、`year`、`title` 三个对象提供方法兼容层；对这三类对象的方法语义 MUST 与本插件定义的 BBT-Lite 兼容配置保持一致，并可稳定复现。

#### Scenario: Auth/Year/Title method chain yields deterministic predicted citekey
- **WHEN** reference 元数据为 `author=Alice Zhao`、`title=Signal Flow Modeling`、`year=2031`，模板为 `auth.lower + '_' + title.nopunct.skipwords.select(1,1).lower + '-' + title.nopunct.skipwords.select(2,1).lower + '_' + year`
- **THEN** 系统 MUST 生成稳定且可复现的预测 CiteKey
- **AND** 相同输入在重复执行时 MUST 产生相同输出

### Requirement: Legacy placeholder template MUST remain backward compatible
系统 MUST 保持旧模板语法（如 `{author}_{title}_{year}`）可用，不得因 BBT-Lite 引入而破坏现有行为。

#### Scenario: Legacy template continues to work after BBT-Lite support is added
- **WHEN** `citekey_template` 使用 `{author}_{title}_{year}`
- **THEN** 系统 MUST 按既有占位符规则生成预测 CiteKey
- **AND** MUST NOT 强制用户迁移到 BBT-Lite 语法

### Requirement: BBT-Lite parsing/execution failures MUST fail-safe to existing fallback flow
当模板解析失败、对象不支持、方法不支持、参数非法或字段缺失导致无法形成有效预测 CiteKey 时，workflow MUST 失败安全并回退到既有评分匹配路径，不得中断整条任务。

#### Scenario: Invalid method call does not break workflow and falls back to score matching
- **WHEN** 模板包含无法执行的方法调用或非法参数
- **THEN** 系统 MUST 将该条预测 CiteKey 视为未命中
- **AND** MUST 继续执行评分匹配兜底流程
- **AND** MUST NOT 因该错误中断整个 workflow run

### Requirement: Workflow settings MUST validate BBT-Lite templates with safe fallback
Workflow Settings 在保存 `citekey_template` 时 MUST 接受合法 BBT-Lite 表达式与合法 legacy 模板；对非法值 MUST 拒绝并回退到最近有效值或默认值。

#### Scenario: Invalid persisted value is normalized to last valid or default
- **WHEN** 读取到非法 `citekey_template`（空值、不可解析表达式或不受支持对象）
- **THEN** 系统 MUST 自动回退到最近一次有效模板或默认模板
- **AND** reference-matching workflow MUST 可继续执行
