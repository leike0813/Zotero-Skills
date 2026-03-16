function cloneSelectionContext(selectionContext) {
  return JSON.parse(JSON.stringify(selectionContext || {}));
}

function parseNoteKind(noteContent) {
  const text = String(noteContent || "");
  const payloadKind = text.match(
    /data-zs-payload\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
  );
  const payloadType = payloadKind
    ? String(payloadKind[1] || payloadKind[2] || payloadKind[3] || "")
    : "";
  if (payloadType === "references-json") {
    return "references";
  }
  const kindMatch = text.match(
    /data-zs-note-kind\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
  );
  const kind = kindMatch
    ? String(kindMatch[1] || kindMatch[2] || kindMatch[3] || "")
    : "";
  return kind === "references" ? "references" : "";
}

function resolveNoteReference(noteEntry) {
  if (typeof noteEntry?.item?.id === "number") {
    return noteEntry.item.id;
  }
  if (typeof noteEntry?.id === "number") {
    return noteEntry.id;
  }
  const key = String(noteEntry?.item?.key || noteEntry?.key || "").trim();
  return key || null;
}

function normalizeNoteSelectionEntry(noteItem) {
  const parentRef = noteItem.parentItemID || null;
  const parentItem = parentRef ? Zotero.Items.get(parentRef) : null;
  return {
    item: {
      id: noteItem.id,
      key: noteItem.key,
      itemType: noteItem.itemType,
      title: String(noteItem.getField?.("title") || ""),
      libraryID: noteItem.libraryID,
      parentItemID:
        noteItem.parentItemID === false ? null : noteItem.parentItemID || null,
      data: noteItem.toJSON?.() || null,
    },
    parent: parentRef
      ? {
          id: parentRef,
          title: String(parentItem?.getField?.("title") || ""),
        }
      : null,
    tags: noteItem.getTags?.() || [],
    collections: noteItem.getCollections?.() || [],
  };
}

function collectCandidateNotesFromParents(selectionContext) {
  const parents = Array.isArray(selectionContext?.items?.parents)
    ? selectionContext.items.parents
    : [];
  const notes = [];
  for (const parentEntry of parents) {
    const parentNotes = Array.isArray(parentEntry?.notes) ? parentEntry.notes : [];
    for (const noteEntry of parentNotes) {
      notes.push(noteEntry);
    }
  }
  return notes;
}

function collectCandidateNotes(selectionContext) {
  const directNotes = Array.isArray(selectionContext?.items?.notes)
    ? selectionContext.items.notes
    : [];
  return [...directNotes, ...collectCandidateNotesFromParents(selectionContext)];
}

export function filterInputs({ selectionContext, runtime }) {
  const notes = collectCandidateNotes(selectionContext);
  const validNotes = [];
  const seen = new Set();

  for (const noteEntry of notes) {
    const noteRef = resolveNoteReference(noteEntry);
    if (!noteRef) {
      continue;
    }
    let noteItem = null;
    try {
      noteItem = runtime.helpers.resolveItemRef(noteRef);
    } catch {
      noteItem = null;
    }
    if (!noteItem) {
      continue;
    }
    const dedupeKey =
      typeof noteItem.id === "number" ? `id:${noteItem.id}` : `key:${noteItem.key}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    const noteContent = String(noteItem.getNote?.() || "");
    if (parseNoteKind(noteContent) !== "references") {
      continue;
    }
    seen.add(dedupeKey);
    validNotes.push(normalizeNoteSelectionEntry(noteItem));
  }

  if (validNotes.length === 0) {
    return null;
  }

  const cloned = cloneSelectionContext(selectionContext);
  if (!cloned.items) {
    cloned.items = {};
  }
  cloned.items.notes = validNotes;
  cloned.items.attachments = [];
  cloned.items.parents = [];
  cloned.items.children = [];
  if (!cloned.summary) {
    cloned.summary = {};
  }
  cloned.summary.noteCount = validNotes.length;
  cloned.summary.attachmentCount = 0;
  cloned.summary.parentCount = 0;
  cloned.summary.childCount = 0;
  cloned.selectionType = "note";
  return cloned;
}
