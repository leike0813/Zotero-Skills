## Why

`plan-m3-to-m4-roadmap` 当前仍以“未来周计划”叙述为主，已与项目实际交付状态明显不一致。  
为避免治理文档失真，需要将该 change 回写为“已交付里程碑基线”，并提供可审计的变更追溯。

## What Changes

- 移除旧版周计划与未完成任务导向叙述，改为已交付能力基线。
- 固定 4 项核心里程碑（必须项）：
  - SkillRunner `interactive` 执行模式与交互态收敛  
    (archive: `2026-03-12-align-skillrunner-workflow-mode-and-model-cache-refresh`, `2026-03-12-make-skillrunner-backend-state-ssot`, `2026-03-12-fix-interactive-run-dialog-state-sync-and-note-apply`)
  - 统一 Dashboard 与运行详情对话窗口（单例 workspace/统一入口）  
    (archive: `2026-03-14-skillrunner-provider-global-run-workspace-tabs`, `2026-03-09-reset-task-manager-to-dashboard`)
  - 一键部署本地 SkillRunner 后端（状态机 SSOT + 交互增强）  
    (archive: `2026-03-13-add-skillrunner-oneclick-local-deploy`, `2026-03-14-skillrunner-oneclick-state-machine-ssot`, `2026-03-14-skillrunner-local-runtime-deploy-uninstall-interactive`)
  - 新增 `literature-explainer` workflow  
    (archive: `2026-03-12-add-literature-explainer-workflow`)
- 追加 3 组核心补充里程碑：
  - Workflow 设置单源化与网页化  
    (archive: `2026-03-14-workflow-settings-single-source-web-config`)
  - Dashboard 运行任务可交互跳转与导航收敛  
    (archive: `2026-03-09-refine-dashboard-navigation-and-generic-http-log-ux`, `2026-03-14-skillrunner-provider-global-run-workspace-tabs`)
  - 本地后端 UI / i18n 治理收敛  
    (archive: `2026-03-14-skillrunner-oneclick-ui-adjustments`, `2026-03-14-localization-governance-ssot`, `2026-03-15-skillrunner-local-runtime-i18n-action-messages-and-locale-expansion`)

## Capabilities

### Modified Capabilities

- `m3-m4-roadmap-planning`: 语义从“周计划编排”更新为“已交付里程碑基线与追溯治理”。

## Impact

- 仅更新 OpenSpec 治理文档（proposal/design/spec/tasks）语义与验收口径。
- 不修改运行时代码、事件、数据结构或 API。
