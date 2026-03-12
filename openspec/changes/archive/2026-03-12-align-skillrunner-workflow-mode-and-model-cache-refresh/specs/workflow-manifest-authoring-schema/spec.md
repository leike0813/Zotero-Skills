## MODIFIED Requirements

### Requirement: Schema contract SHALL align with current loader-visible constraints
The standalone schema MUST align with the current runtime-visible manifest constraints for critical fields and deprecated-field rejection.

#### Scenario: skillrunner workflow requires dedicated execution mode field
- **WHEN** a workflow declares `provider = "skillrunner"` or `request.kind = "skillrunner.job.v1"`
- **THEN** manifest schema SHALL require `execution.skillrunner_mode`
- **AND** accepted values SHALL be `auto` or `interactive`
- **AND** existing `execution.mode` semantics SHALL remain unchanged

#### Scenario: non-skillrunner workflow keeps optionality
- **WHEN** a workflow declares provider other than skillrunner
- **THEN** manifest schema SHALL NOT require `execution.skillrunner_mode`
