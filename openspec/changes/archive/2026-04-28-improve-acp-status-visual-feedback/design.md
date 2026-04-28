## Overview

The implementation derives visual state from existing ACP fields in `acp-chat.js` and applies CSS classes to existing DOM nodes. No data model changes are required.

## Rendering Design

- Connection status uses `statusToneClass(snapshot.status)` to update the `.acp-status-pill` class on each render.
- Plan entries use `planStatusToneClass(entry.status)` and `planStatusIcon(entry.status)` to render an icon plus the existing status text.
- Tool rows use `toolStatusToneClass(item.state)` to render a non-interactive LED before the tool summary.
- Tool activity drawers use `toolActivitySummaryState(items)` to derive a group LED state with failed > in_progress > pending > completed precedence.

## Styling Design

- Status pill tone classes use green, yellow, red, and neutral variants.
- Plan running states use a small spinner; terminal success uses a green check; pending uses a neutral circle.
- Tool state uses a small LED dot with pulse animation for running states.
- `prefers-reduced-motion: reduce` disables spinner and pulse animations.

## Compatibility

All behavior is derived from existing strings. Unknown states fall back to neutral styling and keep displaying their original text.
