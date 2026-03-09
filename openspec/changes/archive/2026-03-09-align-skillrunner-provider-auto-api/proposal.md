## Why

Skill-Runner 在新版 API 文档中补充了更多状态与执行语义（尤其是 `canceled` 终态和 mixed-input 输入边界），  
而插件当前 `skillrunner` provider 仍按旧假设执行，存在两类风险：

- 轮询终态识别不完整，遇到 `canceled` 可能持续轮询直到超时；
- `skillrunner.job.v1` 的 `input` 合同比后端更窄（仅 object），可能拦截合法请求。

本 change 仅针对 Auto 执行链做一致性修复，避免后续 workflow 在默认模式下出现协议偏差。

## What Changes

- 新增并落地 `align-skillrunner-provider-auto-api` change。
- 对齐 skillrunner provider Auto 执行链：`/v1/jobs -> /upload -> /jobs/{id} -> /result|/bundle`。
- 轮询终态集合加入 `canceled`，并在 `failed/canceled` 下返回稳定、可诊断错误。
- 放宽 `skillrunner.job.v1` 的 `input` 合同为任意 JSON（string/array/object）。
- 补充 provider 文档，明确当前实现是 Auto-only，interactive 改造 deferred。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `provider-adapter`: skillrunner Auto 执行链的终态识别与请求合同对齐新版 API。

## Impact

- 影响范围仅限 provider 合同与传输状态机，不改 workflow 业务 hooks。
- 不迁移到 `/v1/management/*`，继续使用 `/v1/jobs*` 执行链。
- 不引入 interactive 交互流程（`waiting_user` / reply / auth session）实现。

