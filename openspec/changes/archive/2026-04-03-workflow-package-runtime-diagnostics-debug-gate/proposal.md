# workflow-package-runtime-diagnostics-debug-gate

## Why
Zotero runtime 下的 workflow-package 仍有实机触发不稳定问题，目前缺少受控、结构化、可导出的诊断链，难以定位 loader、resource root、hook execution scope 和 package-local runtime accessor 之间的真实失效点。

## What Changes
- 新增受硬编码 debug 模式控制的 workflow-package 运行时诊断机制
- 诊断同时输出到 runtime logs / diagnostic bundle 和 Zotero 控制台
- 覆盖 loader/resource root、hook execution scope、package-local runtime accessor 三层关键链路
- debug 模式启动时自动开启 runtime log diagnostic mode

## Impact
- 不改 workflow schema、package schema、settings 和 UI 主模型
- 正常模式下无新增诊断噪音
- debug 模式下可直接从任务面板和 Zotero 控制台提取真诊断
