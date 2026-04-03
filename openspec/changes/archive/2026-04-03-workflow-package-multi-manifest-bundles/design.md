## Overview

本次重构引入“包是扫描单元，workflow 是注册单元”的装载模型。

- 旧格式：目录下直接有 `workflow.json`
- 新格式：目录下有 `workflow-package.json`，其中列出多个子 workflow manifest

每个子 workflow 仍保持独立 `id`、manifest、README、settings 与 UI 呈现；包只提供更高层的文件组织与代码共享边界。

## Decisions

### 包形状

- 包根固定文件名：`workflow-package.json`
- 子 workflow 继续使用各自目录中的 `workflow.json`
- `workflow-package.json` 显式列出子 manifest 相对路径

### 路径语义

- `packageRootDir`：包根目录
- `rootDir`：子 workflow manifest 所在目录
- hook 路径相对 `rootDir` 解析
- 包内共享代码允许通过相对导入访问包根下其他文件

### 兼容与覆盖

- loader 同时兼容旧单 workflow 目录与新包目录
- registry / settings / menu / dashboard 仍按 `workflowId` 工作
- user override 仍按 `workflowId` 覆盖，不按整包覆盖

### 守护规则

- 允许同包内共享模块
- 禁止跨包导入其他 builtin workflow 代码
- 旧的“builtin workflow 必须完全目录自包含”规则改为“必须包边界自包含”

