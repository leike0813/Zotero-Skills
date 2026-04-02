## ADDED Requirements

### Requirement: Tag-Regulator Suggest Intake Must Respect Subscription Publish Transactions
`tag-regulator` suggest intake SHALL use the active tag vocabulary mode to decide whether a selected suggest tag is committed locally or published remotely.

#### Scenario: Subscription-mode join publish fails
- **WHEN** a user joins a suggest tag from the `tag-regulator` suggest dialog while Tag Manager is in subscription mode
- **AND** the remote vocabulary publish fails
- **THEN** the tag SHALL be written to staged storage with tag-regulator parent bindings
- **AND** the user SHALL receive a short publish failure toast
- **AND** the failure SHALL be logged

### Requirement: Staged Suggest Tags Must Retain Parent Bindings
Staged entries created from `tag-regulator` suggestions SHALL retain the set of parent items that proposed the tag.

#### Scenario: Same staged tag is suggested by multiple parents
- **WHEN** two or more `tag-regulator` runs stage the same suggest tag for different parent items
- **THEN** the staged entry SHALL retain the union of those parent item IDs

#### Scenario: Staged intake remains deferred
- **WHEN** a `tag-regulator` suggest tag is written to staged storage
- **THEN** the staged entry SHALL retain deferred parent bindings
- **AND** the workflow SHALL NOT append that tag to any parent item until committed vocabulary update succeeds

### Requirement: Successful Staged Publish Must Backfill Bound Parent Tags
When a staged tag with parent bindings successfully enters committed vocabulary, that tag SHALL be appended to every bound parent item.

#### Scenario: Tag Manager promotes staged tag with parent bindings
- **WHEN** Tag Manager successfully publishes a staged tag that carries tag-regulator parent bindings
- **THEN** the tag SHALL be appended to each bound parent item
- **AND** the staged entry SHALL be removed after the bindings are applied
