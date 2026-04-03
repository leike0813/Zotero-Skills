# workflow-package-handlers-host-api-and-precompiled-hooks

## Why
`workflow-package` 继续直接依赖 `raw Zotero/addon/globalThis/bridge` 已经被实机和 probe 反复证伪。真正可靠的边界应该是插件核心提供稳定宿主接口，package 只消费显式 `hostApi`，而不是再去猜测执行上下文里的 privileged object 形状。

## What Changes
- 用插件核心 `handlers` 为底座，定义稳定的 `runtime.hostApi` / `hostApiVersion` 契约
- 将 package hook 的宿主执行语义固定为 `precompiled-host-hook`
- 删除 package workflow 对 raw `Zotero/addon/globalThis/bridge` 的运行时契约依赖
- 将 `reference-workbench-package` 与 `tag-vocabulary-package` 的 runtime 适配层改写为 `hostApi` adapter
- 将 package editor / logging / notifications 统一接回插件核心 seam
- 将 diagnostics / debug probe 改为输出 `contract`、`hostApiVersion`、`hostApiSummary`、`compiledHookSource`

## Impact
- 这是 `workflow-package` 作者契约的 breaking change：package code 必须通过 `runtime.hostApi.*` 访问宿主能力
- 多文件 package 作者体验保留，但运行时不再依赖 live raw-runtime 拼装
- 已证伪的 package runtime 兼容残留物被显式移除，不再保留 silent fallback
