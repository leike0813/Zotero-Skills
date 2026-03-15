## ADDED Requirements

### Requirement: Main-window toolbar MUST provide execute-workflow menu shortcut
系统 MUST 在 Zotero 主窗口工具栏提供 `Execute Workflow` 图标菜单按钮。

#### Scenario: inject toolbar execute-workflow button with anchored placement
- **WHEN** 主窗口加载并注入插件工具栏按钮
- **THEN** 系统 MUST 注入 `Execute Workflow` 图标菜单按钮
- **AND** 若存在 `zotero-tb-note-add`，该按钮 MUST 插入在其右侧
- **AND** Dashboard 图标按钮 MUST 继续位于搜索锚点前
- **AND** 卸载/窗口关闭时 MUST 清理两个按钮

### Requirement: Execute-workflow toolbar menu MUST reuse workflow trigger semantics
系统 MUST 复用右键 workflow 触发区的 workflow 可执行判定、禁用原因文案和执行命令行为。

#### Scenario: build toolbar execute-workflow popup
- **WHEN** 用户展开工具栏 `Execute Workflow` 菜单
- **THEN** 菜单项 MUST 与右键 workflow 触发区使用同源 workflow 判定逻辑
- **AND** 菜单 MUST NOT 包含 `Open Dashboard...` 等非 workflow 入口
- **AND** 无 workflow 时 MUST 显示禁用空态项
