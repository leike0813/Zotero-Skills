# result-apply-handlers Specification

## Purpose
TBD - created by archiving change m2-baseline. Update Purpose after archive.
## Requirements
### Requirement: 系统必须通过 applyResult + handlers 执行结果回写
系统 MUST 将业务写入动作集中在 workflow `applyResult` 与 handlers 层，保持 Provider 与业务落库解耦。

#### Scenario: 回写成功
- **WHEN** Provider 返回可消费结果
- **THEN** `applyResult` 调用 handlers 完成 note/field/tag/collection 等写入

### Requirement: 结果回写必须具备幂等与安全语义
系统 MUST 避免重复创建或误写入，并在异常时返回可解释错误。

#### Scenario: 目标已存在
- **WHEN** 目标数据已存在且可更新
- **THEN** 系统采用 upsert 或等价策略保持幂等

#### Scenario: 非法写入目标
- **WHEN** 写入目标无效或不存在
- **THEN** 系统拒绝写入并保留原状态

