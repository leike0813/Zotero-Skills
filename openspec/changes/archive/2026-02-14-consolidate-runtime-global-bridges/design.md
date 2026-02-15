## Context

HB-06 指出：全局运行时依赖访问模式分散，存在“同类能力在不同模块分别读取 `globalThis/addon/ztoolkit`”的问题。  
这种模式会导致：

- 同一能力（如 toast/dialog）在不同模块行为不一致；
- 环境迁移（Zotero/Node/mock）时出现隐式分支缺失；
- 测试替身注入成本高，且容易遗漏分支。

## Goals / Non-Goals

**Goals**

- 建立单一 runtime bridge 边界，收敛全局对象读取与 fallback。
- 让上层模块只依赖 bridge 合同，不直接触碰分散全局对象。
- 统一“不可用时”的降级策略并可测试。
- 为测试提供可控注入入口，减少对全局状态污染。

**Non-Goals**

- 重写 workflow 业务逻辑。
- 引入新的 UI 功能。
- 改变已有用户可见文案与交互流程。

## Decisions

### Decision 1: 引入 `runtimeBridge` 集中访问层

- 新增集中模块（例如 `src/utils/runtimeBridge.ts`）负责解析：
  - `ztoolkit` 及其子能力（ProgressWindow 等）；
  - `addon` 注入能力；
  - 宿主窗口可选能力（alert/confirm 等）。
- 上层模块不再直接拼接多源全局读取链。

### Decision 2: 统一降级语义

- bridge API 返回明确能力状态（available/unavailable），避免上层自行判空。
- 不可用时保持现有行为等价（如静默跳过 toast、回退 alert 等），但路径统一。

### Decision 3: 支持测试注入与重置

- bridge 层提供测试注入点（setter/resetter 或依赖注入接口）。
- 测试可以显式声明当前可用能力，不再依赖偶然全局状态。

### Decision 4: 分步替换，优先高风险入口

- 先替换执行反馈与关键入口模块（toast/dialog/workflow trigger feedback）。
- 后续再覆盖其余散落读取点，确保每步可回归验证。

## Risks / Trade-offs

- [Risk] 统一层过度抽象导致阅读跳转增多  
  Mitigation: 保持 API 小而平，按能力分组命名，避免“万能桥”。

- [Risk] 迁移遗漏导致行为差异  
  Mitigation: 针对旧分支写对照测试，确保 parity。

- [Risk] 测试注入接口误用于生产  
  Mitigation: 注入接口仅用于测试构建路径并在测试中显式 reset。

## Migration Plan

1. 定义 runtime bridge 合同与能力解析函数。
2. 将高风险模块迁移到 bridge（反馈/执行入口）。
3. 清理旧的重复全局读取逻辑。
4. 补充 bridge 单测与关键集成回归测试。

## Acceptance Gates (Inherited)

- Behavior parity
- Test parity
- Readability delta
- Traceability to baseline item `HB-06`

## HB-06 Completion Evidence

- Runtime bridge module落地：`src/utils/runtimeBridge.ts`
- 高风险入口迁移：
  - `src/modules/workflowExecution/feedbackSeam.ts`
  - `src/modules/logViewerDialog.ts`
  - `src/modules/workflowEditorHost.ts`
  - `src/modules/workflowExecution/messageFormatter.ts`
  - `src/hooks.ts`
  - `src/modules/selectionSample.ts`
  - `src/modules/workflowRuntime.ts`
- 回归与验证：
  - `npx tsc --noEmit`
  - `npm run test:node:full`
  - 新增 `test/zotero/52-runtime-bridge.test.ts`
