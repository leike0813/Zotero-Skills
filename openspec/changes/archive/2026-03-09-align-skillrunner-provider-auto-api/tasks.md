## 1. OpenSpec Artifacts

- [x] 1.1 新建 change 工件：`proposal.md`、`design.md`、`tasks.md`、`.openspec.yaml`
- [x] 1.2 新增 `provider-adapter` delta spec，明确 Auto-only 与终态语义

## 2. Provider Auto Execution Alignment

- [x] 2.1 更新 skillrunner 轮询终态识别：`canceled` 立即失败
- [x] 2.2 增强失败错误信息，包含 request_id 与终态 status
- [x] 2.3 保持既有 `/v1/jobs*` 执行链路不变

## 3. Request Contract and Types

- [x] 3.1 放宽 `SkillRunnerJobRequestV1.input` 类型为任意 JSON
- [x] 3.2 更新 provider request contract，允许 `input` 为 string/array/object
- [x] 3.3 更新对应单元测试，覆盖放宽后的合法输入样例

## 4. Verification and Docs

- [x] 4.1 增加/更新轮询状态机测试（`succeeded`/`failed`/`canceled`）
- [x] 4.2 mock server 增加 `canceled` 路径覆盖并补充回归测试
- [x] 4.3 更新 provider 文档，标记当前 Auto-only 语义与 deferred 范围
- [x] 4.4 运行验证：`npm run test:node:core`、`npm run test:node:workflow`、`npx tsc --noEmit`
