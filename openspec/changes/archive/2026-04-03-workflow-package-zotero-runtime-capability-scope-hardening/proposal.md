# Proposal

Fix `workflow-package` runtime capability resolution in Zotero by removing the assumption that package ESM modules can reliably discover execution capabilities through shared globals.

Package hooks and package-local `lib/*.mjs` should consume a hook-scoped runtime capability scope derived from the explicit `runtime` argument passed by the workflow execution chain. This keeps builtin and user workflow-packages on the same runtime model and prevents `prefs/items/fetch/base64` capability failures in Zotero ESM.
