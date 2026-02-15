## Why

`workflow: reference-matching` 的端到端测试在 Zotero 运行时会输出本地化摘要（如 `成功=1`），但现有断言写死英文 token（`succeeded=1`），导致仅在 Zotero 环境出现误报失败。  
这个问题会降低分域 Zotero 回归门禁的稳定性，必须在测试断言层统一处理多语言摘要。

## What Changes

- 新增一个共享的工作流摘要计数断言工具，统一支持英文与中文摘要 token。
- 将 `reference-matching` 端到端用例改为复用共享断言，避免写死英文断言。
- 将 `literature-digest` 与 `reference-note-editor` 中重复的本地 helper 收敛到共享工具，消除重复逻辑并保持断言语义一致。
- 保持现有业务行为不变，只修复测试断言兼容性与稳定性问题。

## Capabilities

### New Capabilities

- `localized-workflow-summary-assertions`: 定义 workflow 执行摘要计数断言在多语言（至少中英文）环境下的一致性要求，并提供共享断言入口供测试复用。

### Modified Capabilities

- None.

## Impact

- 影响测试代码与测试工具层：`test/workflow-reference-matching/*`、`test/workflow-literature-digest/*`、`test/workflow-reference-note-editor/*`、`test/zotero/*`。
- 不影响插件运行时功能、不改变工作流执行结果，仅影响测试断言与回归稳定性。
- 降低 Zotero 与 Node 双运行时之间的假失败差异。
