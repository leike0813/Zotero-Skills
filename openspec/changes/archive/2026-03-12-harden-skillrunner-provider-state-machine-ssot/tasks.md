## 1. OpenSpec Artifacts

- [x] 1.1 创建 `harden-skillrunner-provider-state-machine-ssot` change 工件
- [x] 1.2 补齐 proposal/design/tasks/spec delta

## 2. State Machine SSOT

- [x] 2.1 新增统一状态机模块（状态归一化、终态/等待态、迁移矩阵、事件序校验）
- [x] 2.2 引入未知状态容错策略（降级到 running）与结构化 violation 数据模型
- [x] 2.3 新增运行时告警日志契约（`scope=state-machine` + `action=degraded`）

## 3. Chain Integration

- [x] 3.1 provider/client 改用统一状态机判定
- [x] 3.2 job queue 改用统一状态机判定与迁移守护
- [x] 3.3 reconciler/apply 改用统一状态机判定与事件序守护
- [x] 3.4 dashboard/run-dialog host 快照补充状态语义字段并驱动前端渲染

## 4. Tests

- [x] 4.1 新增状态机合同测试（集合、归一化、未知状态、迁移矩阵、事件序）
- [x] 4.2 扩展 queue/reconciler/apply 一致性回归测试
- [x] 4.3 扩展 run-dialog / dashboard 对 host 状态语义消费测试

## 5. Validation

- [x] 5.1 `npm run test:node:core`
- [x] 5.2 `npm run test:node:workflow`
- [x] 5.3 `npx tsc --noEmit`
