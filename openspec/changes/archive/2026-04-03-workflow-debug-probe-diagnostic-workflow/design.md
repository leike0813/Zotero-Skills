# Design

## Decisions

- Add a single debug-only builtin workflow: `workflow-debug-probe`
- Reuse the real preflight chain: selection context, execution context, provider resolution, build requests
- Render results in a read-only diagnostic panel and also write them to runtime logs
- Keep the workflow hidden outside hardcoded debug mode

## Implementation Notes

- `workflow.json` uses `debug_only: true`
- UI visibility is filtered centrally for menu, dashboard, and settings picker
- A core debug probe bridge is installed on startup and invoked by the builtin workflow hook
- Hook execution failures now retain structured `error.message`, `error.stack`, and hook metadata
