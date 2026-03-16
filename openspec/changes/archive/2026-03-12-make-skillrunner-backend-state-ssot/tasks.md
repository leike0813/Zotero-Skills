## 1. OpenSpec

- [x] 1.1 新建 `make-skillrunner-backend-state-ssot` change 工件
- [x] 1.2 增加 `provider-adapter` 与 `task-dashboard-skillrunner-observe` delta specs

## 2. Runtime / Provider

- [x] 2.1 扩展 `ProviderExecutionResult`：支持 `deferred`
- [x] 2.2 SkillRunner interactive 改为 submit-only + deferred 返回
- [x] 2.3 `JobQueue` 支持 `waiting_user`/`waiting_auth` 状态并释放队列占位
- [x] 2.4 新增后台收敛器：轮询后端状态机、终态成功自动 apply、持久化恢复

## 3. UI / Status

- [x] 3.1 Dashboard 状态标签新增 waiting 态
- [x] 3.2 interactive 等待阶段不计为失败汇总
- [x] 3.3 waiting 状态样式与 toast 文案补齐

## 4. Tests

- [x] 4.1 更新 interactive transport 测试为 deferred 语义
- [x] 4.2 增加 apply seam pending 回归测试
- [x] 4.3 增加后台收敛器测试（状态映射/持久化恢复/终态清理）
