## ADDED Requirements

### Requirement: Run Dialog chat viewport MUST preserve manual scroll position
系统 MUST 在 Run Dialog 聊天区中仅在用户位于底部附近时自动跟随新消息，避免阅读旧消息时被强制跳转。

#### Scenario: auto-follow only near bottom
- **WHEN** 新 snapshot 到达且聊天区已有滚动位置
- **THEN** 若用户位于底部附近，系统 MUST 自动滚动到底部
- **AND** 若用户不在底部附近，系统 MUST 保持当前滚动位置不变

