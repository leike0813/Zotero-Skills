## Context

`reference/Skill-Runner/skills/tag-regulator` 的契约要求：
- inline input：`metadata`、`input_tags`
- file input：`valid_tags`（严格键匹配上传）
- parameter：`infer_tag`、`valid_tags_format`

插件侧 `skillrunner.job.v1` 已支持在 provider client 层透传 mixed-input（`input + parameter + upload_files`）。  
因此本 change 只需聚焦 workflow 输入组装与结果落地，不再承担协议补齐工作。

## Goals / Non-Goals

**Goals:**

- 以“新增可插拔 workflow”为交付形态实现 tag 规范化能力，不把业务逻辑固化进插件源码主干模块。
- 实现父条目级 `tag-regulator` workflow：收集输入、提交 skill、按结果修改 tags。
- 与受控词表管理能力对接，稳定提供 `valid_tags` 文件输入。
- 建立失败兜底语义：输入构建失败或 skill 返回 `error` 时不做破坏性写入。

**Non-Goals:**

- 不在本 change 内实现受控词表编辑 UI（由 tag-manager change 负责）。
- 不改动 `tag-regulator` skill 包本身逻辑。
- 不做跨库批量治理策略优化（先保证单次 workflow 行为正确）。

## Decisions

### Decision 1: 输入单元采用 parent 维度

- `tag-regulator` workflow 以父条目为最小执行单元。
- 一次触发可处理多个父条目，但每个父条目独立构建请求、独立落地结果。

### Decision 1.5: 严格解耦边界（workflow package first）

- 该 change 的业务实现边界限定在 `workflows/tag-regulator/**`（manifest + hooks + 本地辅助资源）。
- `src/**` 仅可使用既有通用能力（workflow loader/executor/provider），不新增 tag-regulator 业务特化分支。
- 通过该边界保证 workflow 可独立演进、可替换、可移除，不与插件源码形成强耦合。

### Decision 2: 请求构建采用 hook 模式并显式组装 mixed-input

- 使用 `buildRequest` hook 自定义 `skillrunner.job.v1` payload：
  - `skill_id = tag-regulator`
  - `input.metadata`：父条目关键元数据
  - `input.input_tags`：父条目当前 tags
  - `upload_files`：`valid_tags` 文件（由受控词表导出结果物化）
  - `parameter.infer_tag` / `parameter.valid_tags_format`
- 规避声明式 upload selector（`selected.markdown/pdf`）无法表达 `valid_tags` 文件生成路径的问题。

### Decision 3: applyResult 采用保守写入策略

- 仅在返回结果通过结构校验且 `error == null` 时执行 tag 变更。
- `remove_tags` 仅移除输入中真实存在的 tags；`add_tags` 去重后添加。
- `suggest_tags` 与 `warnings` 进入执行摘要/日志，不直接写入条目 tags。

## Risks / Trade-offs

- [Risk] workflow 对已补齐的 mixed-input 契约存在隐式依赖，后续 provider 回归可能导致请求字段丢失  
  -> Mitigation: 增加回归测试，锁定 `input.metadata/input.input_tags + upload valid_tags + parameter` 同时到达后端。

- [Risk] 实现过程中把业务逻辑下沉到 `src/**`，导致 workflow 可插拔性退化  
  -> Mitigation: 在任务与验收中明确“业务逻辑位于 `workflows/tag-regulator/**`”并增加结构检查。

- [Risk] 词表导出与 workflow 执行时序不一致导致陈旧输入  
  -> Mitigation: 每次执行前即时读取最新持久化词表并物化上传文件。

- [Risk] skill 返回异常结构导致错误写入  
  -> Mitigation: 严格结果校验 + `error` 非空即跳过写入，保留诊断信息。
