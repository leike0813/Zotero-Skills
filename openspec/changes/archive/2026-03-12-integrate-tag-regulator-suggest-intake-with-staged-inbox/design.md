## Context

`tag-manager` staged inbox 已具备独立持久化与提交流程，但 `tag-regulator` 仍未把未确认建议导入 staged。  
同时，现有 workflow editor host 仅支持 Save/Cancel，无法表达“三全局按钮 + close 默认动作”。

## Goals / Non-Goals

**Goals**

- suggest-tags 对话支持条目级即时动作与三全局动作。
- 10 秒倒计时到期自动执行“全部暂存”。
- 用户手动关闭窗口时执行 close=>stage-all 策略。
- 与 `tag-manager` staged bridge 方法联动，保证建议条目可回收。
- 扩展 editor host 合同并保持旧 Save/Cancel 调用兼容。

**Non-Goals**

- 不修改 `remove_tags/add_tags` 对父条目的既有应用逻辑。
- 不改 `tag-manager` 主词表 UI/交互。

## Architecture

### 1) Suggest Intake 状态机

- 状态载体：`suggestTagEntries` + `rowErrors` + `addedDirect/staged/rejected/invalid` + `countdownSeconds`。
- 条目级动作：
  - `加入`：立即走受控词表校验与持久化；成功移除行，失败保留行并打错误。
  - `拒绝`：立即从当前对话状态移除并记入 `rejected`。
- 全局动作：
  - `全部加入`：批量执行加入；存在失败则保留失败行与错误，不关闭。
  - `全部暂存`：批量写 staged；成功后关闭。
  - `全部拒绝`：批量废弃后关闭。

### 2) 超时与关闭默认动作

- 对话打开后启动 10 秒倒计时。
- 倒计时到期：执行 stage-all 并关闭窗口。
- `closeActionId=stage-all`：用户手动关闭时触发同一默认策略。

### 3) Vocabulary Bridge 协同

- `tag-regulator` 在读取 `__zsTagVocabularyBridge` 时同时消费 staged API：
  - `loadPersistedStagedState`
  - `persistStagedEntries`
- staged fallback 与 `tag-manager` 同 pref key（`tagVocabularyStagedJson`）对齐。
- staged entry 写入 `createdAt/updatedAt/sourceFlow`，`sourceFlow=tag-regulator-suggest`。

### 4) Workflow Editor Host 合同扩展

- `open` 参数新增：
  - `actions[]`（自定义全局按钮）
  - `closeActionId`（窗口关闭默认 action）
- `open` 结果新增 `actionId`，并在非 save 的 action 关闭时返回序列化 state。
- 旧 Save/Cancel 路径行为保持不变。

## Risks / Trade-offs

- mock 测试直接劫持 host.open 时不会自然触发 closeActionId，需要在测试中显式提供 `actionId`。
- close=>stage-all 的强约束牺牲了“取消即不落库”语义，但可避免建议条目意外丢失。
