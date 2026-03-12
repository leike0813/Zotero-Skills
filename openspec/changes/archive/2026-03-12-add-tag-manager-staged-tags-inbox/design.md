## Context

`tag-manager` 当前仅有正式词表编辑页。为了支撑“先审阅、后入库”的流程，需要在 workflow 侧引入独立暂存区，并保持与现有 bridge/校验体系一致。

## Goals / Non-Goals

**Goals**

- 新增 staged 持久化（独立 pref key）与最小审计元数据。
- 新增 staged 管理窗口，布局与正式词表页保持一致。
- 支持行级“加入受控词表/拒绝”与全局“清空”，并采用“点击即生效”语义。
- 正式入库时复用既有 `collectValidationIssues + persistEntries`，确保协议一致。

**Non-Goals**

- 不修改 Tag Regulator 的 suggest_tags 写入路径。
- 不改变正式词表既有导入/导出/校验语义。

## Architecture

### 1) Staged 持久化与模型

- 新增 pref key：`tagVocabularyStagedJson`。
- staged payload：`{ version: 1, entries: [...] }`。
- staged entry 在正式 5 字段基础上新增：
  - `createdAt`（ISO 时间戳）
  - `updatedAt`（ISO 时间戳）
  - `sourceFlow`（默认 `manual-staged`）
- staged 持久化允许中间编辑态；不执行全量严格校验。

### 2) 主窗口与暂存窗口

- 主窗口 toolbar 增加 `Staged Tags` 按钮。
- 点击后打开独立 staged renderer：
  - 使用与正式页一致的表格列布局与筛选/搜索交互。
  - 每行新增：
    - `加入受控词表`
    - `拒绝/废弃`
  - 顶部新增 `清空`（带确认）。
- 即时动作（加入/拒绝/清空）执行后立即持久化 staged（与正式词表写入联动）。

### 3) 正式入库校验路径

- “加入受控词表”时：
  - 读取正式词表当前状态。
  - 将候选 staged 条目与正式词表合并后执行 `collectValidationIssues`。
  - 校验通过则 `persistEntries`，并从 staged 移除。
  - 校验失败则不写正式词表，staged 保留，返回稳定错误消息。

### 4) Bridge 扩展

- `__zsTagVocabularyBridge` 保留现有方法。
- 新增 staged 方法：
  - `loadPersistedStagedState`
  - `persistStagedEntries`
  - `removeStagedEntriesByTags`
  - `clearPersistedStagedEntries`

## Risks / Trade-offs

- staged 与正式词表分离会增加一个新 pref 维护面；收益是隔离风险更低。
- 即时动作可能与“窗口 Save”并存；通过“即时动作直接落库 + Save 仅提交编辑态”保证行为可预测。
