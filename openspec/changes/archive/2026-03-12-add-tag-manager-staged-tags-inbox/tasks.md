## 1. OpenSpec

- [x] 1.1 新建 `add-tag-manager-staged-tags-inbox` change 工件（proposal/design/tasks/.openspec.yaml）
- [x] 1.2 更新 `tag-vocabulary-management-workflow` delta，新增 staged 管理要求

## 2. Staged Persistence

- [x] 2.1 新增 staged pref key（`tagVocabularyStagedJson`）并更新 prefs typing/default
- [x] 2.2 在 `tag-manager` hook 中实现 staged 读写、移除、清空函数
- [x] 2.3 staged entry 增加基础元数据（`createdAt/updatedAt/sourceFlow`）

## 3. Tag Manager UI

- [x] 3.1 主窗口增加 `Staged Tags` 按钮并可打开 staged 管理窗口
- [x] 3.2 staged 窗口实现与正式页一致的表格布局（含搜索/筛选）
- [x] 3.3 staged 行级实现“加入受控词表”“拒绝/废弃”，全局实现“清空”
- [x] 3.4 动作语义为点击即生效，并保持失败诊断可见且不丢数据

## 4. Bridge & Validation

- [x] 4.1 扩展 `__zsTagVocabularyBridge` staged 方法集合
- [x] 4.2 “加入受控词表”复用正式校验与持久化链路

## 5. Tests & Verification

- [x] 5.1 新增 staged 持久化与隔离测试（含损坏 payload 容错）
- [x] 5.2 新增 staged UI 行为测试（按钮、加入、拒绝、清空）
- [x] 5.3 运行 `npm run test:node:workflow`
- [x] 5.4 运行 `npm run test:node:core`
- [x] 5.5 运行 `npx tsc --noEmit`
