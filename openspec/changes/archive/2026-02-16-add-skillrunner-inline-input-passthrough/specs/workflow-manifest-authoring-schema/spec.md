## MODIFIED Requirements

### Requirement: Schema contract SHALL align with current loader-visible constraints
The standalone schema MUST align with the current runtime-visible manifest constraints for critical fields and deprecated-field rejection.

#### Scenario: skillrunner mixed-input declaration remains representable
- **WHEN** a workflow declares `request.kind = "skillrunner.job.v1"` and provides `request.input` with inline payload fields together with `request.input.upload.files`
- **THEN** workflow manifest schema SHALL accept that declaration as valid authoring input
- **AND** schema SHALL keep `request.input` extensible for backend-evolving inline fields while preserving typed upload structure checks
