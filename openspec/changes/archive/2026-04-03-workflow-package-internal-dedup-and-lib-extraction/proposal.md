# workflow-package-internal-dedup-and-lib-extraction

## Why

上一轮 `workflow-package-multi-manifest-bundles` 已经让 builtin workflow 具备“多 workflow 同包装载”能力，并把 `tag-vocabulary-package` 与 `reference-workbench-package` 迁到了聚合包结构下。

但这轮迁移主要停留在目录与装载层：

- `tag-manager` 与 `tag-regulator` 仍各自维护一套 prefs / remote / staged / bindings 逻辑
- `reference-note-editor` 与 `reference-matching` 仍复制 references note codec 与 selection 逻辑
- `reference-matching` 的 `normalizeSettings` 与 `applyResult` 仍复制 citekey template 解析与校验规则

这导致 package 已经成立，但 package 内部并没有真正成为共享实现单元。

## What Changes

- 在 `tag-vocabulary-package/lib/` 提取同包共享的 model / state / remote / runtime 逻辑
- 在 `reference-workbench-package/lib/` 提取同包共享的 html codec / references note / citekey template / reference model 逻辑
- 将两组 package 的 hooks 改为薄编排层，依赖各自 package 的 `lib/`
- 保持所有 workflow 对外行为、manifest、settings、workflowId、UI 入口不变
- 补充包级低层测试，验证共享模块本身，而不只依赖黑盒 workflow 回归

## Impact

- 降低包内重复逻辑和维护成本
- 让 workflow package 真正具备“包内共享实现”的价值
- 不改变 loader、registry、settings、dashboard 或外部 workflow 协议
