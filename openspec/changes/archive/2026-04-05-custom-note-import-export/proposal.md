## Why

当前 `export-notes` workflow 只能导出由 `literature-digest` workflow 创建的三类特殊 note（digest、references、citation-analysis）。用户希望扩展这两个 workflow 的能力以支持普通 note 的导入/导出：

1. **export-notes**: 需要支持导出普通 note
   - 当选择对象是 literature-digest 创建的三个特殊 note 时，行为不变
   - 当选择集内存在普通 note 时，需要能够导出为 markdown 或 HTML 格式

2. **import-notes**: 需要添加导入自定义 note 的能力
   - 在弹出窗口中新增"导入自定义 note"按钮
   - 用户可选择一个或多个 markdown 文件
   - 导入为 note（文档类型为 custom），title 为文件名（无扩展名）

当前的限制：
- `filterInputs.mjs` 会跳过所有 `parseGeneratedNoteKind()` 返回空的 note
- `exportGeneratedNoteCandidate()` 不支持 `kind === "custom"` 的情况
- `import-notes` UI 只有三行固定类型（digest/references/citation-analysis），没有自定义 note 入口
- 没有 `importCustomNotes()` 函数来处理 markdown 文件导入

## What Changes

- 修改 `export-notes/hooks/filterInputs.mjs` 允许普通 note 通过筛选（标记为 `kind === "custom"`）
- 修改 `lib/literatureDigestNotes.mjs` 添加 `exportCustomNote()` 函数
- 修改 `lib/literatureDigestNotes.mjs` 添加 `importCustomNotes()` 函数
- 修改 `import-notes/hooks/applyResult.mjs` 添加自定义 note 导入 UI 区域
- 修改 `import-notes/hooks/applyResult.mjs` 处理自定义 note 的导入逻辑

## Capabilities

### Modified Capabilities

- `reference-workbench-export-notes`
  - 扩展 export-notes workflow 以支持普通 note 导出（custom kind）
  - 支持导出 base64 payload 解码后的 markdown 或原始 HTML 内容

- `reference-workbench-import-notes`
  - 扩展 import-notes workflow 以支持自定义 note 导入
  - 新增"Import Custom Note(s)"按钮支持多选 markdown 文件
  - 导入的 note 标记为 `data-zs-note-kind="custom"` 并包含 base64 payload

### New Capabilities

- `custom-note-export`
  - 定义普通 note 导出时的 payload 识别和文件格式选择规则
  - 有 payload 时输出 `.md`，无 payload 时输出 `.html`

- `custom-note-import`
  - 定义 markdown 文件导入为 note 的结构和 payload 编码规则
  - 导入的 note 包含渲染后的 HTML 视图和 base64 编码的原始 markdown

## Impact

- 更新 `lib/literatureDigestNotes.mjs` 添加 `exportCustomNote()` 和 `importCustomNotes()` 函数
- 更新 `export-notes/hooks/filterInputs.mjs` 允许普通 note 通过筛选
- 更新 `import-notes/hooks/applyResult.mjs` 添加自定义 note 导入 UI 和处理逻辑
- 导入的自定义 note 可通过 `export-notes` 工作流再次导出（保持双向兼容）
