## 1. Tag Regulator Workflow Request Pipeline

- [x] 1.1 新增 `tag-regulator` workflow 清单与 hooks（含 `buildRequest`/`applyResult`），实现落在 `workflows/tag-regulator/**`
- [x] 1.2 在 `buildRequest` 收集父条目元数据、当前 tags、词表导出并物化 `valid_tags` 上传文件
- [x] 1.3 先写请求构建测试（payload 结构、上传文件键、metadata/input_tags 映射）
- [x] 1.4 增加解耦验收：不向 `src/**` 新增 tag-regulator 业务特化逻辑，仅复用通用 workflow 执行能力

## 2. Result Application and Safety Guards

- [x] 2.1 在 `applyResult` 校验输出结构并按 `remove_tags/add_tags` 更新父条目 tags
- [x] 2.2 对 `suggest_tags` 与 `warnings` 进行摘要输出，不直接写入 tags
- [x] 2.3 先写失败兜底测试（`error` 非空、返回结构异常、空变更）

## 3. End-to-End and Parity Validation

- [x] 3.1 补充 workflow 级回归：父条目输入 -> 请求提交 -> 返回应用
- [x] 3.2 验证与 tag-manager 导出接口联动（词表更新后下一次执行可见）
- [x] 3.3 运行类型检查与分组测试（至少 `core/ui/workflow` 受影响域）
