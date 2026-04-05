## 1. Spec

- [x] 1.1 创建 proposal / design / tasks
- [x] 1.2 创建 `custom-note-import-export` spec

## 2. Library Functions

- [x] 2.1 在 `lib/literatureDigestNotes.mjs` 中添加 `exportCustomNote()` 函数
- [x] 2.2 在 `lib/literatureDigestNotes.mjs` 中添加 `importCustomNotes()` 函数
- [x] 2.3 添加 `getBaseName` 导入到 `lib/literatureDigestNotes.mjs`

## 3. export-notes Workflow

- [x] 3.1 修改 `export-notes/hooks/filterInputs.mjs` 允许普通 note 通过筛选
- [x] 3.2 验证 `export-notes/hooks/applyResult.mjs` 通过 `exportGeneratedNoteCandidate()` 支持 custom kind

## 4. import-notes Workflow

- [x] 4.1 修改 `import-notes/hooks/applyResult.mjs` 添加自定义 note 导入 UI 区域
- [x] 4.2 修改 `import-notes/hooks/applyResult.mjs` 添加 `importCustomNotes` 导入
- [x] 4.3 添加 `importCustomNotes` 导入语句

## 5. Validation

- [x] 5.1 运行 `node --check` 验证修改的 mjs 文件语法
- [x] 5.2 运行 `npm run build` 验证 TypeScript 类型检查
- [x] 5.3 运行定向 mocha 测试验证导入/导出功能
- [x] 5.4 运行 `openspec validate 2026-04-04-custom-note-import-export --strict`
