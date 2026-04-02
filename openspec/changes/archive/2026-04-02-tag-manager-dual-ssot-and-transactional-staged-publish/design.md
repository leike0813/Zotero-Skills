## Design

### Modes

- Local mode: GitHub 配置不完整，本地 committed vocab 为真源
- Subscription mode: GitHub 配置完整，远端 committed snapshot 为真源

### Persisted State

- `tagVocabularyLocalCommittedJson`: 本地模式 committed vocab
- `tagVocabularyRemoteCommittedJson`: 订阅模式最近一次成功订阅/发布后的 committed snapshot
- `tagVocabularyStagedJson`: staged inbox
- `tagVocabularyJson`: 当前模式下 active committed projection，供兼容读取

### Controlled Save

- Local mode: Save 立即提交到 local committed，并同步 projection
- Subscription mode: Save 先执行 GitHub publish
  - 成功：更新 remote committed snapshot 与 projection
  - 失败：不更新 committed snapshot，编辑器带失败状态重新打开

### Staged Promotion

- Local mode:
  - staged entry 立即进入 local committed
  - staged 立即移除
- Subscription mode:
  - staged entry 进入 pending batch
  - 1000ms debounce 聚合后执行单次 publish transaction
  - 成功：更新 remote committed snapshot/projection，并从 staged 移除
  - 失败：staged entry 保留，仅清除 pending/publishing 状态并提示失败

### Consumer Read Path

- `tag-regulator` / `Tag Manager` 受控词表页统一读取 active committed vocab
- active committed vocab 由当前模式解析：
  - local mode -> local committed
  - subscription mode -> remote committed snapshot
