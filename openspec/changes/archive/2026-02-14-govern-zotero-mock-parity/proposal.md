## Why

`HB-08` 要求补齐 Mock parity 治理。当前 `test/setup/zotero-mock.ts` 能支撑大部分 Node 测试，但缺少明确的“与真实 Zotero API 保持一致”的治理机制，导致：

- 真实 Zotero 与 mock 行为差异可能在较晚阶段才暴露；
- 历史回归（如只读字段、路径解析、deleted 过滤）容易重复出现；
- mock 变更缺少统一验收标准与追溯记录。

## What Changes

- 为 Zotero mock 建立显式 parity 治理合同（能力清单、差异登记、升级规则）。
- 建立针对高风险边界的 mock-vs-real drift 测试策略与最小回归集。
- 规定 mock 扩展流程：新增/变更 API 行为必须附带 parity 证据与测试。
- 将 parity 治理接入硬化文档与测试说明，形成长期维护机制。

## Capabilities

### New Capabilities

- `zotero-mock-parity-governance`: 对 Node mock 与真实 Zotero API 行为一致性进行可审计、可回归的治理。

### Modified Capabilities

- None.

## Impact

- 受影响范围：
  - `test/setup/zotero-mock.ts` 及相关 mock helper
  - 高风险执行链路对应测试（workflow/runtime/loader/provider/settings）
  - `doc/testing-framework.md`、`doc/architecture-hardening-baseline.md` 的 parity 维护说明
- 不引入用户可见功能变更，主要提升测试可信度与回归防护能力。
