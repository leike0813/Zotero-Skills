## 1. OpenSpec and docs

- [x] 1.1 Add a change that records batched runtime-log prefs persistence
- [x] 1.2 Update testing/runtime governance docs with the new persistence semantics

## 2. Runtime log batching

- [x] 2.1 Add a batched persistence state machine to `runtimeLogManager`
- [x] 2.2 Add explicit flush-before-read / flush-before-shutdown behavior
- [x] 2.3 Expose minimal persistence state probes for tests

## 3. Validation

- [x] 3.1 Update runtime log manager tests for batched persistence semantics
- [x] 3.2 Run `npx tsc --noEmit`
- [x] 3.3 Run `npm run test:node:raw:core -- --grep "runtime log manager"`
- [x] 3.4 Run `openspec validate runtime-log-persistence-batching-hardening --strict`
