# Workflow Hook Helpers API Reference

This document is the API-level reference for hook-side helper utilities injected as `runtime.helpers`.

Protocol-level workflow contract is documented in `doc/components/workflows.md`.

## Runtime Entry

Each hook receives `runtime`:

```js
export function filterInputs({ selectionContext, runtime }) {
  const helpers = runtime.helpers;
  // use helpers here
}
```

## Scope Boundary

- `runtime.helpers`: stable, workflow-agnostic utility surface.
- Dialog/editor host APIs: hook-facing bridge APIs, not part of `runtime.helpers` (see below).

## Full Helper Inventory

Current source of truth:

- `src/workflows/types.ts` (`HookHelpers`)
- `src/workflows/helpers.ts` (`createHookHelpers`)

### Attachment and Selection Helpers

`getAttachmentParentId(entry: unknown): number | null`
- Returns attachment parent item ID from `entry.parent.id` or `entry.item.parentItemID`.
- Returns `null` when unavailable.

`getAttachmentFilePath(entry: unknown): string`
- Resolution order: `entry.filePath` -> `entry.item.data.path` -> `entry.item.title` -> `""`.

`getAttachmentFileName(entry: unknown): string`
- Derives basename from `getAttachmentFilePath`.
- Normalizes `attachments:` / `storage:` prefix before basename extraction.

`getAttachmentFileStem(entry: unknown): string`
- Lower-cased filename stem without extension.

`getAttachmentDateAdded(entry: unknown): number`
- Parses `entry.item.data.dateAdded`.
- Invalid/missing value returns `Number.POSITIVE_INFINITY`.

`isMarkdownAttachment(entry: unknown): boolean`
- `true` when filename ends with `.md` or MIME equals `text/markdown`.

`isPdfAttachment(entry: unknown): boolean`
- `true` when filename ends with `.pdf` or MIME equals `application/pdf`.

`pickEarliestPdfAttachment(entries: unknown[]): unknown | null`
- Filters PDF entries and sorts by:
  - `dateAdded` ascending;
  - filename lexical order as stable tie-breaker.
- Returns first match or `null`.

`cloneSelectionContext<T>(selectionContext: T): T`
- Deep clones with JSON round-trip.
- Intended for hook-side safe mutation flows.

`withFilteredAttachments<T>(selectionContext: T, attachments: unknown[]): T`
- Returns cloned selection context with:
  - `items.attachments = attachments`
  - `summary.attachmentCount = attachments.length`

### Item and Note Helpers

`resolveItemRef(ref: Zotero.Item | number | string): Zotero.Item`
- Resolves direct item/id/key into `Zotero.Item`.
- Throws when resolution fails.
- String key resolution targets `Zotero.Libraries.userLibraryID`.

`basenameOrFallback(targetPath: string | undefined, fallback: string): string`
- Returns basename when `targetPath` is truthy; otherwise returns `fallback`.

`toHtmlNote(title: string, body: string): string`
- Returns escaped HTML note wrapper:
  - `<h1>` title
  - `<pre>` body

### Reference Payload/Table Helpers

`normalizeReferenceAuthors(value: unknown): string[]`
- Accepts:
  - author array;
  - delimited string (`;` or newline).
- Trims entries and drops empty elements.

`normalizeReferenceEntry(entry: unknown, index: number): Record<string, unknown>`
- Normalizes one reference row:
  - required-ish fields: `id`, `title`, `year`, `author[]`
  - optional `citekey` (`citeKey` merged into `citekey`)
  - optional `rawText`
  - optional metadata: `publicationTitle`, `conferenceName`, `university`, `archiveID`, `volume`, `issue`, `pages`, `place`
- Empty optional values are removed.

`normalizeReferencesArray(value: unknown): Record<string, unknown>[]`
- Normalizes array input; non-array yields `[]`.

`normalizeReferencesPayload(payload: unknown): Record<string, unknown>[]`
- Accepts payload shapes:
  - `Reference[]`
  - `{ references: Reference[] }`
  - `{ items: Reference[] }`
- Throws if no recognizable references array exists.

`replacePayloadReferences(payload: unknown, references: Record<string, unknown>[]): unknown`
- Replaces references preserving payload shape when possible:
  - array payload -> returns `references`
  - `{ references: [] }` -> updates `references`
  - `{ items: [] }` -> updates `items`
  - other object -> writes `references`
  - non-object -> returns `{ references }`

`resolveReferenceSource(entry: unknown): string`
- Returns first non-empty source field by priority:
  - `publicationTitle` -> `conferenceName` -> `university` -> `archiveID`.

`renderReferenceLocator(entry: unknown): string`
- Renders locator from optional fields in order:
  - `volume`, `issue`, `pages`, `place`
- Format:
  - `Vol. <volume>; No. <issue>; pp. <pages>; <place>`
- Empty fields are skipped.

`renderReferencesTable(references: unknown): string`
- Canonical HTML table renderer used by shared reference-note workflows.
- Column order:
  - `#`, `Citekey`, `Year`, `Title`, `Authors`, `Source`, `Locator`.
- Input is normalized via `normalizeReferencesArray`.

## Hook-Facing Dialog/Editor Bridge APIs

These APIs are outside `runtime.helpers` and are provided by workflow editor host:

- `globalThis.__zsWorkflowEditorHostOpen`
- `globalThis.__zsWorkflowEditorHostRegisterRenderer`
- `globalThis.__zsWorkflowEditorHostUnregisterRenderer`
- `addon.data.workflowEditorHost.open`
- `addon.data.workflowEditorHost.registerRenderer`
- `addon.data.workflowEditorHost.unregisterRenderer`

Primary implementation: `src/modules/workflowEditorHost.ts`.

### Bridge Functions

`open(args): Promise<{ saved: boolean; result?: unknown; reason?: string }>`
- Opens one editor dialog session.
- `saved = false` means user canceled/closed (conventionally equivalent to “No”).

`registerRenderer(rendererId, renderer): void`
- Registers renderer implementation by `rendererId`.

`unregisterRenderer(rendererId): void`
- Removes renderer registration.

### Sequencing and Lifecycle Semantics

- Sessions are queued and opened sequentially (one dialog at a time).
- Multi-input workflow invocations therefore present dialogs one-by-one.
- Renderer `serialize()` return value is passed back as `result` when saved.
- If hook treats cancel as failure (for example by throwing), the corresponding job is marked failed.

## Practical Examples

### Example 1: Attachment Filtering

```js
export function filterInputs({ selectionContext, runtime }) {
  const attachments = Array.isArray(selectionContext?.items?.attachments)
    ? selectionContext.items.attachments
    : [];
  const selected = attachments.filter((entry) => runtime.helpers.isPdfAttachment(entry));
  return runtime.helpers.withFilteredAttachments(selectionContext, selected);
}
```

### Example 2: Payload Normalization + Replacement

```js
function rewritePayload(payloadJson, runtime) {
  const refs = runtime.helpers.normalizeReferencesPayload(payloadJson);
  const next = refs.map((entry, i) =>
    runtime.helpers.normalizeReferenceEntry({ ...entry, id: `ref-${i + 1}` }, i),
  );
  return runtime.helpers.replacePayloadReferences(payloadJson, next);
}
```

### Example 3: Canonical Table Rendering

```js
function renderTableHtml(references, runtime) {
  return runtime.helpers.renderReferencesTable(references);
}
```

## Maintenance Checklist

- If `HookHelpers` changes in `src/workflows/types.ts`, update this document in the same change.
- If helper behavior changes in `src/workflows/helpers.ts`, update relevant signature/semantics/examples.
- If workflow editor host bridge keys or behaviors change (`src/modules/workflowEditorHost.ts`), update bridge section.
