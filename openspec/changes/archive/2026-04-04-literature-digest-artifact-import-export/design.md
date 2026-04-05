## Overview

这次实现把 literature-digest 产物 IO 分成两层：

1. `reference-workbench-package` 内的 workflow 负责输入选择、文件选择、导入导出编排。
2. 共享包内 helper 负责 note 内容解析、payload 解码、HTML 渲染与 upsert。

这样可以避免在多个 workflow 中重复维护三类 generated note 的写入细节。

## Workflow Design

### `export-notes`

- provider 使用 `pass-through`
- `filterInputs` 负责把父条目和直接 note 选择统一归一化为 `exportCandidates`
- 为了满足“多选只弹一次目录选择窗口”，`filterInputs` 返回一个合成的单执行单元，`buildRequest` 生成一个聚合 request
- `applyResult` 中通过 `hostApi.file.pickDirectory(...)` 选择根目录，然后为每个候选写出：
  - `digest.md`
  - `references.json`
  - `citation_analysis.json`
  - `citation_analysis.md`
- 导出的 `references.json` / `citation_analysis.json` 必须是 Skill-Runner native artifact：
  - `references.json` 导出默认使用 bare array
  - `citation_analysis.json` 顶层直接是 `meta/summary/timeline/items/unmapped_mentions/report_md`
- note 内部 payload wrapper 不属于外部导出契约。

### `import-notes`

- provider 使用 `pass-through`
- `filterInputs` 只接受恰好一个父条目
- `applyResult` 使用 workflow editor host 打开导入选择界面
- 每个导入种类独立选择文件并预校验
- 若目标父条目下已存在任一被选 note，则显示整次导入冲突确认
- 最终写入统一走共享 helper `upsertLiteratureDigestGeneratedNotes(...)`
- `import-notes` 只接受 native artifact：
  - references 接受 bare array 或 schema-style `{ items: [...] }`
  - citation analysis 只接受顶层 raw citation object
  - 旧 wrapper 文件直接判为非法输入

## Schema Assets

`import-notes` 将以下 schema 复制为 workflow 本地资产，并优先从本地路径读取：

- `assets/references.schema.json`
- `assets/citation_analysis.schema.json`

读取失败时，package helper 会回退到内嵌 schema 常量，保证测试和打包环境都能工作。

references 外部文件以真实 Skill-Runner 产物为主，导出使用 bare array；导入同时接受 bare array 和 schema-style `{ items: [...] }`，并在校验前将 bare array 临时包装成 `{ items: [...] }` 来复用复制进来的 schema。

citation analysis 外部文件以复制进来的 `citation_analysis.schema.json` 的内层 `citation_analysis` 对象结构为准；因为 Skill-Runner 原生产物本身就是 raw inner object，所以导入校验会从复制的 wrapper schema 中提取内层对象 schema 来做严格校验。

## Shared Note Writer

`literatureDigestNotes.mjs` 承担以下共享职责：

- 识别父条目下既有 generated note
- 解析 digest / references / citation-analysis 隐藏 payload
- 将 digest markdown 渲染为 note HTML
- 将 references 与 citation-analysis payload 写回 note
- 维护 note kind、标题、payload block 和隐藏元数据

原 `literature-digest` workflow 与新 `import-notes` workflow 都复用同一入口，保证产物结构一致。

共享 helper 同时承担 native artifact 与内部 payload 之间的单向转换：

- 导出时：内部 payload -> native artifact
- 导入时：native artifact -> 内部 payload

## Host API Extension

为 workflow package hooks 扩展：

- `hostApi.file.pickDirectory(args?)`
- `hostApi.file.pickFile(args?)`

这两个能力通过核心 runtime 注入，workflow package hooks 不直接依赖 Zotero 全局对象或 toolkit 私有桥接。

## Validation and Testing

实现遵循 TDD：

- 先增加 hostApi file picker 测试
- 再增加导入导出工作流测试
- 再增加 references / citation schema 校验测试
- 最后补 OpenSpec change 工件并运行 `npx tsc --noEmit`
