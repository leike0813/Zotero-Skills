# Design: upgrade-skillrunner-protocol-alignment-with-latest-backend

## Core Decisions

1. 严格采用新版协议，不保留旧 `uploads/<input_key>` 前端回退逻辑。
2. `upload_files` 语义固定为“本地文件列表 + input 字段键名映射”，zip entry 名以 `input.<key>` 的相对路径为真源。
3. 若 `upload_files` 为空，则跳过 `/upload` 步骤，支持 inline-only 请求。
4. literature-digest artifact 读取按 `result.data.*_path` 解析相对 entry，避免硬编码 `artifacts/`。

## Provider Contract

- `skillrunner.job.v1`：
  - `input` 继续允许任意 JSON；
  - `upload_files` 改为可选；
  - 当 `upload_files` 非空时：
    - `input` 必须为 object；
    - 每个 `upload_files[].key` 必须在 `input.<key>` 中有相对路径值；
    - 相对路径必须为 uploads 根相对路径（不带 `uploads/` 前缀、不可绝对路径、不可 `..`）。

## Declarative Compiler

- 继续使用 `request.input.upload.files[]` 声明 selector。
- 编译时自动生成 `input.<key>=inputs/<key>/<basename>`。
- `upload_files[]` 继续保留 `{ key, path }`，其中 `key` 作为 input field key，不再等价于 zip entry。

## Workflow Adaptation

- `tag-regulator` buildRequest 显式写入 `input.valid_tags` 相对路径，并与 `upload_files.key=valid_tags` 映射一致。
- `literature-digest` applyResult 按输出路径解析 bundle entry（支持绝对路径裁剪为 bundle 内相对路径）。

## Mock/Test Baseline

- mock create 校验新增 file-input 字段要求（按 skill）。
- mock upload 校验 zip body 包含 create 声明的目标相对路径。
- 测试断言统一迁移到 `input.<field>` + upload 映射新语义。
