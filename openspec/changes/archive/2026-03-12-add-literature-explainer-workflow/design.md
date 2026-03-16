## Context

插件现有 SkillRunner workflow（如 `literature-digest`）已具备稳定的 declarative request 构建与 hook 执行链路。`literature-explainer` 的核心差异在于：

- 执行模式为 `interactive`；
- 产物只包含可选 `note_path`，且 note 文件在本地路径；
- 无幂等跳过要求，每次成功执行可新增 note。

因此该变更主要是新增 workflow 包与测试，不改动 runtime 核心模块。

## Goals / Non-Goals

**Goals:**
- 让 `literature-explainer` 可被扫描、构建请求并执行。
- 输入路由严格遵循既定 1-5 规则（Markdown 优先 + PDF 回退）。
- 在 `applyResult` 中仅基于 `note_path` 是否可读决定是否创建 note。
- note 标题统一 `Conversation Note yymmddhhmm`，并保留 Markdown 原文 payload。

**Non-Goals:**
- 不改动 workflow runtime/core provider 协议。
- 不实现该 workflow 的幂等去重。
- 不引入存量迁移脚本。

## Decisions

- 沿用 `skillrunner.job.v1 + upload_files[source_path]` 声明式协议，避免新增 `buildRequest` 自定义逻辑。
- `filterInputs` 复用 `literature-digest` 的父条目聚合与最早时间排序策略，但移除“已有产物跳过”分支。
- `applyResult` 优先从 `runResult` 解析 `note_path`，回退读取 `result/result.json`，提升对不同 fetch/result 包装形态的兼容性。
- note 内容结构使用统一容器：
  - `data-zs-note-kind="conversation-note"`
  - `data-zs-view="conversation-note-html"`
  - `data-zs-payload="conversation-note-markdown"`（base64 编码原始 Markdown）

## Risks / Trade-offs

- [风险] `note_path` 可能是 `file://` 或平台相关路径格式  
  [缓解] 在 hook 内做 path 归一化并提供 IOUtils/fs 双通道读取。
- [风险] Markdown 渲染器为轻量实现，无法覆盖全部语法  
  [缓解] 保留原始 Markdown payload，渲染失败场景仍可恢复原文。
- [风险] 非幂等新增 note 可能导致重复笔记  
  [缓解] 该行为为需求显式指定，保持新增而不做去重。

