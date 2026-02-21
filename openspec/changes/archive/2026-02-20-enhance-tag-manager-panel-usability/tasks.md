## 1. Table UX and Read-only Facet

- [x] 1.1 先写测试：tag-manager 行渲染包含明确表头，且滚动时表头保持可见
- [x] 1.2 实现列表容器的表格化结构与 sticky header 样式
- [x] 1.3 先写测试：facet 列为只读展示，UI 不再提供 facet 下拉修改控件
- [x] 1.4 实现 facet 列只读化并保持现有 facet/tag 一致性校验路径

## 2. Export and Search Focus Reliability

- [x] 2.1 先写测试：点击 Export 后出现可见的导出文本，且内容为稳定排序 `facet:value`
- [x] 2.2 先写测试：导出结果区支持直接复制，且内容与可见文本一致
- [x] 2.3 实现导出结果可视区（只读）与复制动作（含能力不可用时确定性提示）
- [x] 2.4 先写测试：搜索框连续输入时焦点不丢失（无需重复点击）
- [x] 2.5 实现重绘后的搜索焦点/光标恢复机制

## 3. Popup Facet Filters

- [x] 3.1 先写测试：点击 Filter 按钮会打开内部子窗体，且含各 facet 的多选分组
- [x] 3.2 实现弹出式 facet 过滤子窗体（Apply/Clear/Close）
- [x] 3.3 先写测试：每个 facet 的过滤选项来源于当前 entries 的动态值集合
- [x] 3.4 实现 8 facet 的动态选项计算与状态同步
- [x] 3.5 先写测试：多 facet 组合筛选与全文搜索联合作用且结果确定
- [x] 3.6 实现组合过滤谓词（facet 内并集、facet 间交集）并接入列表渲染

## 4. Verification

- [x] 4.1 运行受影响测试：`npx tsx node_modules/mocha/bin/mocha "test/workflow-tag-manager/**/*.test.ts" --require test/setup/zotero-mock.ts`
- [x] 4.2 运行 `npx tsc --noEmit`
