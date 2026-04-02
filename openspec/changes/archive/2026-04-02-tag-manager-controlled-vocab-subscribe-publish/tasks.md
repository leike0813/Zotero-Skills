## 1. OpenSpec

- [x] 1.1 创建 `tag-manager-controlled-vocab-subscribe-publish` change
- [x] 1.2 编写 proposal/design/tasks/spec 工件
- [x] 1.3 同步主 spec 与 workflow settings 相关文档

## 2. Workflow Settings

- [x] 2.1 将 `workflows_builtin/tag-manager/workflow.json` 改为带 GitHub 参数的 configurable workflow
- [x] 2.2 保持 `pass-through` provider 语义不变

## 3. Host Bridge

- [x] 3.1 新增 Tag Manager sync bridge，暴露 runtime log / toast 能力
- [x] 3.2 在 startup 时安装 bridge

## 4. Tag Manager Hook

- [x] 4.1 打开编辑器前自动订阅远端词表
- [x] 4.2 在编辑器顶部显示同步状态
- [x] 4.3 保存后自动发布到 GitHub Contents API
- [x] 4.4 实现 409 冲突单次重试
- [x] 4.5 发布失败时提示“本地已保存，但远端发布失败”

## 5. Tests

- [x] 5.1 新增/更新 Tag Manager 订阅测试
- [x] 5.2 新增/更新 Tag Manager 发布测试
- [x] 5.3 覆盖本地保存成功但远端发布失败
- [x] 5.4 覆盖 workflow settings 参数持久化/恢复
- [x] 5.5 运行类型检查与定向测试
