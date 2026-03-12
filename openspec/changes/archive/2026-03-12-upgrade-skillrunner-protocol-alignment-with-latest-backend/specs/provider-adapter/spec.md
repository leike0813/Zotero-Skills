## MODIFIED Requirements

### Requirement: Provider 执行结果必须统一为标准模型
系统 MUST 将不同 Provider 的执行输出归一为统一结果结构，供 runtime 与 `applyResult` 消费。

#### Scenario: skillrunner file-input mapping follows input-relative-path protocol
- **WHEN** request kind is `skillrunner.job.v1` and payload contains non-empty `upload_files`
- **THEN** provider contract SHALL require `input` to be object
- **AND** each `upload_files[].key` SHALL resolve to `input.<key>` relative path under uploads root
- **AND** upload zip entries SHALL use that resolved relative path instead of legacy key name

#### Scenario: inline-only skillrunner payload skips upload step
- **WHEN** request kind is `skillrunner.job.v1` and `upload_files` is missing or empty
- **THEN** execution chain SHALL skip `/upload`
- **AND** provider SHALL continue with `create -> poll -> result|bundle`
