# Design

## Layout

The ACP page remains a full-height shell. Header and composer are fixed layout rows, while the transcript is the only main scroll region. Status details and diagnostics become absolute overlay panels below the header, with their own max height and internal scroll.

The header contains title, compact status summary, and a single `More` button. All low-frequency actions live in the menu: new conversation, reconnect, details, authenticate, diagnostics, copy diagnostics, and close.

## Composer Controls

The composer footer hosts mode/model selectors, plain/bubble view toggle, updated timestamp, cancel, and send. This keeps view controls with message composition instead of occupying conversation space.

## Tool Rendering

The raw `snapshot.items` model is unchanged. `acp-chat.js` derives render entries:

- `plain` mode keeps original order and renders each `tool_call` as one compact line.
- `bubble` mode groups adjacent `tool_call` items into a single `tool_group` render entry.
- Tool groups default collapsed and expand on click. Expansion state is local memory only.

## Compatibility

Existing ACP bridge actions continue to be used. The `More` menu is local iframe state and does not require host changes.
