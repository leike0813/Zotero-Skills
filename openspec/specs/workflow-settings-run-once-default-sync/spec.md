# workflow-settings-run-once-default-sync Specification

## Purpose
TBD - created by archiving change refactor-workflow-settings-per-workflow-pages. Update Purpose after archive.
## Requirements
### Requirement: Run Once defaults MUST be initialized from persisted settings on every page open
在某个 workflow 的设置页面中，Run Once 区域的默认值 MUST 在每次页面打开时由该 workflow 当前已保存的 Persistent 设置初始化，不得保留上一次打开页面时的 Run Once 输入快照。

#### Scenario: Run Once defaults mirror current persisted values when opening page
- **WHEN** 用户打开某个 workflow 的设置页面
- **THEN** Run Once 的 profile、workflow 参数、provider 选项 MUST 默认等于当前 Persistent 设置

#### Scenario: Run Once defaults refresh after persistent settings change
- **WHEN** 用户先保存新的 Persistent 设置并关闭页面
- **AND** 再次打开同一 workflow 的设置页面
- **THEN** Run Once 默认值 MUST 反映最新 Persistent 设置

### Requirement: No extra toggle is required for Run Once default sync behavior
系统 MUST 将“Run Once 每次打开默认与 Persistent 一致”作为固定默认行为，不新增独立配置开关。

#### Scenario: User cannot disable default-sync behavior via settings option
- **WHEN** 用户查看 workflow 设置页面
- **THEN** 页面 MUST NOT 提供“Run Once 是否跟随 Persistent”的单独开关

