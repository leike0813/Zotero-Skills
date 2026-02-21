## 1. Spec Alignment

- [x] 1.1 更新 `tag-regulator-workflow` 增量规格，明确 `suggest_tags` 的确认纳入流程
- [x] 1.2 明确与 Tag Manager 词表接口的协同约束（写入来源固定为 `agent-suggest`）

## 2. Result-Stage Interaction (TDD)

- [x] 2.1 先写测试：`suggest_tags` 为空时不弹窗、不触发词表写入
- [x] 2.2 先写测试：`suggest_tags` 非空时弹窗并支持逐条勾选
- [x] 2.3 实现 `tag-regulator` 结果阶段的 suggest-tags 确认对话框

## 3. Vocabulary Intake via Tag Manager Interface (TDD)

- [x] 3.1 先写测试：点击“加入受控词表”后仅写入已勾选条目
- [x] 3.2 先写测试：写入条目 `source` 固定为 `agent-suggest`
- [x] 3.3 先写测试：已存在标签幂等跳过（不重复插入）
- [x] 3.4 实现通过 Tag Manager 词表接口进行写入与结果汇总（added/skipped/invalid）

## 4. Regression and Safety

- [x] 4.1 先写测试：取消/关闭弹窗不会修改受控词表
- [x] 4.2 先写测试：格式非法建议标签不会写入且给出诊断
- [x] 4.3 确认 `suggest_tags` 仍不直接写入父条目 tags

## 5. Verification

- [x] 5.1 运行 `npx tsx node_modules/mocha/bin/mocha "test/workflow-tag-regulator/**/*.test.ts" --require test/setup/zotero-mock.ts`
- [x] 5.2 运行 `npm run test:zotero:workflow`
- [x] 5.3 运行 `npx tsc --noEmit`

## 6. Protocol Upgrade and Language Alignment (TDD)

- [x] 6.1 先写测试：`suggest_tags` 按 `{tag,note}` 对象数组消费，旧字符串数组不再作为主路径
- [x] 6.2 先写测试：建议标签对话框展示 `tag + note`，并仅写入用户选中的对象项
- [x] 6.3 先写测试：受控词表写入时保留 `note` 且 `source=agent-suggest`
- [x] 6.4 实现 `tag-regulator` `applyResult` 对新协议的解析与 intake 逻辑
- [x] 6.5 先写测试：`buildRequest` 透传 `parameter.tag_note_language`，默认 `zh-CN`
- [x] 6.6 实现 `tag-regulator` workflow 参数新增 `tag_note_language` 与请求透传
- [x] 6.7 先写测试：`literature-digest.language` 与 `tag-regulator.tag_note_language` 选项声明一致
- [x] 6.8 实现两个 workflow 语言参数声明统一（同一组选项，默认 `zh-CN`）
- [x] 6.9 运行 `npx tsx node_modules/mocha/bin/mocha "test/workflow-tag-regulator/**/*.test.ts" "test/workflow-literature-digest/**/*.test.ts" --require test/setup/zotero-mock.ts`
- [x] 6.10 运行 `npm run test:zotero:workflow`
- [x] 6.11 运行 `npx tsc --noEmit`
