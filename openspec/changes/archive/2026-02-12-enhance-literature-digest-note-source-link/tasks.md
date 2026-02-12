## 1. OpenSpec 文档与契约固化

- [x] 1.1 完成 `proposal.md`，明确“写 itemKey 不写路径”的目标与边界
- [x] 1.2 完成 `design.md`，确认隐藏元数据块与降级语义
- [x] 1.3 完成 capability 规格：`literature-digest-note-source-link`

## 2. Digest Note 来源元数据实现（TDD）

- [x] 2.1 先编写测试：digest note 回写后包含隐藏来源元数据块
- [x] 2.2 先编写测试：来源字段值为输入 markdown 附件 `itemKey`
- [x] 2.3 修改 `workflows/literature-digest/hooks/applyResult.js` 注入隐藏元数据块

## 3. 降级语义与兼容性验证（TDD）

- [x] 3.1 先编写测试：无法解析 `itemKey` 时不中断 digest/references 回写
- [x] 3.2 回归测试：`digest-markdown` payload 结构保持不变
- [x] 3.3 回归测试：references note 生成逻辑不回归

## 4. 集成验证

- [x] 4.1 执行 `npm run build`
- [x] 4.2 执行 `npm run test:node:full`
