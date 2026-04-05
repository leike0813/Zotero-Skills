# skillrunner-chat-message-projection Specification

## Purpose
TBD - created by archiving change skillrunner-chat-message-views-upgrade. Update Purpose after archive.
## Requirements
### Requirement: SkillRunner assistant message semantics MUST distinguish process, intermediate, and final text

Plugin frontend chat projection MUST treat non-terminal assistant text as a first-class message semantic instead of reusing reasoning semantics.

#### Scenario: assistant intermediate text is not treated as reasoning

- **WHEN** canonical replay contains an `assistant_message`
- **THEN** frontend MUST preserve it as a distinct semantic from `assistant_process`
- **AND** `plain` mode MUST render it directly in the chat message area
- **AND** `bubble` mode MUST place it inside the thinking drawer with other process rows

### Requirement: Final message convergence MUST prefer explicit replacement identity

Plugin frontend MUST deduplicate assistant intermediate/final convergence using explicit message identity before text guessing.

#### Scenario: final row replaces an intermediate by explicit replacement id

- **WHEN** an `assistant_final` row carries `replaces_message_id`
- **THEN** projection MUST remove the matching intermediate from the same attempt before inserting the final row
- **AND** if `replaces_message_id` is absent, projection MAY fall back to the same `message_id`
- **AND** exact-text matching MUST only be used as the last fallback

#### Scenario: convergence does not cross attempt boundary

- **WHEN** two attempts reuse the same `message_id` or text
- **THEN** projection MUST NOT deduplicate across attempts

### Requirement: Run dialog chat rendering MUST use local markdown and KaTeX assets

Plugin run dialog MUST render markdown and formulas without external CDN dependencies.

#### Scenario: markdown and latex render in both plain and bubble projections

- **WHEN** assistant/user text contains markdown tables, lists, code blocks, blockquotes, links, or `$...$` / `$$...$$` formulas
- **THEN** run dialog MUST render them via local `markdown-it`, `katex`, and `markdown-it-texmath` assets
- **AND** the same markdown renderer MUST be shared by both `plain` and `bubble` modes
- **AND** markdown configuration MUST disable raw HTML (`html: false`)

#### Scenario: markdown render failure falls back to safe text

- **WHEN** markdown parsing fails or vendor assets are unavailable
- **THEN** run dialog MUST fall back to escaped plain-text HTML
- **AND** it MUST NOT inject raw user HTML into the page

