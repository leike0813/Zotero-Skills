## Context

`HB-08` 在基线中定义为：在 `HB-02` 与 `HB-07` 之后，建立 mock parity 治理和漂移测试。  
当前代码库已有大量 Node mock 测试，但缺乏系统化治理边界：哪些 API 语义必须与真实 Zotero 严格一致、差异如何登记、何时允许偏差、如何防止漂移。

## Goals / Non-Goals

**Goals**

- 建立 Zotero mock parity 的治理合同与差异登记规则。
- 定义高风险 parity 测试切片，优先覆盖真实环境曾暴露过的问题类型。
- 形成 mock 变更准入机制：无 parity 证据不合入。
- 保持现有测试执行方式与开发体验基本不变。

**Non-Goals**

- 重写整个 mock 框架。
- 引入新的业务 workflow 功能。
- 用一次变更解决所有历史 mock 技术债。

## Decisions

### Decision 1: 建立“parity contract + drift register”双文档

- `parity contract`：定义必须一致的 API 行为语义与边界（读写、路径、筛选、异常）。
- `drift register`：记录已知偏差、风险等级、临时豁免原因、关闭条件。

### Decision 2: 以高风险链路优先覆盖 drift tests

首批覆盖目标：

- 运行时输入与路径解析（含 `attachments:` 相对路径等）；
- deleted/只读字段等真实环境行为约束；
- workflow 执行关键 seam 中对 Zotero API 的调用语义。

### Decision 3: mock 变更必须带 parity 证据

- 新增或修改 mock API 行为时，必须同步：
  - parity 测试（或更新现有断言）；
  - parity contract/drift register 记录。
- 未满足证据链的改动视为不完整。

### Decision 4: 与现有测试分层策略对齐

- mock parity 测试归入 architecture hardening 下的专项套件。
- 与 lite/full 套件映射规则保持一致，避免新增碎片化入口。

## Risks / Trade-offs

- [Risk] 规则过严导致 mock 迭代效率下降  
  Mitigation: 对低风险差异允许登记豁免，但需有过期/收敛条件。

- [Risk] parity 测试过重影响执行时长  
  Mitigation: 首批只纳入高风险最小集，并分 lite/full 分层运行。

- [Risk] contract 维护成本上升  
  Mitigation: 用模板化条目和变更检查清单降低维护成本。

## Migration Plan

1. 定义 parity contract 与 drift register 模板。
2. 盘点现有 mock 能力并映射高风险 API 面。
3. 增加首批 drift tests 并接入现有测试分层。
4. 更新 testing/hardening 文档，固化准入流程。

## Acceptance Gates (Inherited)

- Behavior parity
- Test parity
- Readability delta
- Traceability to baseline item `HB-08`
