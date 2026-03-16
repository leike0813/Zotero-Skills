# Change Proposal: upgrade-skillrunner-protocol-alignment-with-latest-backend

## Why

`reference/Skill-Runner` 已升级到新版 mixed-input 与 bundle 协议。当前插件前端仍保留旧的文件输入/上传映射假设，导致以下风险：

- create body 未稳定声明 file-input 的 `input.<field>` 相对路径；
- upload zip entry 仍依赖旧 key 语义；
- literature-digest 对 bundle 产物路径仍有硬编码前缀假设；
- mock/测试基线仍覆盖旧协议路径，无法阻止回归。

## What Changes

- 对齐 `skillrunner.job.v1` 请求与上传协议到新版（严格新协议）。
- 升级 `literature-digest` 与 `tag-regulator` 两条 workflow 的 file-input 构建与消费。
- 升级 mock server 与核心/workflow 测试断言到新协议。
- 同步文档（providers/workflows）说明 file-input 新语义。

## Impact

- SkillRunner file-input 执行链将只接受新版 `input` 相对路径声明 + upload 映射一致性。
- inline-only skill 允许不走 upload 步骤。
- literature-digest 在读取 artifact 时不再依赖 `artifacts/` 固定前缀。
