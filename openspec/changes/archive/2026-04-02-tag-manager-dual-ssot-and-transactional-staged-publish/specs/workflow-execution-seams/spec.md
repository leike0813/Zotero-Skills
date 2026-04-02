## ADDED Requirements

### Requirement: Tag Manager SHALL distinguish local and subscription committed vocab sources
`tag-manager` SHALL resolve its committed controlled vocabulary from different
sources depending on whether GitHub sync is configured.

#### Scenario: Local mode reads local committed vocabulary
- **WHEN** GitHub sync config is incomplete
- **THEN** Tag Manager SHALL use local committed vocabulary as controlled vocab truth

#### Scenario: Subscription mode reads remote committed snapshot
- **WHEN** GitHub sync config is complete
- **THEN** Tag Manager SHALL use the remote committed snapshot as controlled vocab truth
- **AND** staged / pending entries SHALL NOT appear in committed controlled vocab

### Requirement: Tag Manager staged promotion SHALL be transactional in subscription mode
Staged entries promoted while GitHub sync is configured SHALL be published in a
debounced transaction before becoming committed controlled vocabulary.

#### Scenario: Subscription-mode staged batch succeeds
- **WHEN** one or more staged entries are promoted within the debounce window
- **THEN** Tag Manager SHALL issue one publish transaction for the batch
- **AND** only after publish succeeds SHALL those entries be removed from staged
- **AND** the committed controlled vocab SHALL refresh to include them

#### Scenario: Subscription-mode staged batch fails
- **WHEN** a staged promotion batch publish fails
- **THEN** Tag Manager SHALL keep the batch entries in staged
- **AND** the committed controlled vocab SHALL remain unchanged
- **AND** the user SHALL receive explicit failure feedback

### Requirement: Tag Manager save SHALL commit remotely before updating subscription-mode controlled vocab
Saving edited controlled vocabulary in subscription mode SHALL update committed
state only after the remote transaction succeeds.

#### Scenario: Subscription-mode save publish fails
- **WHEN** the user saves edited controlled vocabulary while GitHub sync is configured
- **AND** the remote publish fails
- **THEN** the remote committed snapshot SHALL remain unchanged
- **AND** the editor session SHALL preserve the failed draft with explicit retry feedback

### Requirement: Active committed vocabulary SHALL back runtime consumers
Runtime consumers of controlled vocabulary SHALL resolve the active committed
vocabulary for the current mode rather than reading staged or pending data.

#### Scenario: Tag Regulator builds requests in subscription mode
- **WHEN** Tag Regulator builds `valid_tags` while GitHub sync is configured
- **THEN** it SHALL read the remote committed snapshot
- **AND** it SHALL NOT include staged or pending entries
