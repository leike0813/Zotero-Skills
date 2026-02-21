## Why

当前 `tag-regulator` workflow 已能基于后端结果修改父条目标签（`remove_tags/add_tags`），但后端能力已升级：  
`suggest_tags` 由字符串数组升级为对象数组（`{ tag, note }`），并支持 `tag_note_language` 参数。  
插件侧 workflow 仍按旧协议消费，且语言参数声明未与 `literature-digest` 统一。  
这会导致两类问题：

- 建议标签的 `note` 信息在 UI 展示与词表落库中丢失，降低建议可解释性。
- 语言选项声明分散，不同 workflow 的语言参数能力不一致。

因此需要在现有闭环基础上，补齐对新 skill 协议的消费与语言声明统一。

## What Changes

- 将 `tag-regulator` 的 `suggest_tags` 消费从字符串数组升级为对象数组（`{tag, note}`）。
- 在建议标签确认对话框中同时展示 `tag` 与 `note`，并支持逐条选择加入受控词表。
- 写入受控词表时保留 `note` 字段，且新增条目 `source` 固定为 `agent-suggest`。
- 为 `tag-regulator` workflow 增加 `tag_note_language` 参数声明并透传到请求参数。
- 统一 `tag-regulator` 与 `literature-digest` 的语言选项声明列表（常见 BCP 47 值），默认 `zh-CN`。
- 保持父条目标签写入语义不变：`suggest_tags` 仍不直接写入父条目 tags。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `tag-regulator-workflow`: 将 `suggest_tags` 消费升级为 `{tag,note}`，并新增 `tag_note_language` 参数声明约束。
- `tag-vocabulary-management-workflow`: 补充来自 `tag-regulator` 的建议标签写入协同约束（`source=agent-suggest` 且保留 `note`）。
- `literature-digest-note-source-link`: 增补 `literature-digest` 语言参数声明与 `tag-regulator` 语言选项对齐约束。

## Impact

- 主要影响：`workflows/tag-regulator/hooks/applyResult.js` 与 `workflows/tag-regulator/hooks/buildRequest.js`。
- 声明影响：`workflows/tag-regulator/workflow.json`、`workflows/literature-digest/workflow.json` 的参数声明更新。
- 复用影响：继续复用 Tag Manager 词表持久化接口，补齐 `note` 写入语义。
- 测试影响：需补充 Node + Zotero 回归，覆盖 `suggest_tags` 对象结构、`note` 保留、`tag_note_language` 透传与语言选项一致性。
