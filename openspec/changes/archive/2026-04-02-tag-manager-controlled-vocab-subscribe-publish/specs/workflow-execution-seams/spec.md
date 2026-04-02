## ADDED Requirements

### Requirement: Tag Manager SHALL support configurable GitHub vocabulary sync
The `tag-manager` workflow SHALL support persisted workflow parameters for
GitHub-backed controlled vocabulary subscribe/publish.

#### Scenario: Tag Manager opens with complete GitHub sync config
- **WHEN** the user opens workflow `tag-manager`
- **AND** `github_owner`, `github_repo`, `file_path`, and `github_token` are configured
- **THEN** the workflow SHALL attempt to subscribe remote `tags/tags.json` before the editor opens
- **AND** successful remote tags SHALL seed the editor initial entries

#### Scenario: GitHub config is incomplete
- **WHEN** the user opens workflow `tag-manager`
- **AND** the GitHub sync config is incomplete
- **THEN** the workflow SHALL continue in local-only mode
- **AND** it SHALL NOT block the editor

### Requirement: Tag Manager publish SHALL preserve local-save-first semantics
Saving the Tag Manager editor SHALL persist local controlled vocabulary before
any remote publish attempt.

#### Scenario: Remote publish fails after local save
- **WHEN** the user saves Tag Manager entries
- **AND** local persistence succeeds
- **AND** remote GitHub publish fails
- **THEN** the local controlled vocabulary SHALL remain saved
- **AND** the user SHALL receive explicit publish-failed feedback
- **AND** the workflow SHALL emit observable runtime logs

#### Scenario: GitHub Contents API conflict happens once
- **WHEN** a publish attempt receives `409 Conflict`
- **THEN** the workflow SHALL re-fetch the latest remote contents
- **AND** retry publish once using the latest remote metadata plus current local tags
