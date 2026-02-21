## Why

当前项目已经规划 `tag-manager` 与 `tag-regulator` 两个 workflow，但缺少可执行的受控词表管理能力。  
如果没有协议对齐的词表管理面板，后续 `tag-regulator` workflow 将缺少稳定输入（`valid_tags`），也无法闭环治理 tag 质量。

`reference/Zotero_TagVocab` 已定义了完整协议（CRUD/import/validate/compile/export），本 change 的目标是把该协议落地到插件 workflow 侧。

## What Changes

- 新增 `tag-manager` workflow（管理面板），用于受控 tag 词表的增删查改与检索。
- 新增协议驱动的词表领域模型与校验，实现与 `reference/Zotero_TagVocab/protocol/**` 对齐。
- 新增词表持久化能力（插件本地存储），支持会话间稳定加载。
- 新增导入能力：支持从 `tags/tags.yaml` 风格的完整字段 YAML 文件导入词表，并遵循 `import_tags` 协议冲突策略（`skip/overwrite/error`）与 `dry_run` 语义。
- 新增导出能力：将当前词表导出为纯字符串数组（`facet:value`），供 `tag-regulator` workflow 直接消费。
- 补充 Node/Zotero 双环境测试，覆盖协议校验、导入冲突策略、持久化、导出稳定性与 UI 关键路径。

## Capabilities

### New Capabilities

- `tag-vocabulary-management-workflow`: 受控词表管理 workflow（协议对齐 CRUD、持久化、导出）。

### Modified Capabilities

- None.

## Impact

- 影响 workflow 层新增一个管理型 workflow（本地编辑器面板）。
- 增加词表状态持久化与导出接口，供后续 `tag-regulator` workflow 复用。
- 不改变现有 reference-matching、literature-digest、mineru 等 workflow 语义。
