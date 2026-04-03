# Design

## Core decision
workflow-package 在 Zotero runtime 下不再直接执行 `resource://` ESM 模块，而是先将 entry hook 及其同包依赖图 bundle 成单文件 temp hook，再通过 host realm `loadSubScript` 执行。这样 package hook 与 legacy hook 进入同一 privileged API 语义环境。

## Execution model
1. Node / test 环境
   - 继续使用 package hook 原生模块加载，便于开发期验证与低层测试

2. Zotero runtime
   - 对 workflow-package hook 递归解析同包相对导入
   - 生成模块表 + `__require(...)` 的单文件脚本
   - 通过 host realm 临时脚本加载器执行，并暴露 entry hook 导出

3. Legacy workflow
   - 继续保留单文件 `.js` hook 的 text-loader 兼容路径

## Bundler constraints
- 支持：
  - named import / export
  - local export list
  - local re-export
- 禁止：
  - 跨包导入
  - 非相对导入
  - `export *`
  - `export default`
  - `import.meta`
- bundler 结果按 `entry path + dependency source fingerprint` 缓存，rescan 或文件变化后自动失效

## Runtime model cleanup
- package workflow 不再使用 `workflowExecutionToken`
- package workflow 不再使用 execution snapshot bridge 作为主能力链
- package-local runtime accessor 收口为 host-runtime-first，只保留最小 global fallback 与诊断能力

## Diagnostics
- loader / runtime / probe 统一记录：
  - `executionMode`
  - `capabilitySource`
- 废弃旧 bridge/token 诊断字段
