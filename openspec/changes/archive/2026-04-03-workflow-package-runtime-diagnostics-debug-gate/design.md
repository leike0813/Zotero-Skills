# Design

## Core decision
诊断统一受 `src/modules/debugMode.ts` 的硬编码开关控制。启用后：

- 通过通用 helper 将结构化事件写入 runtime logs
- 同步写 `console.*` 与 `Zotero.debug`
- startup 自动开启 runtime log diagnostic mode，并允许 debug/info/warn/error 全级别保留

## Diagnostic layers
1. Loader / resource bridge
   - 记录 resource root 注册/刷新/清理
   - 记录 `filePath -> resource://...` 映射
   - 记录 package hook 真实模块导入开始/成功/失败

2. Workflow execution scope
   - 在 `filterInputs` / `buildRequest` / `applyResult` 执行前记录 workflow/package/hook 和 capability 摘要
   - 执行失败时记录统一错误事件

3. Package-local runtime accessor
   - 仅记录关键 fallback 与 capability 缺失
   - 区分 package scope、global fallback 和 missing 三类情况

## Constraints
- 不新增业务桥，不把 tag/reference 领域逻辑上移到核心
- 只增加通用 workflow runtime 诊断能力
- 诊断内容避免输出敏感配置明文
