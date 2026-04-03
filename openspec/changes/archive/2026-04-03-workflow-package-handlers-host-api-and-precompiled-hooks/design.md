# Design

## Decision

- `WorkflowHostApi` 成为 package workflow 唯一允许消费的宿主能力面
- `handlers`、workflow editor host、toast/log seam 作为 `hostApi` 的底层实现，不向 package 直接暴露内部实现细节
- package hook 的执行模式统一收口为 `precompiled-host-hook`
- package runtime adapter 只负责读取 `runtime.hostApi`，不再解析 `Zotero` / `addon` / `globalThis`

## Host API model

- `runtime.hostApiVersion`
  - 当前固定版本 `2`
- `runtime.hostApi`
  - `addon.getConfig`
  - `items.get / resolve / getByLibraryAndKey / getAll`
  - `prefs.get / set / clear`
  - `parents / notes / attachments / tags / collections / command`
  - `editor.openSession / registerRenderer / unregisterRenderer`
  - `notifications.toast`
  - `logging.appendRuntimeLog`
  - `file.pathToFile / readText / writeText / exists / makeDirectory / getTempDirectoryPath`

## Loader model

- package hook 继续保留多文件源码与相对导入组织方式
- loader 在扫描期或装载期为 package hook 生成单文件宿主产物
- 运行时只执行预编译后的宿主 hook，不再构建 raw runtime bridge
- diagnostics 将该路径标记为:
  - `executionMode=precompiled-host-hook`
  - `contract=package-host-api-facade`
  - `compiledHookSource=scan-time-precompile`

## Package migration

- `reference-workbench-package`
  - references/note/editor helpers 改为通过 `hostApi.items / hostApi.notes / hostApi.editor`
- `tag-vocabulary-package`
  - state/buildRequest/applyResult helpers 改为通过 `hostApi.prefs / hostApi.items / hostApi.editor / hostApi.file`
- package-local `lib/runtime.mjs` 变成薄 adapter：
  - 校验 `hostApi`
  - 校验 `hostApiVersion`
  - 输出最小 helper

## Test strategy

- loader/runtime/probe 测试验证 `precompiled-host-hook` 和 `hostApi` 诊断
- package-lib 与 workflow 测试不再依赖 `__zsWorkflowRuntimeBridge` 或 raw `Zotero` contract
- direct package helper tests 通过当前正式契约注入 `__zsHostApi` / `__zsHostApiVersion`
