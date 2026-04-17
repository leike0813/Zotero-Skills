## 1. File-Level Zotero Routine Pruning

- [x] 1.1 Add a real-Zotero-only routine allowlist to the global domain filter
- [x] 1.2 Add regression coverage for retained vs pruned file-path decisions

## 2. Mixed-File Smoke Narrowing

- [x] 2.1 Narrow retained UI files to smoke-only Zotero cases
- [x] 2.2 Narrow retained workflow files to 1-2 canonical Zotero smoke cases
- [x] 2.3 Keep Node coverage intact by moving non-smoke cases to `node-only`

## 3. Governance Recording

- [x] 3.1 Record the retained Zotero routine inventory in governance docs
- [x] 3.2 Add OpenSpec artifacts and delta specs for the new pruning contract
- [x] 3.3 Run targeted Node regressions, Zotero domain runs, `openspec validate`,
      and `npx tsc --noEmit`
