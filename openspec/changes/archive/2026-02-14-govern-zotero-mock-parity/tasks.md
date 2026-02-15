## 1. Parity Governance Baseline

- [x] 1.1 定义 Zotero mock parity contract（必须一致的 API 语义边界）
- [x] 1.2 建立 drift register（已知偏差、风险等级、豁免原因、收敛条件）
- [x] 1.3 建立 mock 变更准入清单（代码 + 测试 + 文档证据）

## 2. High-Risk Drift Test Slice

- [x] 2.1 盘点高风险 API 行为并映射到现有测试边界（runtime/loader/settings/workflow hooks）
- [x] 2.2 新增首批 drift tests（路径解析、deleted/只读约束、关键调用语义）
- [x] 2.3 将 drift tests 接入 lite/full 套件映射规则

## 3. Mock Update Workflow Hardening

- [x] 3.1 为 mock helper 增加统一能力声明与差异标注入口
- [x] 3.2 对历史高频回归点补充守护断言
- [x] 3.3 确保 mock 扩展不会破坏现有 node/zotero 测试行为

## 4. Documentation and Traceability

- [x] 4.1 更新 `doc/testing-framework.md`：加入 parity 治理流程与执行策略
- [x] 4.2 更新 `doc/architecture-hardening-baseline.md`：补充 HB-08 完成证据
- [x] 4.3 记录本变更与 `HB-08` 的追溯关系和验收结论
