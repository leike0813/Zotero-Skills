## 1. OpenSpec

- [x] 1.1 创建 `tag-manager-dual-ssot-and-transactional-staged-publish` change
- [x] 1.2 编写 proposal/design/tasks/spec 工件
- [x] 1.3 同步主 spec 与 Tag Manager 文档

## 2. Persistence Model

- [x] 2.1 为 Tag Manager 拆分 local committed / remote committed / active projection
- [x] 2.2 为旧的单一 `tagVocabularyJson` 增加兼容迁移与 active projection 语义

## 3. Tag Manager Runtime

- [x] 3.1 本地模式下 staged -> controlled 立即生效
- [x] 3.2 订阅模式下 staged -> controlled 改为事务化批次发布
- [x] 3.3 订阅模式下 Save 改为成功后才更新 committed snapshot
- [x] 3.4 返回 controlled 页时刷新当前模式的 committed 视图

## 4. Consumers

- [x] 4.1 `tag-regulator` 读取当前模式下的 active committed vocab
- [x] 4.2 保持 staged / pending 数据不进入运行时 valid tags

## 5. Tests

- [x] 5.1 覆盖本地模式 staged -> controlled 即时提交
- [x] 5.2 覆盖订阅模式 staged 批次发布成功/失败
- [x] 5.3 覆盖订阅失败时 remote cache fallback
- [x] 5.4 覆盖 `tag-regulator` 读取 active committed vocab
- [x] 5.5 运行类型检查与定向测试
