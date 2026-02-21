## Why

目前 workflow 清单（`workflow.json`）的校验规则主要写在代码中，用户需要阅读 `loaderContracts.ts` 才能理解声明约束。  
这会提高 workflow 作者的理解门槛，也不利于外部协作与快速自检。

本 change 的目标是将 workflow schema 文件抽出并接入运行时校验链路，  
让该文件成为 workflow 声明规范的唯一真相源（SSOT）。

## What Changes

- 新增对外可读的 workflow manifest schema 文件（JSON Schema）。
- 将 schema 覆盖当前主要声明约束（必填字段、类型、关键结构、已弃用字段限制）。
- 在 loader 的 manifest 校验入口改为基于该 schema 执行统一验证（替代分散的形状判断逻辑）。
- 补充文档入口，明确用户如何按 schema 编写 workflow.json。
- 增加回归用例，确保运行时 manifest 校验使用 schema 并保持兼容语义。

## Capabilities

### New Capabilities

- `workflow-manifest-authoring-schema`: 提供面向 workflow 作者与运行时共同使用的 manifest schema 契约（SSOT）。

### Modified Capabilities

- None.

## Impact

- 改善 workflow 作者体验与可理解性，降低“读源码才能写清单”的门槛。
- 统一 workflow 声明校验来源，降低规则分叉与漂移风险。
- 对 loader 的 manifest 校验实现有改动，但业务执行语义保持不变。
