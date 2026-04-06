## ADDED Requirements

### Requirement: SkillRunner provider dispatch MUST not fabricate terminal failed after request creation

SkillRunner provider/queue integration MUST treat post-create local failure as a
recoverable plugin-side diagnostic instead of terminal backend failure.

#### Scenario: request-created local dispatch failure stays pending for reconciler

- **WHEN** provider dispatch has already created backend `requestId`
- **AND** a later local dispatch step fails before foreground apply completes
- **THEN** foreground execution MUST keep that request pending for reconciler
- **AND** plugin MUST preserve `requestId` and diagnostic error text
- **AND** foreground workflow summary MUST NOT count that request as terminal
  failed
