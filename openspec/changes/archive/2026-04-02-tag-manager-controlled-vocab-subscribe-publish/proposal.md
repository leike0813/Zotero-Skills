# tag-manager-controlled-vocab-subscribe-publish Proposal

## Why

`Tag Manager` 目前只支持本地受控词表编辑。用户已经确定需要把它扩展为
“本地编辑 + 远端 GitHub 订阅/发布”的工作流，但仍保持本地词表作为运行时
唯一输入源。

当前缺口：

- 无法从 `reference/Zotero_TagVocab` 风格远端真源自动订阅词表
- 无法在本地保存后自动回写 GitHub Contents API
- `Tag Manager` 还没有 workflow settings 参数来持久化 GitHub 语义字段
- 远端同步失败缺少统一的可观测性与用户反馈

## What Changes

- 为 `Tag Manager` 新增 workflow 参数：
  - `github_owner`
  - `github_repo`
  - `file_path`
  - `github_token`
- 打开 Tag Manager 编辑器时自动尝试订阅远端 `tags/tags.json`
- 本地保存成功后自动尝试发布到 GitHub Contents API
- 远端同步失败时：
  - 不破坏本地词表
  - 写 runtime log
  - 给出明确反馈
- 为这条链路补充测试与文档合同

## Impact

- 影响范围：
  - `workflows_builtin/tag-manager`
  - workflow settings 持久化/表单描述路径
  - runtime log / 用户反馈桥接
  - Tag Manager 相关测试
- 不影响：
  - `tag-regulator` 对本地 `tagVocabularyJson` 的消费方式
  - staged inbox 语义
  - 其它 workflow 的 provider 协议
