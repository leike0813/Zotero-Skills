## Why

ACP assistant responses commonly include Markdown structure, code blocks, tables, and LaTeX formulas. Rendering those messages as plain text makes technical agent output harder to read than the existing SkillRunner workspace chat.

## What Changes

- Add Markdown and math rendering to ACP transcript `message` and `thought` bodies.
- Reuse the dashboard vendor assets already used by SkillRunner: KaTeX, markdown-it, and markdown-it-texmath.
- Keep raw HTML disabled and fall back to escaped plain text when the renderer is unavailable or throws.
- Keep tool activity, plans, status, diagnostics, permission text, and other UI metadata as plain text.
- Add ACP-specific Markdown CSS for code blocks, tables, blockquotes, lists, inline code, and KaTeX overflow.

## Capabilities

### New Capabilities

- `acp-chat-markdown-math-rendering`: ACP transcript rendering rules for Markdown and LaTeX math in user, assistant, and thought text.

### Modified Capabilities

- None.

## Impact

- Affected UI files: `addon/content/dashboard/acp-chat.html`, `addon/content/dashboard/acp-chat.js`, `addon/content/dashboard/acp-chat.css`.
- Affected tests: ACP UI smoke tests.
- No ACP protocol, snapshot schema, MCP, permission, or dependency changes.
