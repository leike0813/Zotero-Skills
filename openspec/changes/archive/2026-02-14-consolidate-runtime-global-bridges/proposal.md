## Why

当前插件对运行时全局桥接对象（如 `ztoolkit`、`addon`、`globalThis` 上的宿主注入）访问分散在多个模块中，存在重复判空、分支漂移和测试替身不一致问题。  
为完成 HB-06，需要把全局桥接访问收敛到统一边界，降低环境差异导致的回归风险。

## What Changes

- 新增统一的 runtime bridge 访问层，集中解析与暴露全局桥接能力。
- 将分散的直接全局读取替换为 bridge API 调用，消除重复 fallback 逻辑。
- 统一 Node/Zotero 环境下桥接对象缺失时的降级语义（可用/不可用判定一致）。
- 为 bridge 层增加可注入测试入口，减少测试中对真实全局对象的隐式依赖。

## Capabilities

### New Capabilities

- `runtime-global-bridge-consolidation`: 统一管理运行时全局桥接对象访问与降级策略，避免模块各自解析全局状态。

### Modified Capabilities

- None.

## Impact

- 受影响代码：
  - runtime/UI 入口与执行反馈相关模块（包含 toast、dialog、host bridge 访问路径）
  - 全局对象读取工具函数与测试 mock 注入点
- 受影响测试：
  - 依赖 `ztoolkit` / `addon` / `globalThis` 分支的单元与集成测试
- 不改变 workflow 业务行为，仅收敛架构边界与一致性。
