# Design

## Snapshot Emission

`acpSessionManager` will treat snapshot delivery and persistence as separate effects:

- Critical state changes emit immediately and persist immediately.
- Streaming text/thought chunks mutate the in-memory snapshot, schedule a throttled UI emit, and schedule low-frequency persistence.
- Prompt completion and prompt error flush any pending UI/persist work before final state is delivered.
- High-frequency diagnostics, especially JSON-RPC trace entries, update the ring buffer without forcing immediate persistence.

Default timing:

- UI throttle: 80 ms.
- Streaming persistence throttle: 1500 ms.

## Sidebar Delivery

`acpSidebar` will coalesce `postSnapshot` calls per active sidebar host. Multiple snapshot notifications in a short interval collapse into one iframe `acp:snapshot` containing the newest view snapshot.

## Frontend Rendering

`acp-chat.js` will keep a map of transcript DOM nodes by `item.id`. Stable items are upserted instead of rebuilding the entire transcript. Streaming assistant/thought updates modify the existing text node. Full render remains the fallback for initialization, item order changes, and display mode changes.

Diagnostics rendering is conditional:

- Hidden diagnostics update button text and summary only.
- The diagnostics list is rebuilt only when the panel is visible.

## Layout

The sidebar uses a compact status summary row containing status, agent/session summary, error summary, and a details toggle. Detailed metadata and paths move into a collapsible panel. Mode/model selectors move into the composer footer, sharing the row with updated-at, cancel, and send controls.

`chatDisplayMode` and `statusExpanded` are UI-only state persisted in ACP conversation state. They do not affect the remote ACP session.
