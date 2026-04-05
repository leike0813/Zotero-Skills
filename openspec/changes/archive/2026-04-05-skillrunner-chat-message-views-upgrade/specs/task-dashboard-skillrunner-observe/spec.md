## ADDED Requirements

### Requirement: SkillRunner run dialog chat view MUST consume canonical replay with dual projection

Plugin run dialog MUST render SkillRunner conversation from canonical chat replay rows instead of reconstructing FCMP groupings locally.

#### Scenario: browser-side chat view projects the same timeline into plain and bubble modes

- **WHEN** run dialog receives conversation rows containing `assistant_process`, `assistant_message`, and `assistant_final`
- **THEN** browser-side chat core MUST maintain one mode-independent canonical timeline
- **AND** switching between `plain` and `bubble` MUST only change projection, not historical grouping
- **AND** `plain` MUST be the default mode for a newly opened dialog session

#### Scenario: run dialog snapshot carries frontend projection fields

- **WHEN** host serializes run dialog snapshot messages
- **THEN** each message row MUST preserve `attempt`
- **AND** each row MUST preserve correlation fields required for projection, including `message_id` and `replaces_message_id`
- **AND** browser-side projection MUST NOT rely on jobs API or ad-hoc FCMP reconstruction to infer message convergence

### Requirement: Shared chat core compatibility MUST remain fail-soft

Run dialog MUST tolerate stale cached chat core assets during rollout.

#### Scenario: cached old chat core object does not expose full dual-view API

- **WHEN** `chat_thinking_core.js` is stale and lacks some dual-view methods
- **THEN** run dialog MUST guard `setDisplayMode` / `getDisplayMode` calls defensively
- **AND** dialog MUST fall back to default `plain` mode instead of failing initialization
- **AND** the HTML template MUST reference the shared chat core script with cache-busting
