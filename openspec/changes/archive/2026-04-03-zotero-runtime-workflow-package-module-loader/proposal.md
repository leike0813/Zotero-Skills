# Proposal

Upgrade the Zotero runtime workflow hook loader so workflow-package hooks can reliably use package-local relative imports.

This change standardizes workflow-package hook/lib files on `.mjs`, keeps legacy single-workflow hooks compatible, and makes package hooks use true module loading in Zotero runtime instead of the text-transform fallback loader.
