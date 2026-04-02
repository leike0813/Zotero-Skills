# Tasks: tag-regulator-live-reconcile-for-controlled-and-staged-tags

- [x] Create OpenSpec change artifacts for live reconcile behavior
- [x] Update main `tag-regulator` spec and workflow README to document result-time reconciliation
- [x] Add a single live reconcile step in `workflows_builtin/tag-regulator/hooks/applyResult.js`
- [x] Merge stale-controlled suggestions into effective `add_tags`
- [x] Suppress stale-staged suggestions from dialog/reminders
- [x] Add explicit `reclassified_add_tags` and `reclassified_staged` result fields
- [x] Add runtime log for live reconcile counts
- [x] Update unit tests for dialog input and reclassification behavior
- [x] Add mock skill-runner integration coverage for repeated runs after controlled vocabulary changes
- [x] Run typecheck, targeted tests, and OpenSpec validation
