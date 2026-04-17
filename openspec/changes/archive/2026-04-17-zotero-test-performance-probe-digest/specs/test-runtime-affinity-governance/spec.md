## ADDED Requirements

### Requirement: Tail degradation diagnosis MUST escalate to performance probe when residual probe is inconclusive

When real Zotero `full` runs still degrade toward the tail after residual leak probing, the next diagnosis step MUST be a staged performance probe digest before timeout inflation or suite reordering is attempted.

#### Scenario: Residual probe shows no actionable growth

- **WHEN** the leak probe digest shows no actionable post-cleanup growth outside naturally monotonic counters
- **THEN** engineers MUST enable the performance probe digest
- **AND** the next diagnosis pass MUST focus on operation duration, event-loop lag, and host resource growth

