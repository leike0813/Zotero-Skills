## 1. Change scaffolding

- [x] 1.1 创建 `literature-workbench-package-unification` change
- [x] 1.2 编写 proposal / design / delta specs
- [x] 1.3 将变更目标声明为吸收 `custom-note-import-export`

## 2. Package rename and workflow migration

- [x] 2.1 将 builtin package 从 `reference-workbench-package` 重命名为 `literature-workbench-package`
- [x] 2.2 更新 builtin manifest、package manifest、测试路径与扫描断言
- [x] 2.3 将 `literature-explainer` 迁入 package，并改为 package hook 路径

## 3. Unified note/artifact codec

- [x] 3.1 新建统一 note codec 层，抽取共享 HTML / payload / note-kind 逻辑
- [x] 3.2 让 `literature-digest`、`import-notes`、`export-notes` 复用统一 codec
- [x] 3.3 让迁入 package 的 `literature-explainer` 复用统一 `conversation-note` codec
- [x] 3.4 保持 digest / references / citation-analysis / conversation-note / custom 的 round-trip 兼容

## 4. Host API enhancement

- [x] 4.1 为 workflow host API 新增 `file.pickFiles`
- [x] 4.2 将 `import-notes` custom note 导入切换为 `pickFiles`
- [x] 4.3 补充 file picker 定向测试

## 5. Validation

- [x] 5.1 运行 package lib / import-export / literature-digest / literature-explainer / workflow scan / hostApi 定向 mocha 测试
- [x] 5.2 运行 `openspec validate literature-workbench-package-unification --strict`
- [x] 5.3 运行 `npx tsc --noEmit`
