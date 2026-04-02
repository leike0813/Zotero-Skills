# tag-manager-controlled-vocab-subscribe-publish Design

## Overview

本次把 `Tag Manager` 定位为：

- `pass-through + configurable` workflow
- 词表运行时唯一真源仍是本地 `tagVocabularyJson`
- GitHub 远端只负责“打开时订阅、保存后发布”

## Decisions

### 1. Settings Model

`Tag Manager` 使用 workflow settings 持久化以下参数：

- `github_owner`
- `github_repo`
- `file_path`
- `github_token`

默认值：

- `github_repo = Zotero_TagVocab`
- `file_path = tags/tags.json`
- 分支固定为 `main`

### 2. Subscribe Contract

打开 Tag Manager 时：

1. 读取本地词表
2. 读取 workflow settings
3. 若 GitHub 配置完整，则先请求：
   `https://raw.githubusercontent.com/{owner}/{repo}/main/{file_path}`
4. 若订阅成功：
   - 用远端 `tags[]` 覆盖编辑器初始 entries
   - 在编辑器顶部显示订阅成功状态
5. 若订阅失败：
   - 编辑器继续使用本地词表
   - 顶部显示失败状态
   - 写 runtime log

### 3. Publish Contract

用户点击 Save 后：

1. 先把编辑器结果写入本地 `tagVocabularyJson`
2. 若 GitHub 配置完整，则执行：
   - `GET https://api.github.com/repos/{owner}/{repo}/contents/{file_path}`
   - 取 `sha` 与 `content`
   - 解析远端 JSON
   - 用本地 `entries` 替换 `tags`
   - 保留远端 `abbrevs`
   - 更新 `updated_at` / `tag_count` / `facets`
   - `PUT` 新内容
3. 若 `PUT` 返回 `409`：
   - 重新 `GET`
   - 以最新远端元信息 + 当前本地 tags 重组 payload
   - 单次重试
4. 若发布失败：
   - 不回滚本地保存
   - 写 runtime log
   - 给用户明确提示“本地已保存，但远端发布失败”

### 4. Bridge Contract

为了避免 workflow hook 直接依赖 TS 模块，宿主侧暴露一个最小 bridge：

- `appendRuntimeLog`
- `showToast`

workflow settings 仍以 `workflowSettingsJson` 为唯一持久源，hook 读取该 prefs
快照，不额外引入第二套持久化。

### 5. Remote Payload Mapping

本地到远端：

- `entries[] -> tags[]`
- `facets`：保留最新远端 facets，并补齐当前 tags 中实际出现的 facet
- `tag_count = tags.length`
- `updated_at = now`
- `abbrevs`：保留远端原值并原样写回

远端到本地：

- 只消费 `tags[]`
- `abbrevs` 只缓存于本次远端读写流程，不进入当前 Tag Manager 编辑 UI

## Failure Handling

- GitHub 配置不完整：视为“未配置远端同步”，本地模式正常运行
- 订阅失败：不阻断编辑
- 发布失败：不回滚本地保存，但必须提示
- runtime log 不记录 `github_token` 明文
