## Why

Recent tag-vocabulary changes broke the workflow pluggability boundary in two ways:

- builtin workflows started depending on `workflows_builtin/shared/*`
- tag-vocabulary business logic leaked into plugin core via `src/modules/tagVocabularySyncBridge.ts`

That violated the workflow packaging rule and also made builtin workflow loading fragile under the loader fallback path.

## What Changes

- remove `workflows_builtin/shared/*`
- remove `src/modules/tagVocabularySyncBridge.ts`
- move tag-vocabulary business logic back into `tag-manager` and `tag-regulator`
- keep only a generic workflow runtime bridge in plugin core for toast/runtime-log capabilities
- add governance coverage so builtin workflows cannot depend on sibling workflow code or the removed tag-vocab bridge

## Impact

- restores builtin workflow pluggability and loader compatibility
- keeps existing tag-manager / tag-regulator business behavior intact
- narrows plugin core back to generic host/runtime responsibilities
