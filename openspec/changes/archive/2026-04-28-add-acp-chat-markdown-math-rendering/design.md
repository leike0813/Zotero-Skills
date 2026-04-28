# Design

## Renderer

ACP chat will initialize a local Markdown renderer in `acp-chat.js` using the same browser globals as the SkillRunner workspace:

- `window.markdownit`
- `window.texmath`
- `window.katex`

Renderer options stay conservative:

- `html: false`
- `breaks: true`
- `linkify: false`
- `typographer: false`
- `highlight: null`

When KaTeX and texmath are available, the renderer enables dollar delimiters with `throwOnError: false` and `output: "htmlAndMathML"`.

If the renderer is unavailable or throws, the UI uses escaped plain text.

## Transcript Rendering

Only human/agent prose uses Markdown rendering:

- `message` body
- `thought` body

Operational UI remains plain text:

- tool rows and tool activity drawers
- plan panel entries
- status rows
- diagnostics and permission UI

Streaming updates rerender the current body from the accumulated item text. No incremental Markdown parser state is introduced.

## Styling

ACP gets local Markdown styles instead of importing the SkillRunner chat classes directly. Styles cover:

- paragraphs and nested block spacing
- inline code and fenced code blocks
- tables
- blockquotes
- lists
- KaTeX display overflow

Plain mode stays compact. Bubble mode keeps rendered content inside the bubble width with horizontal overflow for wide code, tables, and equations.

## Security

Raw HTML is disabled in markdown-it. ACP does not add a sanitizer in this change because the renderer is not configured to emit user-provided HTML. If trusted HTML support is needed later, it must be designed separately.
