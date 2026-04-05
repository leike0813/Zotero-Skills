## Overview

本次功能扩展为 `export-notes` 和 `import-notes` 两个 workflow 添加自定义 note 的导入/导出能力。核心思路是：

1. export-notes 通过扩展 `kind` 识别逻辑支持普通 note
2. 导入/导出使用相同的 payload 编码格式保证双向兼容
3. import-notes 在 UI 中新增独立区域处理自定义 note 导入

## Decisions

### 1. custom note 的 kind 标识

- `filterInputs` 中无法识别的 note 统一标记为 `kind: "custom"`
- `parseGeneratedNoteKind()` 返回空字符串时 fallback 到 `"custom"`
- 不对普通 note 的内容做任何侵入式识别

### 2. export 导出格式选择

- 有 `data-zs-payload="custom-markdown"` 时输出 `.md` 文件
- 无 payload 时输出 `.html` 文件（保留原始格式）
- 文件名统一使用 note 的 title 字段

### 3. custom note 的 payload 编码

- 导入时使用 `data-zs-payload="custom-markdown"` 标记
- 编码方式固定为 `base64`
- 保证导入的 note 可以再次导出并保持内容一致

### 4. import-notes UI 布局

- 在现有三行（digest/references/citation-analysis）下方新增独立区域
- 使用 "Import Custom Note(s)" 按钮触发多选文件
- 显示已选文件列表，支持单项移除
- 不改变现有三种特殊 note 的导入逻辑

### 5. custom note 的导入结构

导入的 note 包含：
- `<div data-zs-note-kind="custom">` 根容器
- `<h1>` 标题（文件名无扩展名）
- `<div data-zs-view="custom-html">` 渲染后的 HTML
- `<span data-zs-payload="custom-markdown">` base64 编码的原始 markdown

### 6. 向后兼容性

- 现有 export-notes 对 literature-digest 特殊 note 的行为完全不变
- import-notes 的冲突检测逻辑只作用于三种特殊 note，不影响 custom notes
- custom notes 导入时不检查现有 note，直接创建新 note

## Risks / Trade-offs

- custom note 导出为 HTML 时可能包含复杂的 DOM 结构，但这是保留原始格式的唯一方式
- 导入时不检查重复 note，可能导致同一父条目下存在多个同名 custom note
- markdown 渲染使用 `renderMarkdownToHtml()` 的简化实现，不支持所有 markdown 特性

## Validation

- 手动测试：选择普通 note 运行 export-notes 验证导出结果
- 手动测试：使用 import-notes 导入 markdown 文件并验证结构
- 手动测试：导入后再次导出验证 round-trip 一致性
