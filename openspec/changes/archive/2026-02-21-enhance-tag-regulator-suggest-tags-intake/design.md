## Context

`tag-regulator` 后端 skill 的输出协议已升级：`suggest_tags` 由字符串数组改为对象数组，结构为 `{ tag, note }`。  
当前 workflow 实现仍按旧结构消费，导致建议说明 `note` 无法展示与落库。

Tag Manager 已具备词表持久化与协议校验能力，因此本 change 重点是：

- 在 `tag-regulator` workflow 结果阶段触发用户确认；
- 将用户确认结果通过 Tag Manager 词表接口落库；
- 将 `suggest_tags.note` 贯通到 UI 与词表持久化；
- 为 `tag-regulator` 增加 `tag_note_language` 参数，并与 `literature-digest` 的语言选项声明统一；
- 保持 workflow 与插件源码解耦边界。

## Goals / Non-Goals

**Goals:**

- `suggest_tags` 非空时弹出确认对话框，并展示 `tag + note`。
- 用户可逐条勾选建议标签对象并提交加入受控词表。
- 通过 Tag Manager 词表接口写入，避免重复造轮子。
- 新增条目 `source` 固定为 `agent-suggest`，并保留 `note`。
- 保持幂等：已存在标签不重复插入。
- 增加 `tag_note_language` 参数并透传。
- 统一 `tag-regulator` 与 `literature-digest` 语言参数的可选项声明列表。

**Non-Goals:**

- 不把 `suggest_tags` 直接写入父条目 tags。
- 不引入插件 `src/**` 的业务特化分支。

## Decisions

### Decision 1: 触发时机与弹窗条件

- 在 `tag-regulator` `applyResult` 完成父条目标签变更后评估 `suggest_tags`。
- 仅当 `suggest_tags` 为非空对象数组（每项含 `tag/note`）时弹出“建议标签纳入受控词表”对话框。
- 若 `suggest_tags` 为空或缺失，跳过该交互分支。

### Decision 2: 交互模型为逐条勾选 + 显式提交

- 对话框默认展示全部 `suggest_tags`，每项显示 `tag` 与 `note`，支持逐条选择。
- 提供“加入受控词表”按钮与取消路径。
- 取消/关闭视为放弃纳入，本次不改动受控词表。

### Decision 3: 持久化通过 Tag Manager 词表接口

- `tag-regulator` 不直接实现新的词表存储协议。
- 通过 Tag Manager 对应的词表写入接口执行新增。允许复用 Tag Manager 的业务代码。
- 写入前执行与 Tag Manager 一致的规范化与去重策略，保持词表结构一致性。

### Decision 4: 新增条目来源固定为 agent-suggest

- 对用户确认加入的条目，持久化字段：
  - `tag`: 选择的建议标签
  - `facet`: 从标签前缀解析（`facet:value`）
  - `source`: 固定 `agent-suggest`
  - `note`: 透传该建议项的 `note`
  - `deprecated`: `false`
- 若标签不满足受控词表格式校验，则跳过并记录诊断。

### Decision 5: 幂等策略

- 受控词表中已存在同名标签时，默认跳过（不覆盖）。
- 支持一次提交内去重，避免重复建议导致多次写入。
- 执行结果向用户汇总 `added/skipped/invalid` 数量。

### Decision 6: 新增 tag_note_language 参数并透传到 skillrunner 请求

- 在 `tag-regulator` workflow 参数中新增 `tag_note_language`，默认 `zh-CN`。
- `buildRequest` 将该值写入 `parameter.tag_note_language`。
- 该参数语义仅影响后端生成 `suggest_tags.note` 的语言，不影响父条目标签变更逻辑。

### Decision 7: 与 literature-digest 统一语言选项声明

- 为 `tag-regulator.tag_note_language` 与 `literature-digest.language` 使用同一组选项声明。
- 首批统一选项采用常见 BCP 47 值：`zh-CN`、`en-US`、`ja-JP`、`ko-KR`、`de-DE`、`fr-FR`、`es-ES`、`ru-RU`。
- 默认值保持 `zh-CN`。

## Risks / Trade-offs

- [Risk] `tag-regulator` 与 Tag Manager 接口耦合不清，后续维护成本上升  
  -> Mitigation: 仅依赖“词表读写最小接口”，必要时抽到 workflow 共享 helper，并保持协议单一来源。

- [Risk] 建议标签对象结构不规范导致消费失败  
  -> Mitigation: 复用 Tag Manager 既有校验逻辑，失败项记录为 `invalid` 并在对话框结果提示。

- [Risk] UI 交互中断主流程体验  
  -> Mitigation: 弹窗仅在 `suggest_tags` 非空时出现；提供取消路径且不影响已完成的父条目标签更新。

- [Risk] 语言选项在两个 workflow 中再次漂移  
  -> Mitigation: 在 change 中明确统一列表，并在测试中增加一致性断言。
