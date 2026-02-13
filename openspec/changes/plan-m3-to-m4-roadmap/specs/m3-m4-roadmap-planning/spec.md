## ADDED Requirements

### Requirement: Weekly roadmap baseline for M3-to-M4
The project SHALL define a weekly roadmap from current M3 state toward M4 readiness, and each week MUST have explicit objectives, outputs, and completion criteria.

#### Scenario: Weekly milestone is defined
- **WHEN** the roadmap is authored
- **THEN** each planned week contains scope, deliverables, and exit criteria

#### Scenario: Weekly progress is auditable
- **WHEN** stakeholders review roadmap execution
- **THEN** they can map completed change artifacts to specific weekly milestones

### Requirement: Hardening-first execution order
The roadmap MUST require architecture hardening and test-governance planning to complete before new business workflow expansion begins.

#### Scenario: Track dependency enforcement
- **WHEN** planning order is finalized
- **THEN** architecture and testing tracks are placed before workflow feature expansion tracks

#### Scenario: Expansion gating
- **WHEN** a business workflow implementation change is proposed
- **THEN** it references completed hardening outputs as prerequisites

### Requirement: Test suite governance strategy
The roadmap SHALL define grouped test taxonomy and two execution suites: `lite` for pull request gating and `full` for release gating.

#### Scenario: Taxonomy definition
- **WHEN** test governance is documented
- **THEN** tests are grouped into core, UI, and workflow-specific categories

#### Scenario: Gate policy definition
- **WHEN** CI policy is reviewed
- **THEN** PR policy is documented as `lite` and release policy is documented as `full`

### Requirement: Coverage gap and readability planning
The roadmap MUST include a plan for identifying missing tests and improving code/test readability for human review and auditing.

#### Scenario: Coverage gap planning
- **WHEN** hardening tasks are drafted
- **THEN** they include methods to identify and prioritize missing test scenarios

#### Scenario: Readability planning
- **WHEN** quality tasks are drafted
- **THEN** they include comment/documentation improvement tasks for source and tests

### Requirement: Developer enablement planning outputs
The roadmap SHALL include planning deliverables for:
1) workflow + AutoSkill development guide, and  
2) helper Skill for guided workflow/skill package creation.

#### Scenario: Guide deliverable exists
- **WHEN** developer enablement planning is reviewed
- **THEN** a guide deliverable with target audience and scope is present

#### Scenario: Helper Skill deliverable exists
- **WHEN** developer enablement planning is reviewed
- **THEN** a helper Skill deliverable with objective and boundaries is present

### Requirement: Tag workflow planning scope
The roadmap SHALL include planning scope for both `tag-manager` and `tag-regulator` workflows, including controlled vocabulary lifecycle and regulator feedback loop.

#### Scenario: Tag manager scope is captured
- **WHEN** Tag planning artifacts are reviewed
- **THEN** they include controlled vocabulary edit/import/export and traceability concerns

#### Scenario: Tag regulator scope is captured
- **WHEN** Tag planning artifacts are reviewed
- **THEN** they include add/remove/suggested-tag result handling from backend skill responses

### Requirement: M4 readiness criteria
The roadmap MUST define measurable M4 readiness criteria (Definition of Done) and require future implementation changes to align with them.

#### Scenario: DoD criteria are measurable
- **WHEN** M4 readiness is evaluated
- **THEN** criteria can be checked using objective indicators rather than subjective judgment

#### Scenario: Downstream alignment
- **WHEN** a follow-up implementation change is drafted
- **THEN** it references relevant M4 readiness criteria from the roadmap
