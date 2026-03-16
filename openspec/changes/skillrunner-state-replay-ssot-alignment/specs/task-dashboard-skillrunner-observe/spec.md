## MODIFIED Requirements

### Requirement: SkillRunner observation MUST follow backend jobs semantics as SSOT

Plugin MUST treat backend jobs semantics as the single truth for run state projection.

#### Scenario: non-terminal states are events-driven only

- **WHEN** plugin receives `conversation.state.changed` from events history/SSE
- **THEN** plugin MAY update non-terminal snapshot (`queued/running/waiting_*`)
- **AND** reconciler/jobs polling MUST NOT rewrite non-terminal states

#### Scenario: terminal states may be confirmed by jobs API

- **WHEN** backend failure path ends a run without terminal `state.changed`
- **THEN** plugin MUST allow terminal convergence from jobs double-confirm
- **AND** terminal state MUST fan out consistently to dashboard/workspace/banner

#### Scenario: restart replay preserves waiting state

- **WHEN** plugin restarts with existing waiting snapshot
- **THEN** first frame MUST render waiting snapshot
- **AND** refresh failure MUST NOT downgrade waiting to running fallback

#### Scenario: backend temporarily unreachable keeps last-known snapshot

- **WHEN** backend is temporarily unreachable during reconcile/sync
- **THEN** plugin MUST keep last-known snapshot unchanged
- **AND** plugin MUST set reconcile flag and retry with backoff
- **AND** plugin MUST NOT clean task or force running fallback

#### Scenario: dual stream catch-up on reconnect

- **WHEN** stream reconnect occurs
- **THEN** plugin MUST run `events/history -> events SSE` for state channel
- **AND** plugin MUST run `chat/history -> chat SSE` for display channel
- **AND** sequence continuity MUST be preserved (no duplicate replay in final UI projection)

