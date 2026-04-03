## Why

当前 workflow 核心把“目录”与“单个 workflow”绑定在一起，导致一组强相关的 workflow 必须被硬拆成多个独立目录。这样会带来两个问题：

- 关联紧密的 workflow 不能以一个包为装载和组织单元
- 包内可复用代码无法被合法共享，只能重复实现或被迫上移到不合适的插件核心层

需要引入“多-workflow 包”能力，让一个包内可以声明多个 workflow，并允许它们共享包内代码。

## What Changes

- 新增 `workflow-package.json` 包索引格式，允许一个包根声明多个子 workflow manifest
- loader / registry / builtin sync 支持“单目录单 workflow”与“多-workflow 包”双格式并存
- builtin workflow 迁移为两个聚合包：
  - `tag-manager` + `tag-regulator`
  - `literature-digest` + `reference-note-editor` + `reference-matching`
- workflow 级 UI、设置、覆盖语义继续按 `workflowId` 保持不变

