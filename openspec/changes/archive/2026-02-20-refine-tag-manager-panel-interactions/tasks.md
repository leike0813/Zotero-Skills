## 1. Facet-Only Filter and Popup Interaction

- [x] 1.1 先写测试：Filter 默认 8 个 facet 全勾选，初始展示全部条目
- [x] 1.2 实现 facet-only 过滤状态（`facetVisibility`）并去除 facet-value 过滤逻辑
- [x] 1.3 先写测试：取消勾选任一 facet 后实时过滤，无需 Apply
- [x] 1.4 实现过滤弹窗实时生效，并移除 `Clear/Apply/Delete` 按钮
- [x] 1.5 先写测试：点击弹窗外区域或再次点击 Filter 按钮可关闭弹窗
- [x] 1.6 实现点外关闭与按钮 toggle 关闭逻辑

## 2. Scroll Stability During Editing

- [x] 2.1 先写测试：滚动到下方后编辑输入不会重置到顶部
- [x] 2.2 实现 patchState 前后滚动位置记录与恢复

## 3. Column Behavior Refinement

- [x] 3.1 先写测试：列顺序调整为 `Facet | Tag | Source | Note | Deprecated | Delete`，且 Facet 列收窄并显示分隔符 `:`
- [x] 3.2 实现表头与行布局更新（Facet 前置并收窄）
- [x] 3.3 先写测试：Facet 为可用下拉，仅含 8 个允许值
- [x] 3.4 实现 facet 下拉交互并保持协议校验路径
- [x] 3.5 先写测试：Facet 切换后，tag 会实时重组为 `selectedFacet:suffix`
- [x] 3.6 实现 tag 后缀展示/编辑、facet 切换联动与完整 tag 序列化映射
- [x] 3.7 先写测试：Source 列不可编辑，且 Add 新建条目来源固定 `manual`
- [x] 3.8 实现 Source 列锁定与 Add 新建条目来源归一化

## 4. Import Area UX and Duplicate Selector Fix

- [x] 4.1 先写测试：导入相关控件与主操作按钮分区显示
- [x] 4.2 实现 Import 分组布局（`Import YAML`、`Dry Run`、`On Duplicate`）
- [x] 4.3 先写测试：文案显示为 `Dry Run` 与 `On Duplicate:`，下拉仅展示策略值（Skip/Overwrite/Error）
- [x] 4.4 实现文案修正与下拉显示样式
- [x] 4.5 先写测试：On Duplicate 下拉选择变化可稳定写入 state 并用于导入行为
- [x] 4.6 修复 On Duplicate 下拉交互异常

## 5. Verification

- [x] 5.1 运行 `npx tsx node_modules/mocha/bin/mocha "test/workflow-tag-manager/**/*.test.ts" --require test/setup/zotero-mock.ts`
- [x] 5.2 运行 `npx tsc --noEmit`
