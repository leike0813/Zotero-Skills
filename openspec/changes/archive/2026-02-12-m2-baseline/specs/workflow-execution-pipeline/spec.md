## ADDED Requirements

### Requirement: 系统必须提供完整 workflow 执行流水线
系统 MUST 支持从 workflow 加载、输入筛选、请求构建、provider 执行到结果应用的端到端执行链路。

#### Scenario: 标准执行流程
- **WHEN** 用户触发一个合法 workflow
- **THEN** 系统完成加载 -> build requests -> execute provider -> apply result 的串联执行

### Requirement: 系统必须在每个输入单元维度汇总结果
系统 MUST 对 succeeded/failed/skipped 进行逐单元记录，并输出可读摘要用于 UI 呈现。

#### Scenario: 混合执行结果
- **WHEN** 同一次 workflow 执行中出现成功、失败与跳过
- **THEN** 系统输出包含计数与失败原因的稳定摘要
