## Why

`literature-digest` 已经在父条目下生成三类产物 note，但当前工作流体系缺少稳定的“产物进出”路径：

- 用户不能把现有 digest / references / citation analysis note 导出为可归档文件。
- 用户不能把外部修订后的 markdown / json 再导回父条目并复用现有 note 写入逻辑。
- workflow package hooks 也缺少通用的目录/文件选择宿主能力，只能依赖私有 UI 细节。

这导致 literature-digest 产物无法形成稳定的人工修订与再导入闭环。

## What Changes

- 在 `reference-workbench-package` 中新增两个 workflow：
  - `export-notes`
  - `import-notes`
- `export-notes` 支持：
  - 父条目输入展开其已有的 digest / references / citation-analysis note；
  - 直接选择三类 note；
  - 多选与混选；
  - 单次触发只弹一次导出目录选择窗口，并按 `Parent Title [itemKey]` 落盘；
  - 外部文件一律写 Skill-Runner 原生产物，而不是 plugin 内部 note payload wrapper。
- `import-notes` 支持：
  - 仅单个父条目触发；
  - 分别导入 digest markdown、references json、citation-analysis json；
  - references / citation-analysis 使用复制进 workflow 的 schema 资产校验；
  - 冲突时整次导入一次确认；
  - 只接受原生产物，不兼容旧 wrapper 文件。
- 从 `literature-digest` 原 `applyResult` 中抽取共享 note writer，供原 workflow 与 `import-notes` 共用。
- 为 workflow package hooks 增加通用文件选择宿主能力：
  - `hostApi.file.pickDirectory(...)`
  - `hostApi.file.pickFile(...)`

## Capabilities

### New Capabilities

- `reference-workbench-package`: `export-notes` 批量导出 literature-digest 生成 note。
- `reference-workbench-package`: `import-notes` 校验并导入 literature-digest 产物文件。
- `workflow-execution-seams`: package hooks 可通过 host API 请求目录/文件选择。
- `literature-digest-artifact-contract`: 明确三类 note 与外部 markdown/json 产物的映射契约。

### Modified Capabilities

- `literature-digest` 改为复用包内共享 note writer，而不是在 workflow hook 内重复维护写 note 逻辑。
- 导入导出流程统一把 wrapper 限定为 note 内部 payload；磁盘文件契约收敛为 native artifact。

## Impact

- 新增 `reference-workbench-package/export-notes/**`
- 新增 `reference-workbench-package/import-notes/**`
- 新增 `reference-workbench-package/lib/literatureDigestNotes.mjs`
- 新增 `reference-workbench-package/lib/importSchemas.mjs`
- 更新 workflow runtime host API 类型与注入实现
- 新增导入导出、schema 校验、hostApi file picker 的测试覆盖
