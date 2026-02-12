## 1. Provider 合同与注册（TDD）

- [x] 1.1 新增 `pass-through.run.v1` request 合同
- [x] 1.2 新增 `pass-through` provider 实现
- [x] 1.3 在 provider registry 完成注册与解析测试

## 2. Workflow 运行时兼容（TDD）

- [x] 2.1 增加 `provider=pass-through` 的最小声明兼容测试（无 request / 无 buildRequest）
- [x] 2.2 实现 runtime 的 pass-through 本地执行上下文分支
- [x] 2.3 实现 declarative compiler 对 `pass-through.run.v1` 的请求补全

## 3. 结果注入语义（TDD）

- [x] 3.1 编写测试：`runResult.resultJson` 必含完整 `selectionContext`
- [x] 3.2 编写测试：`request kind` 固定为 `pass-through.run.v1`
- [x] 3.3 实现并验证 `selectionContext` 与 `parameter` 注入

## 4. 集成验证与文档

- [x] 4.1 新增端到端测试：pass-through workflow 可执行并进入 `applyResult`
- [x] 4.2 执行 `npm run build` 与 `npm run test:node:full`
- [x] 4.3 更新组件文档（provider 行为、runtime 兼容规则、失败语义）
