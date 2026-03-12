## Why

当前 `tag-manager` 仅管理正式受控词表，缺少“待确认标签”的缓冲区。用户在审阅建议标签前无法进行二次编辑与批量处置，导致确认流程不完整。

## What Changes

- 为 `tag-manager` 新增暂存标签（staged tags）持久化与管理窗口。
- 暂存区与正式词表使用独立 pref key 持久化，避免相互污染。
- 在 `tag-manager` 主窗口新增 `Staged Tags` 按钮，打开暂存管理窗口。
- 暂存窗口支持行级“加入受控词表”“拒绝/废弃”与全局“清空”。
- “加入受控词表”执行正式校验；失败时保留条目在暂存区并给出诊断。

## Capabilities

### Modified Capabilities

- `tag-vocabulary-management-workflow`

## Impact

- `workflows/tag-manager/hooks/applyResult.js`：新增 staged 领域逻辑与 UI。
- `src/utils/prefs.ts`、`typings/prefs.d.ts`、`addon/prefs.js`：新增 staged pref 键。
- `test/workflow-tag-manager/**/*.test.ts`：新增 staged 流程与回归测试。
