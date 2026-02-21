## Why

仅有受控词表管理并不能自动修正条目标签，仍然需要把父条目的现有 tags 与词表、元数据一起送入后端 `tag-regulator` skill 完成规范化。  
当前插件尚无该 workflow；而其所需 mixed-input（`input + parameter + file`）执行能力已由前置 provider 改造补齐。

## What Changes

- 新增 `tag-regulator` workflow，面向父条目执行 tag 规范化（新增 workflow 交付，而非插件内置业务模块改造）。
- workflow 在请求阶段收集父条目元数据与当前 tags，结合受控词表导出结果构造 skill 输入。
- workflow 在结果阶段按返回的 `remove_tags/add_tags/suggest_tags` 执行条目 tag 更新与提示。
- 补充 Node/Zotero 双环境回归，覆盖成功路径、失败兜底与不确定结果处理。
- 明确解耦边界：业务行为以 `workflows/tag-regulator/**` 的清单与 hooks 承载，不向 `src/**` 注入 tag-regulator 业务特化逻辑。

## Capabilities

### New Capabilities

- `tag-regulator-workflow`: 基于后端 skill 的 tag 规范化 workflow（父条目输入、结果落地、提示输出）。

### Modified Capabilities

- None.

## Impact

- 新增一个业务 workflow（tag 规范化）及其 hooks。
- 该能力以可插拔 workflow 方式交付，要求与插件源码严格解耦（插件仅提供通用 workflow 执行能力）。
- 与 `add-tag-vocabulary-management-workflow` 存在依赖：需要复用其受控词表导出产物。
- `add-skillrunner-inline-input-passthrough` 前置依赖已完成（provider 已具备 mixed-input 透传能力），本 change 可直接在其能力上实现 workflow。
