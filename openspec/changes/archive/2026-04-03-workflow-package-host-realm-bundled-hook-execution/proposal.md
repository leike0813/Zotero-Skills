# workflow-package-host-realm-bundled-hook-execution

## Why
Zotero runtime 下直接执行 `resource://...mjs` package hooks 的方案已经被实机证明不可行。即使补充 token、bridge 和 `globalThis` carrier，package `.mjs` 仍无法稳定直接使用 Zotero privileged API。继续保留这条链只会增加复杂度和误导。

## What Changes
- 将 workflow-package 在 Zotero runtime 下的主执行路径切换为 `package graph -> bundled temp hook -> host realm execution`
- 新增 package graph bundler，解析同包相对导入并生成 host realm 可执行的单文件脚本
- 移除 package workflow 的 token/bridge/globalThis capability 主链与相关兼容分支
- 保留 legacy 单文件 workflow 的现有 text-loader 兼容执行路径
- 统一 diagnostics 与 debug probe 到新执行模型，输出 `executionMode` 与 `capabilitySource`

## Impact
- 不改 `workflow.json` / `workflow-package.json` schema
- package 作者视角仍使用 `.mjs` + 包内相对导入
- Zotero runtime 下 package workflow 的标准执行模型改为 host realm bundled execution
- legacy 单文件 workflow 保持兼容
