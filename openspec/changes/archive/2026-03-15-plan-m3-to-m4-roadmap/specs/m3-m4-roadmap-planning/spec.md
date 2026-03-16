## ADDED Requirements

### Requirement: Roadmap MUST represent delivered milestone baseline
`plan-m3-to-m4-roadmap` MUST describe delivered capabilities rather than unfinished weekly plans.

#### Scenario: roadmap is reviewed after baseline rewrite
- **WHEN** reviewers inspect roadmap artifacts
- **THEN** they see delivered capability groups instead of future week-level todo plans
- **AND** no unfinished task item remains in this change

### Requirement: Baseline MUST include four mandatory delivered milestones
The roadmap baseline MUST include these delivered milestones:
1) SkillRunner interactive execution mode  
2) Unified dashboard and run dialog experience  
3) One-click local SkillRunner backend deploy/start lifecycle  
4) `literature-explainer` workflow

#### Scenario: mandatory milestones are checked
- **WHEN** roadmap baseline is audited
- **THEN** all four mandatory milestones are explicitly present

### Requirement: Baseline MUST include three supplemental core milestones
The roadmap baseline MUST also include:
1) Workflow settings single-source web configuration  
2) Dashboard running-task interactive navigation  
3) Local backend UI/i18n governance convergence

#### Scenario: supplemental milestones are checked
- **WHEN** roadmap baseline is audited
- **THEN** all three supplemental milestone groups are explicitly present

### Requirement: Every milestone MUST be traceable to archived changes
Each milestone entry MUST include one or more archived change IDs as evidence.

#### Scenario: traceability audit
- **WHEN** an auditor cross-checks roadmap milestones
- **THEN** every milestone maps to existing directories under `openspec/changes/archive/`
- **AND** roadmap text does not rely on unverifiable, unlinked claims
