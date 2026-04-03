# Design

## Decision

本次是**行为冻结的包内重构**：

- 不新增 plugin core 抽象
- 不修改 package manifest / loader / registry 基础设施
- 不改变 workflow 的产品语义
- 只允许在**同一 workflow-package 内**共享代码

## Tag Vocabulary Package

`tag-vocabulary-package/lib/` 负责承载包内共享的领域实现：

- `model.js`
  - tag/staged entry 归一化
  - 远端 payload 归一化
  - facet / timestamp / tag prefix 纯函数
- `bindings.js`
  - `parentBindings` 归一化、合并、按 tag 收集
  - committed success 之后把 tag 追加到绑定父条目
- `state.js`
  - prefs key 解析
  - workflow settings 读取
  - local/subscription 模式判定
  - active committed key 解析
- `remote.js`
  - GitHub raw / contents URL
  - headers / base64 / fetch helpers
  - subscribe / publish 事务
- `runtime.js`
  - workflow runtime bridge 读取
  - 通用 toast / runtime log 写入

`tag-manager` 与 `tag-regulator` 保留各自的 UI、state machine 和 workflow 编排，但不再复制上述共享实现。

## Reference Workbench Package

`reference-workbench-package/lib/` 负责承载包内共享的 references note 领域实现：

- `htmlCodec.js`
  - HTML 转义
  - attribute 转义
  - base64 UTF-8 编解码
  - HTML entity 解码
  - tag attribute 读写
- `referencesNote.js`
  - references note kind 判定
  - generated note kind 判定
  - references payload 解析 / 更新
  - references note selection 过滤与解析
- `referenceModel.js`
  - references entry / authors 归一化
- `citekeyTemplate.js`
  - citekey template fallback / 校验
  - BBT-lite tokenization / AST / evaluation
  - predicted citekey 渲染

`reference-note-editor`、`reference-matching`、`literature-digest` 继续各自持有独特业务流程，但共享以上 codec / template / selection 实现。

## Governance

- 同包内可相对导入 `lib/**`
- 跨包导入仍禁止
- 不允许把 tag-vocabulary / references-note 领域逻辑重新抽到 `src/modules/**`
