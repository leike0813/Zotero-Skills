## Why

当前 builtin workflow 生态在 `reference-workbench-package` 与独立的
`literature-explainer` 之间存在三类不必要分叉：

1. 包名与职责已经不匹配
   - 包内 workflow 已不止 reference matching / note editor，而是承载
     literature-digest、artifact import/export、conversation note 等更广的
     literature workbench 能力。

2. note / artifact 转换逻辑重复且不严格对称
   - `literature-digest`
   - `import-notes`
   - `export-notes`
   - `literature-explainer`
   都维护了相似但不完全一致的 markdown 渲染、payload 编码、note kind 识别、
   artifact 导入导出逻辑。

3. `import-notes` 的 custom note 多文件导入交互过于粗糙
   - 当前依赖循环调用 `pickFile`，用户需要重复确认，宿主能力也不完整。

此外，现有未完成的 `custom-note-import-export` change 已被新设计完整覆盖，
继续维持两条设计线会造成重复规范。

## What Changes

- 将 builtin package 从 `reference-workbench-package` 重命名为
  `literature-workbench-package`
- 将 `literature-explainer` 迁入包内，改为 package workflow，复用包内 runtime 与
  note codec
- 将原 `lib/literatureDigestNotes.mjs` 演进为统一的 note/artifact codec 层：
  - `digest`
  - `references`
  - `citation-analysis`
  - `conversation-note`
  - `custom`
- 统一实现以下双向能力：
  - artifact -> note
  - note -> artifact
  - round-trip 保持现有表观行为和 native artifact contract
- 为 workflow host API 新增 `file.pickFiles(...)`
- `import-notes` 改用 `pickFiles` 替换 custom note 的循环 `pickFile` 流程
- 新 change 明确吸收 `custom-note-import-export` 的目标，后续以本 change 为准

## User-Facing Impact

- 现有 workflow id 保持不变，用户菜单、配置和调用方式不变
- `export-notes` 继续导出 digest 三类 note，同时支持 `conversation-note` 与
  `custom` note
- `import-notes` 继续导入 digest 三类 artifact，同时保留 custom note 导入能力
- `literature-explainer` 继续创建父条目下的 conversation note，但实现改为复用
  包内统一 codec
- custom note 多文件导入体验改进为一次选择多个文件

## Compatibility

- note DOM 结构保持兼容：
  - `data-zs-note-kind`
  - `data-zs-view`
  - `data-zs-payload`
- payload type 名称保持兼容，例如：
  - `conversation-note-markdown`
  - `custom-markdown`
- 导出文件名和 literature-digest native artifact contract 不变
- workflow id 不变，只有 package id 与包目录更名

## Supersedes

本 change 吸收并取代未完成的 `custom-note-import-export` 目标；custom note
导入导出能力此后按 `literature-workbench-package-unification` 的统一 codec 合同
维护。
