## Why

`Tag Manager` 当前把本地受控词表、远端订阅结果、暂存区提升动作都压在
同一个 `tagVocabularyJson` 上，导致以下问题：

- 暂存区“加入受控词表”不会触发远端发布
- 从暂存区返回受控词表页时不会刷新 committed 视图
- 远端订阅成功后会覆盖未成功发布的本地暂存提升结果，形成假成功

## What Changes

- 为 `Tag Manager` 引入本地模式 / 订阅模式双 SSOT
- 将订阅模式下的 staged -> controlled 改为事务化批次发布
- 订阅模式下仅远端 committed snapshot 可进入 controlled vocab
- 远端发布失败时，批次词条保留在 staged，不进入 committed vocab
- `tag-regulator` 等消费者改为读取当前模式下的 active committed vocab

## Impact

- `Tag Manager` 在订阅模式下的行为会从“本地先写、远端补发”改为“远端提交成功后再进入 committed”
- 暂存区加入受控词表的交互会增加 pending/publishing 状态
- `tagVocabularyJson` 从唯一真源降级为 active committed projection / compatibility mirror
