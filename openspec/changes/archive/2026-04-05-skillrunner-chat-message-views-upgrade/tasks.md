## 1. Spec

- [x] 1.1 补 proposal / design / tasks
- [x] 1.2 更新 `task-dashboard-skillrunner-observe` delta spec
- [x] 1.3 新增 `skillrunner-chat-message-projection` delta spec

## 2. Message Semantics And Projection

- [x] 2.1 先更新 tests：run dialog host 消息 kind 与 dedupe 升级到 `assistant_message` / `replaces_message_id`
- [x] 2.2 更新 `skillRunnerRunDialog` 宿主侧 snapshot message payload，传递 `attempt` 与 correlation 字段
- [x] 2.3 重构 `chat_thinking_core.js` 为 canonical timeline + dual projection 模型

## 3. Run Dialog Frontend

- [x] 3.1 先更新 tests：run dialog UI 对齐到 view toggle、cache-busting、markdown/math vendor 接入
- [x] 3.2 更新 `run-dialog.js`，接入兼容 chat core 包装、plain/bubble 切换与 markdown 渲染
- [x] 3.3 更新 `run-dialog.html` / `run-dialog.css`，加入 view toggle、本地 vendor 资源和 dual-view 样式

## 4. Validation

- [x] 4.1 运行定向 mocha 测试覆盖 run dialog host / chat core / UI alignment
- [x] 4.2 运行 `openspec validate skillrunner-chat-message-views-upgrade --strict`
- [x] 4.3 运行 `npx tsc --noEmit`
