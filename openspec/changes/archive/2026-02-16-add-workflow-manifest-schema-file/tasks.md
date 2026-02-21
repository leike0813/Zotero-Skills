## 1. Workflow Manifest Schema Artifact

- [x] 1.1 新增独立 workflow manifest schema 文件（SSOT）
- [x] 1.2 将最小必填字段与主要可选结构映射到 schema
- [x] 1.3 明确 legacy 字段限制（与当前 loader 拒绝规则一致）

## 2. Runtime Validation Integration

- [x] 2.1 在 loader manifest 解析入口接入 schema 校验器（AJV）
- [x] 2.2 将 schema 校验失败归一为现有 `manifest_validation_error` 诊断格式
- [x] 2.3 移除或收敛重复的手写形状校验，确保 schema 成为单一结构校验来源

## 3. Authoring Documentation

- [x] 3.1 在开发文档中新增“workflow.json 编写契约”入口并引用 schema 文件
- [x] 3.2 提供最小合法示例与常见可选字段示例
- [x] 3.3 明确 schema 既是作者契约也是运行时结构校验来源

## 4. Consistency Safeguards

- [x] 4.1 增加回归测试：核心 required 字段由 schema 在 loader 中生效
- [x] 4.2 增加回归测试：legacy 字段通过 schema 在 loader 中被拒绝
- [x] 4.3 运行类型检查与分组测试（至少 `core` 受影响域）
