## Why

当前 `reference-matching` workflow 还缺少两个关键能力：父条目入口（仅 note 入口）和可用的 Better BibTeX HTTP 数据源（仅占位）。这会限制批量执行效率，也阻塞了在本地 BBT 环境下的稳定匹配流程。

## What Changes

- 扩展 `reference-matching` 输入判定：除直接选中 references note 外，也支持选中父条目后自动定位其下合法 references note。
- 明确执行单元拆分规则：一次选中多个父条目时，必须按父条目拆为多条独立请求记录，不允许打包为单条。
- 落地 `data_source=bbt-json` 的本地 BBT HTTP JSON-RPC 路径，替代当前占位报错。
- 新增 BBT 端口配置能力，并将配置入口放在 Workflow Settings（仅配置端口，不配置完整 URL）。
- 在 `reference-matching` 文档与测试中补齐上述行为，确保可追溯和可回归验证。

## Capabilities

### New Capabilities

- `reference-matching-input-routing`: 定义 references note 与父条目双入口，以及“每父条目一条请求”的拆分语义。
- `reference-matching-bbt-http-port`: 定义 BBT HTTP JSON-RPC 数据源能力与 Workflow Settings 端口配置语义。

### Modified Capabilities

- （无）

## Impact

- `workflows/reference-matching/workflow.json`：新增/调整 BBT 端口参数声明。
- `workflows/reference-matching/hooks/filterInputs.js`：输入合法性扩展到父条目场景。
- `workflows/reference-matching/hooks/applyResult.js`：实现 BBT HTTP JSON-RPC 路径与端口应用。
- `src/workflows/runtime.ts`：补足 pass-through 场景下的多单元拆分语义（多父条目/多 note）。
- `src/modules/workflowSettingsDialog.ts` 与相关设置流：在 Workflow Settings 中提供 BBT 端口编辑能力。
- `test/zotero/24-workflow-reference-matching.test.ts` 及相关测试：新增父条目入口、拆分语义与 BBT HTTP 路径用例。
- `doc/components/workflows.md`：更新 reference-matching 行为说明。
