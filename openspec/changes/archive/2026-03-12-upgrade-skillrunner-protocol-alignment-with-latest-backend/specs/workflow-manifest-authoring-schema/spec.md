## MODIFIED Requirements

### Requirement: Schema contract SHALL align with current loader-visible constraints
系统 MUST 使用单一 schema 校验 workflow manifest，确保作者声明与运行时消费一致。

#### Scenario: declarative skillrunner upload selector compiles to input file path mapping
- **WHEN** workflow uses declarative `request.kind=skillrunner.job.v1` and declares `request.input.upload.files[]`
- **THEN** compiler SHALL generate `input.<key>` relative file path for each declared upload entry
- **AND** generated request SHALL keep `upload_files[].key=<key>` as mapping key
- **AND** resulting payload SHALL satisfy provider file-input contract without hook-side manual duplication
