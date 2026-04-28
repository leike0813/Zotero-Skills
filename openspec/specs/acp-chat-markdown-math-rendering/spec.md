# acp-chat-markdown-math-rendering Specification

## Purpose
TBD - created by archiving change add-acp-chat-markdown-math-rendering. Update Purpose after archive.
## Requirements
### Requirement: Markdown Transcript Rendering

ACP chat SHALL render transcript message and thought text as Markdown with math support when the browser renderer is available.

#### Scenario: Message and thought bodies render Markdown

- Given a transcript item is a user message, assistant message, or thought
- When ACP chat renders the item
- Then the body is rendered through the Markdown renderer
- And Markdown tables, code blocks, lists, blockquotes, and math delimiters are supported

#### Scenario: Operational UI remains plain text

- Given a transcript item is a tool row, tool activity drawer, plan, status, diagnostics, or permission UI element
- When ACP chat renders the item
- Then that operational UI is rendered as plain text
- And Markdown syntax in metadata is not interpreted

### Requirement: Safe Fallback

ACP chat SHALL disable raw HTML Markdown and fall back to escaped plain text when rendering is unavailable or fails.

#### Scenario: Renderer unavailable

- Given markdown-it is not available on `window`
- When ACP chat renders message text
- Then the UI renders escaped plain text
- And raw input HTML is not inserted into the DOM

#### Scenario: Renderer throws

- Given the Markdown renderer throws while rendering text
- When ACP chat renders message text
- Then the UI renders escaped plain text
- And the transcript remains usable

### Requirement: ACP Markdown Styling

ACP chat SHALL provide local styles for rendered Markdown content.

#### Scenario: Wide rendered content remains contained

- Given a rendered message contains a wide code block, table, or display equation
- When ACP chat renders in plain or bubble mode
- Then the wide content scrolls within the message body
- And it does not break the transcript layout

