## 1. Spec Alignment

- [x] 1.1 更新 `workflow-manifest-authoring-schema` 增量规格，定义 `allowCustom` 合同语义
- [x] 1.2 更新 `workflow-settings-domain-decoupling` 增量规格，定义 `allowCustom=true` 的枚举放宽规则
- [x] 1.3 更新 `workflow-settings-dialog-model-split` 增量规格，定义“下拉推荐 + 可编辑输入”渲染语义

## 2. Contract and Validation (TDD)

- [x] 2.1 先写测试：workflow manifest 支持 `parameters.<key>.allowCustom`（布尔）
- [x] 2.2 先写测试：`allowCustom` 非布尔时 schema 校验失败
- [x] 2.3 实现类型与 schema 合同更新（`types.ts` + `workflow.schema.json`）

## 3. Domain Normalization (TDD)

- [x] 3.1 先写测试：`enum + allowCustom=true` 时保留非枚举字符串输入
- [x] 3.2 先写测试：`enum + allowCustom=false` 时继续执行枚举硬限制回退
- [x] 3.3 实现 `normalizeWorkflowParamsBySchema` 的分支归一化逻辑

## 4. Settings Dialog Model/UI (TDD)

- [x] 4.1 先写测试：渲染模型暴露 `allowCustom` 并正确标记可编辑枚举参数
- [x] 4.2 先写测试：组合控件序列化时以输入框值为最终值
- [x] 4.3 实现设置页组合控件（推荐下拉 + 可编辑输入）与事件联动

## 5. Documentation and Verification

- [x] 5.1 更新 workflow 参数合同文档，说明 `allowCustom` 与 `enum` 的关系
- [x] 5.2 运行 `npx tsx node_modules/mocha/bin/mocha "test/core/20-workflow-loader-validation.test.ts" "test/core/49-workflow-settings-domain.test.ts" "test/ui/50-workflow-settings-dialog-model.test.ts" --require test/setup/zotero-mock.ts`
- [x] 5.3 运行 `npx tsc --noEmit`
