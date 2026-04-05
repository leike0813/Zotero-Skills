## 1. Implementation

- [x] 1.1 为 workflow host API 增加 `file.pickDirectory(...)` 与 `file.pickFile(...)`
- [x] 1.2 在 runtime context 中暴露 `workflowRootDir` / `packageRootDir` 供 package hooks 读取本地资产
- [x] 1.3 抽取 literature-digest 共享 note writer 与导出 helper
- [x] 1.4 新增 `export-notes` workflow，并支持父条目展开、直接 note 输入、多选聚合导出
- [x] 1.5 新增 `import-notes` workflow，并支持单父条目导入、schema 校验、整次冲突确认
- [x] 1.6 复制 `references.schema.json` 与 `citation_analysis.schema.json` 到 workflow 资产目录并接入本地校验 helper
- [x] 1.7 将 `literature-digest` 原 `applyResult` 切换到共享 note writer

## 2. Tests

- [x] 2.1 新增 workflow host api file picker 测试
- [x] 2.2 新增 `export-notes` / `import-notes` 行为测试
- [x] 2.3 新增 references / citation import schema 校验测试
- [x] 2.4 运行定向 mocha 回归
- [x] 2.5 运行 `npx tsc --noEmit`

## 3. Spec

- [x] 3.1 新建 `literature-digest-artifact-import-export` change
- [x] 3.2 补 proposal / design / tasks
- [x] 3.3 补 reference-workbench-package、workflow-execution-seams、literature-digest-artifact-contract delta specs
