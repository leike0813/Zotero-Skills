## Why

The current root `README.md` is still the stock template content and does not describe the project's real architecture, integration boundaries, or value proposition.

This causes two practical issues:

- New users cannot quickly understand why this plugin uses a pluggable workflow architecture.
- The dependency on Skill-Runner for Agent Skills execution is unclear.
- The cost model advantage (leveraging subscription quotas such as OpenAI/Gemini subscription allowances instead of direct API token billing) is not communicated.

## What Changes

- Replace the template-oriented root README with a project-specific English README.
- Add an explicit Chinese documentation entry link in README, pointing to `doc/README-zhCN.md`.
- Emphasize:
  - the pluggable workflow architecture and its advantages,
  - the Skill-Runner backend requirement for Agent Skills,
  - the subscription-quota-oriented usage model and cost-control benefit.
- Keep clear attribution that this project was generated from Zotero Plugin Template.

## Capabilities

### New Capabilities

- `readme-project-positioning`: The repository README clearly describes architecture, integration mode, and usage scenarios for Zotero-Skills.

### Modified Capabilities

- None.

## Impact

- `README.md`: rewritten from template content to project-specific documentation.
- `doc/README-zhCN.md`: linked as Chinese entry from root README (no content change in this change).
