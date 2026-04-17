## 1. Runner Transport Hardening

- [x] 1.1 Rework the generated runner patch so progress events use a non-blocking
      queued transport while `fail`, `end`, and `debug` remain blocking
- [x] 1.2 Keep the existing `/update` protocol and single-event payload shape
      unchanged

## 2. GUI-Thread Load Reduction

- [x] 2.1 Remove default `console.log` calls that emit full `suite` / `test` /
      `error` objects
- [x] 2.2 Replace `innerText += ...` page output with append-only text-node
      rendering

## 3. Diagnostics Preservation

- [x] 3.1 Preserve fail-detail debug payload emission for failed tests
- [x] 3.2 Keep `window.onerror` / `window.onunhandledrejection` bridging intact
- [x] 3.3 Allow project-level failure-context debug emission to await the runner
      debug bridge

## 4. Verification and Recording

- [x] 4.1 Extend the Node patch-helper regression tests for the new runner
      contract
- [x] 4.2 Add OpenSpec artifacts for this change and a dedicated performance
      contract delta spec
- [x] 4.3 Run targeted Node regression, typecheck, Zotero smoke, and OpenSpec
      validation
