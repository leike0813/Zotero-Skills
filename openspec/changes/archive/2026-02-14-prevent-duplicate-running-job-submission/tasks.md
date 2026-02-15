## 1. Duplicate Identity and Detection

- [x] 1.1 定义并实现统一的 `inputUnitIdentity` 构建规则（稳定、可测试、与 runId/jobId 解耦）
- [x] 1.2 在提交前接入运行中任务查询，按 `workflowId + inputUnitIdentity` 判定重复候选
- [x] 1.3 为重复检测补充单元测试（运行中命中、已结束不命中、不同 workflow 不命中）

## 2. Confirmation Dialog Flow

- [x] 2.1 实现重复候选 job 的确认对话框文案与上下文展示（workflow + 输入单元）
- [x] 2.2 实现串行弹窗调度：上一个决策结束后才弹下一个
- [x] 2.3 实现默认拒绝语义：关闭/取消/Esc 全部等价“否”

## 3. Submission Gating and Result Mapping

- [x] 3.1 仅放行“明确选择是”的重复候选 job 到提交流程
- [x] 3.2 将拒绝的重复候选 job 写入 skipped 结果，原因键为可本地化语义
- [x] 3.3 校验混合场景（重复+非重复）下的 succeeded/failed/skipped 汇总正确性

## 4. Localization and Regression Coverage

- [x] 4.1 增加确认对话框及 skipped 原因相关 i18n 文案（至少覆盖现有主语言）
- [x] 4.2 增加集成测试：单重复、多重复串行、全部拒绝、部分放行
- [x] 4.3 验证现有 workflow 提交流程在非重复场景无行为回归
