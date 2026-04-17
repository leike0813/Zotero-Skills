## Design

### Two-layer diagnosis

The existing leak probe answers "what keeps accumulating." The new performance
probe answers "what gets more expensive toward the tail." Both probes share the
same Zotero diagnostic lifecycle and produce one JSON digest each.

### Phase capture

The performance probe captures:

- `test-start`
- `pre-cleanup`
- `post-background-cleanup`
- `post-object-cleanup`
- `domain-end`

Each snapshot includes:

- test metadata
- event-loop lag
- host resource metrics

### Span capture

A shared bridge lets production modules emit test-only timing spans without
depending on test-layer code directly. The bridge is a strict no-op unless the
performance probe is installed and enabled.

Initial span coverage:

- `buildSelectionContext`
- `executeBuildRequests`
- `executeApplyResult`
- `handlers.item.create`
- `handlers.attachment.createFromPath`
- `handlers.parent.addNote`
- `eraseTx`

### Host resources

The first iteration uses low-intrusion read-only signals:

- library item / note / attachment counts
- collection count when a safe API is available
- open window count
- dialog / browser / frame counts

If a host metric cannot be read safely, the digest records `null`.

