## Design

### Phase-aligned probe capture

The shared Zotero diagnostic bridge already owns the canonical `beforeEach`,
`afterEach`, and `after` lifecycle. The leak probe hooks into that same
sequence instead of creating a second competing harness.

Each snapshot records:

- test identity: index, domain, file, full title
- lifecycle phase
- elapsed time since run start
- metrics from shared runtime surfaces

### Read-only module snapshots

The probe does not mutate runtime state. It only reads counters and boolean
flags from existing singletons:

- task reconciler
- session sync manager
- run dialog observer runtime
- local runtime loop state
- backend health registry
- runtime log buffer
- real-object cleanup tracker
- temp artifact registry

### Temp artifact observation

This change intentionally does not clean temp artifacts. It only records:

- extracted zip bundle directories
- tag-regulator valid-tags YAML files

That keeps the measurement path neutral. Cleanup work, if needed, will be based
on the resulting digest rather than mixed into the measurement phase.

### Digest output

At domain end the probe writes one JSON file containing:

- `meta`
- `snapshots`
- `summary`
- `suspicions`

The summary focuses on post-cleanup residuals and head-vs-tail growth so later
fixes can target the surface that actually keeps growing across the run.
