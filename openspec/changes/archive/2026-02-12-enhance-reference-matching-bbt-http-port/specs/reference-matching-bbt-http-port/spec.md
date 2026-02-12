## ADDED Requirements

### Requirement: Workflow MUST support bbt-json data source via local Better BibTeX HTTP JSON-RPC
当 `reference-matching` workflow 的 `data_source=bbt-json` 时，系统 MUST 通过本地 Better BibTeX HTTP JSON-RPC 获取候选文献信息，并参与现有匹配流程。

#### Scenario: bbt-json path is selected
- **WHEN** workflow 参数 `data_source` 设置为 `bbt-json`
- **THEN** 系统 MUST 调用本地 BBT JSON-RPC 端点获取候选条目
- **AND** MUST 使用返回候选与 references payload 执行匹配并回写 citekey

#### Scenario: BBT endpoint is unreachable
- **WHEN** BBT JSON-RPC 端点连接失败、超时或返回错误响应
- **THEN** 系统 MUST 返回明确错误信息
- **AND** MUST NOT 对当前输入单元执行部分回写

### Requirement: BBT port MUST be configurable in Workflow Settings with port-only granularity
系统 MUST 在 Workflow Settings 中提供 `reference-matching` 的 BBT 端口配置项。配置粒度 MUST 仅为端口号，不提供完整 URL 编辑。

#### Scenario: Default port is used when no override exists
- **WHEN** 用户未在 Workflow Settings 中设置 BBT 端口
- **THEN** 系统 MUST 使用默认端口 `23119`
- **AND** MUST 组合固定地址模板 `http://127.0.0.1:{port}/better-bibtex/json-rpc`

#### Scenario: Custom port override is provided
- **WHEN** 用户在 Workflow Settings 中将 BBT 端口设置为有效端口号
- **THEN** 系统 MUST 在 JSON-RPC 请求中使用该端口
- **AND** MUST 继续使用固定 host 与 path

#### Scenario: Invalid port value is provided
- **WHEN** 用户输入非端口范围的值（非数字或不在 `1..65535`）
- **THEN** 系统 MUST 拒绝保存无效值
- **AND** MUST 保留最近一次有效配置或默认值
