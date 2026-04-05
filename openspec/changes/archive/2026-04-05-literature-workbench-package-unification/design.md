## Overview

本 change 做四件事：

1. 将 `reference-workbench-package` 更名为 `literature-workbench-package`
2. 将 `literature-explainer` 迁入包内
3. 把包内 note / artifact 转换收敛为统一 codec
4. 为 host API 新增 `pickFiles`

设计目标是统一内部实现，同时保持外部行为不变。

## Decisions

### 1. package rename 只改 package 身份，不改 workflow 身份

- package id 改为 `literature-workbench-package`
- 目录改为 `workflows_builtin/literature-workbench-package`
- workflow id 保持不变：
  - `export-notes`
  - `import-notes`
  - `literature-digest`
  - `literature-explainer`
  - `reference-matching`
  - `reference-note-editor`

这样可以让 builtin package 的组织方式与实际职责对齐，同时避免破坏 workflow
级别的 UI、settings 和用户 override 合同。

### 2. note codec 采用分层结构

统一 codec 分三层：

1. 通用 HTML / payload codec
   - markdown -> HTML
   - payload base64 encode / decode
   - payload block render / parse
   - note kind 识别

2. note kind codec
   - `digest`
   - `references`
   - `citation-analysis`
   - `conversation-note`
   - `custom`

3. workflow-facing 双向入口
   - artifact -> note content / payload
   - note content / payload -> export artifact

统一入口放在 package `lib/` 下，由 `literature-digest`、`import-notes`、
`export-notes`、`literature-explainer` 共同复用。

### 3. 保持现有 note DOM 结构兼容

这次不改已有 note 的 DOM 标记合同：

- `data-zs-note-kind`
- `data-zs-view`
- `data-zs-payload`

也不更改 payload 类型名，例如 `conversation-note-markdown` 和
`custom-markdown`。这样现有 note、导入导出、测试 fixture 和用户已创建内容
都保持兼容。

### 4. `literature-explainer` 只迁 bundle 解析，不重复 note writer

迁入包内后的 `literature-explainer` 保留自己的 explainer-specific 逻辑：

- interactive `skillrunner.job.v1`
- bundle/result 解析
- conversation artifact 选择

但不再维护独立的：

- markdown 渲染
- payload block 构造
- note HTML 组装
- note 创建

这些统一改为调用包内 `conversation-note` codec。

### 5. `pickFiles` 是 host API 的补强，不改变 `pickFile`/`pickDirectory`

新增：

```ts
runtime.hostApi.file.pickFiles(args?): Promise<string[] | null>
```

设计约束：

- 保持 `pickFile`、`pickDirectory` 现有语义不变
- 用户取消返回 `null`
- 成功时返回按用户选择顺序排列的绝对路径数组
- `import-notes` custom note 导入改用 `pickFiles`，不再循环调用 `pickFile`

## Risks / Trade-offs

- 包重命名会触及 manifest、测试路径和 spec 名称，改动面较广；但这是一次性
  清理，后续维护成本更低。
- codec 收敛需要严格保持现有 note DOM 兼容，否则会引入回归；因此本次强调
  round-trip 测试而不是借机重塑 note 结构。
- `literature-explainer` 迁入包内后，独立 workflow 目录不再存在；测试和调试
  需要统一适配 package workflow 的真实路径。

## Validation

- codec round-trip 语义测试覆盖五类 note
- `literature-digest` / `literature-explainer` workflow 回归
- `import-notes` / `export-notes` 回归
- `pickFiles` host API 测试
- workflow scan / package registration 测试
- `openspec validate literature-workbench-package-unification --strict`
- `npx tsc --noEmit`
