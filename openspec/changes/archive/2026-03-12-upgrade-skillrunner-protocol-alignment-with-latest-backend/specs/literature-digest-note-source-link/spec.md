## ADDED Requirements

### Requirement: Digest workflow 必须稳定回写 source 附件元数据
系统 MUST 在 digest note 中写入源附件元数据，并保证 result artifact 消费路径与后端协议一致。

#### Scenario: applyResult resolves artifact entries from output paths without hardcoded artifacts prefix
- **WHEN** bundle result returns artifact paths in `result.data.digest_path/references_path/citation_analysis_path`
- **THEN** workflow SHALL parse these paths into bundle-readable relative entries
- **AND** workflow SHALL NOT hardcode `artifacts/<basename>` as the only lookup strategy
- **AND** digest/references/citation-analysis notes SHALL continue to upsert idempotently
