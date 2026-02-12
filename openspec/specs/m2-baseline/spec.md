# m2-baseline Specification

## Purpose
TBD - created by archiving change m2-baseline. Update Purpose after archive.
## Requirements
### Requirement: 系统必须定义 M2 baseline 能力边界
系统 MUST 通过正式规格定义 M2 阶段的核心能力、术语与边界，作为后续 change 的统一引用基线。

#### Scenario: baseline 作为依赖
- **WHEN** 新 change 需要扩展工作流或 provider
- **THEN** 该 change 可以引用 baseline capability 而非重复定义基础语义

### Requirement: baseline 变更必须以“文档化对齐”为目标
系统 MUST 将本 change 视为规范沉淀，不将其作为新增业务功能入口。

#### Scenario: 发现实现缺口
- **WHEN** 基线规格与现有实现存在差异
- **THEN** 记录差异并由后续增量 change 处理
- **AND** 不在 baseline change 中混入无关功能开发

