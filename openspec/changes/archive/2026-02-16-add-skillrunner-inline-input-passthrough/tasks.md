## 1. Request Contract Alignment

- [x] 1.1 扩展 `SkillRunnerJobRequestV1` 类型，支持可选 `input`
- [x] 1.2 更新 request contract 测试，覆盖 `input` 可选且不影响现有必填约束
- [x] 1.3 先写失败用例与兼容用例，再实现契约修改（TDD）

## 2. Provider and Client Passthrough

- [x] 2.1 更新 skillrunner provider 请求分发路径，接受并传递 `input`
- [x] 2.2 更新 skillrunner client 创建 `/v1/jobs` 请求体，透传 `input + parameter`
- [x] 2.3 增加客户端层测试，断言后端接收 body 含 inline `input`

## 3. Regression and Validation

- [x] 3.1 增加回归测试：旧 workflow（无 `input`）执行行为不变
- [x] 3.2 增加回归测试：新 workflow（有 `input`）字段完整到达后端
- [x] 3.3 运行类型检查与分组测试（至少 `core/workflow` 受影响域）

## 4. Workflow Schema Description Alignment

- [x] 4.1 在本 change 的 artifacts 中补充 workflow schema 与 mixed-input 声明边界说明
- [x] 4.2 在 `workflow-manifest-authoring-schema` delta spec 中补充 `request.input` mixed-input 场景描述
