# Refine ACP Chat Layout And Tool Rendering

## Summary

Refine the ACP sidebar chat UI after the streaming performance work. The goal is a cleaner conversation area, a composer that remains visible at all times, and much quieter tool activity rendering.

## Motivation

The current ACP sidebar still gives too much vertical space to low-frequency controls above the transcript. In narrow Zotero sidebars these controls wrap into several rows and push the conversation and composer out of view. Tool call messages also occupy too much space relative to their importance.

## Scope

- Move low-frequency actions into a header `More` menu.
- Render status details and diagnostics as overlay panels that do not participate in the main layout height.
- Keep header and composer fixed while the transcript scrolls independently.
- Move plain/bubble view controls into the composer footer.
- Compact tool rendering: one-line tools in plain mode and grouped tool activity bubbles in bubble mode.

## Non-Goals

- No ACP protocol changes.
- No OpenCode launch changes.
- No workflow integration changes.
- No session manager streaming throttle changes.
- No new persisted protocol state for tool group expansion.
