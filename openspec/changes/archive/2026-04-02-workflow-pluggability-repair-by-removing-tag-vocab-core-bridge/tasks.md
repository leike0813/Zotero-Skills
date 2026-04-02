## 1. Runtime bridge

- [x] Add a generic workflow runtime bridge for toast/runtime-log only
- [x] Remove the tag-vocabulary-specific core bridge and startup wiring

## 2. Workflow repair

- [x] Remove `workflows_builtin/shared/*`
- [x] Localize staged-binding helpers inside `tag-manager`
- [x] Localize staged-binding and publish helpers inside `tag-regulator`
- [x] Remove `tag-regulator` dependence on `tag-manager` bridge semantics

## 3. Regression coverage

- [x] Update tag-manager/tag-regulator tests to use the generic runtime bridge
- [x] Add governance coverage blocking sibling workflow imports and the removed core bridge
- [x] Run type-check and targeted workflow regression tests
