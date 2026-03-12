## 1. Provider 协议升级

- [x] 1.1 调整 `SkillRunnerJobRequestV1`：`upload_files` 改为可选
- [x] 1.2 调整请求合同校验：当 `upload_files` 非空时强制校验 `input.<key>` 文件路径映射
- [x] 1.3 调整 skillrunner client：zip entry 按 `input.<key>` 路径映射，支持 upload 步骤可选

## 2. Workflow 对齐

- [x] 2.1 声明式编译器自动生成 `input.<key>` 相对路径（`selected.source` 等 selector 保持唯一命中）
- [x] 2.2 `tag-regulator` buildRequest 增加 `input.valid_tags` 映射
- [x] 2.3 `literature-digest` applyResult 改为按 `result.data.*_path` 解析 bundle entry

## 3. Mock 与测试基线

- [x] 3.1 升级 mock create/upload 校验到新协议
- [x] 3.2 更新 core/workflow/ui 相关断言（`source_path` + input 路径映射）
- [x] 3.3 补充 inline-only（无 upload）执行链回归测试

## 4. 文档同步

- [x] 4.1 更新 `doc/components/workflows.md` 的 skillrunner file-input 语义
- [x] 4.2 更新 `doc/components/providers.md` 的 mixed-input/upload 映射语义
