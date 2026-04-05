import { parseGeneratedNoteKind } from "../../lib/referencesNote.mjs";
import { withPackageRuntimeScope } from "../../lib/runtime.mjs";

function cloneSelectionContext(selectionContext) {
  return JSON.parse(JSON.stringify(selectionContext || {}));
}

function resetSummary(summary) {
  return {
    ...(summary && typeof summary === "object" ? summary : {}),
    parentCount: 0,
    childCount: 0,
    attachmentCount: 0,
    noteCount: 0,
  };
}

function addCandidate(candidates, seen, candidate) {
  const key = `${candidate.kind}:${candidate.noteItemID}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  candidates.push(candidate);
}

function collectParentGeneratedCandidates(parentItem, runtime, candidates, seen) {
  const noteIds = parentItem.getNotes?.() || [];
  for (const noteRef of noteIds) {
    let noteItem = null;
    try {
      noteItem = runtime.helpers.resolveItemRef(noteRef);
    } catch {
      noteItem = null;
    }
    if (!noteItem) {
      continue;
    }
    const kind = parseGeneratedNoteKind(noteItem.getNote?.() || "") || "custom";
    addCandidate(candidates, seen, {
      kind,
      noteItemID: noteItem.id,
      noteItemKey: String(noteItem.key || "").trim(),
      parentItemID: parentItem.id,
      parentItemKey: String(parentItem.key || "").trim(),
      parentTitle: String(parentItem.getField?.("title") || "").trim(),
    });
  }
}

function collectDirectNoteCandidates(selectionContext, runtime, candidates, seen) {
  const notes = Array.isArray(selectionContext?.items?.notes)
    ? selectionContext.items.notes
    : [];
  for (const noteEntry of notes) {
    const noteRef =
      typeof noteEntry?.item?.id === "number"
        ? noteEntry.item.id
        : String(noteEntry?.item?.key || "").trim();
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
    const kind = parseGeneratedNoteKind(noteItem.getNote?.() || "") || "custom";
    const parentItem =
      noteItem.parentItemID || noteItem.parentItem
        ? runtime.helpers.resolveItemRef(noteItem.parentItemID || noteItem.parentItem)
        : null;
    if (!parentItem) {
      continue;
    }
    addCandidate(candidates, seen, {
      kind,
      noteItemID: noteItem.id,
      noteItemKey: String(noteItem.key || "").trim(),
      parentItemID: parentItem.id,
      parentItemKey: String(parentItem.key || "").trim(),
      parentTitle: String(parentItem.getField?.("title") || "").trim(),
    });
  }
}

function createAggregatedSelection(selectionContext, candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }
  const cloned = cloneSelectionContext(selectionContext);
  cloned.items = {
    parents: [],
    notes: [],
    attachments: [],
    children: [
      {
        item: {
          id: candidates[0].parentItemID,
          title: candidates[0].parentTitle,
        },
        parent: null,
        attachments: [],
      },
    ],
  };
  cloned.summary = resetSummary(cloned.summary);
  cloned.summary.childCount = 1;
  cloned.selectionType = "child";
  cloned.exportCandidates = candidates;
  return cloned;
}

export function filterInputs({ selectionContext, runtime }) {
  return withPackageRuntimeScope(runtime, () => {
    const candidates = [];
    const seen = new Set();

    const parents = Array.isArray(selectionContext?.items?.parents)
      ? selectionContext.items.parents
      : [];
    for (const parentEntry of parents) {
      const parentId = parentEntry?.item?.id;
      if (!parentId) {
        continue;
      }
      let parentItem = null;
      try {
        parentItem = runtime.helpers.resolveItemRef(parentId);
      } catch {
        parentItem = null;
      }
      if (!parentItem) {
        continue;
      }
      collectParentGeneratedCandidates(parentItem, runtime, candidates, seen);
    }

    collectDirectNoteCandidates(selectionContext, runtime, candidates, seen);
    return createAggregatedSelection(selectionContext, candidates);
  });
}
