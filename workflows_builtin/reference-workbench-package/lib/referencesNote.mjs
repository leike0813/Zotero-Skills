import {
  decodeBase64Utf8,
  decodeHtmlEntities,
  encodeBase64Utf8,
  readTagAttribute,
  setTagAttribute,
} from "./htmlCodec.mjs";
import { requireHostItems } from "./runtime.mjs";

export function cloneSelectionContext(selectionContext) {
  return JSON.parse(JSON.stringify(selectionContext || {}));
}

export function parseNoteKind(noteContent) {
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

export function parseGeneratedNoteKind(noteContent) {
  const text = String(noteContent || "");

  if (/data-zs-payload=(["'])digest-markdown\1/i.test(text)) {
    return "digest";
  }
  if (/data-zs-payload=(["'])references-json\1/i.test(text)) {
    return "references";
  }
  if (/data-zs-payload=(["'])citation-analysis-json\1/i.test(text)) {
    return "citation-analysis";
  }

  const kindMatch = text.match(
    /data-zs-note-kind\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
  );
  const kind = kindMatch
    ? String(kindMatch[1] || kindMatch[2] || kindMatch[3] || "")
    : "";
  if (kind === "digest" || kind === "references" || kind === "citation-analysis") {
    return kind;
  }
  if (kind === "literature-digest") {
    return "digest";
  }

  const hasDigestHeading =
    /<h1[^>]*>\s*Digest\s*<\/h1>/i.test(text) ||
    /<p[^>]*>\s*(?:<strong>)?\s*Digest\s*(?:<\/strong>)?\s*<\/p>/i.test(text) ||
    /(^|\n)\s*#\s*Digest\s*($|\n)/i.test(text) ||
    /<h1[^>]*>\s*Literature Digest\s*<\/h1>/i.test(text) ||
    /<p[^>]*>\s*(?:<strong>)?\s*Literature Digest\s*(?:<\/strong>)?\s*<\/p>/i.test(
      text,
    ) ||
    /(^|\n)\s*#\s*Literature Digest\s*($|\n)/i.test(text);
  const hasReferencesHeading =
    /<h1[^>]*>\s*References(?:\s+JSON)?\s*<\/h1>/i.test(text) ||
    /<p[^>]*>\s*(?:<strong>)?\s*References(?:\s+JSON)?\s*(?:<\/strong>)?\s*<\/p>/i.test(
      text,
    ) ||
    /(^|\n)\s*#\s*References(?:\s+JSON)?\s*($|\n)/i.test(text);
  const hasCitationHeading =
    /<h1[^>]*>\s*Citation Analysis\s*<\/h1>/i.test(text) ||
    /<p[^>]*>\s*(?:<strong>)?\s*Citation Analysis\s*(?:<\/strong>)?\s*<\/p>/i.test(
      text,
    ) ||
    /(^|\n)\s*#\s*Citation Analysis\s*($|\n)/i.test(text);

  if (hasDigestHeading) {
    return "digest";
  }
  if (hasReferencesHeading) {
    return "references";
  }
  if (hasCitationHeading) {
    return "citation-analysis";
  }

  return "";
}

export function resolveNoteReference(noteEntry) {
  if (typeof noteEntry?.item?.id === "number") {
    return noteEntry.item.id;
  }
  if (typeof noteEntry?.id === "number") {
    return noteEntry.id;
  }
  const key = String(noteEntry?.item?.key || noteEntry?.key || "").trim();
  return key || null;
}

export function normalizeNoteSelectionEntry(noteItem, runtime) {
  const parentRef = noteItem.parentItemID || null;
  const parentItem = parentRef ? requireHostItems(runtime).get(parentRef) : null;
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

export function collectCandidateNotesFromParents(selectionContext) {
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

export function collectCandidateNotes(selectionContext) {
  const directNotes = Array.isArray(selectionContext?.items?.notes)
    ? selectionContext.items.notes
    : [];
  return [...directNotes, ...collectCandidateNotesFromParents(selectionContext)];
}

export function filterReferenceNotesSelection({ selectionContext, runtime }) {
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
    validNotes.push(normalizeNoteSelectionEntry(noteItem, runtime));
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

export function parseReferencesPayload(noteContent, runtime) {
  const payloadTagMatch = String(noteContent || "").match(
    /<span[^>]*data-zs-payload=(["'])references-json\1[^>]*>/i,
  );
  if (!payloadTagMatch) {
    throw new Error("references payload block not found in note");
  }
  const payloadTag = payloadTagMatch[0];
  const encoding = (
    readTagAttribute(payloadTag, "data-zs-encoding") || "base64"
  ).toLowerCase();
  const encodedValue = decodeHtmlEntities(
    readTagAttribute(payloadTag, "data-zs-value"),
  );
  let jsonText = "";
  if (encoding === "base64") {
    jsonText = decodeBase64Utf8(encodedValue, runtime);
  } else if (encoding === "plain" || encoding === "utf8") {
    jsonText = encodedValue;
  } else {
    throw new Error(`Unsupported references payload encoding: ${encoding}`);
  }

  let payload = null;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new Error("references payload JSON is malformed");
  }
  const normalizeReferencesPayload =
    typeof runtime?.helpers?.normalizeReferencesPayload === "function"
      ? runtime.helpers.normalizeReferencesPayload.bind(runtime.helpers)
      : (input) => {
          const references = Array.isArray(input?.references) ? input.references : [];
          return references;
        };
  const references = normalizeReferencesPayload(payload);
  return {
    payload,
    references,
    payloadTag,
  };
}

export function replaceReferencesTable(noteContent, tableHtml) {
  const pattern =
    /<table[^>]*data-zs-view=(["'])references-table\1[^>]*>[\s\S]*?<\/table>/i;
  if (pattern.test(noteContent)) {
    return String(noteContent).replace(pattern, tableHtml);
  }
  const payloadTagPattern =
    /<span[^>]*data-zs-payload=(["'])references-json\1[^>]*>/i;
  if (payloadTagPattern.test(noteContent)) {
    return String(noteContent).replace(payloadTagPattern, `${tableHtml}$&`);
  }
  return `${String(noteContent || "")}\n${tableHtml}`;
}

export function updatePayloadBlock(noteContent, payloadTag, nextPayload, runtime) {
  const nextEncoded = encodeBase64Utf8(JSON.stringify(nextPayload), runtime);
  let nextTag = setTagAttribute(payloadTag, "data-zs-encoding", "base64");
  nextTag = setTagAttribute(nextTag, "data-zs-value", nextEncoded);
  return String(noteContent).replace(payloadTag, nextTag);
}

export function parseReferencesNoteKind(noteContent) {
  return parseNoteKind(noteContent);
}

export function resolveSelectedReferenceNote({ runResult, runtime, workflowId }) {
  const normalizedWorkflowId = String(workflowId || "references-note-workflow").trim();
  const selectionContext = runResult?.resultJson?.selectionContext;
  const notes = Array.isArray(selectionContext?.items?.notes)
    ? selectionContext.items.notes
    : [];
  if (notes.length !== 1) {
    throw new Error(
      `${normalizedWorkflowId} expects exactly one selected references note, got ${notes.length}`,
    );
  }
  const noteRef =
    typeof notes[0]?.item?.id === "number"
      ? notes[0].item.id
      : String(notes[0]?.item?.key || "").trim();
  if (!noteRef) {
    throw new Error(`${normalizedWorkflowId} cannot resolve selected note reference`);
  }
  const noteItem = runtime.helpers.resolveItemRef(noteRef);
  const noteContent = String(noteItem.getNote?.() || "");
  if (parseReferencesNoteKind(noteContent) !== "references") {
    throw new Error("selected note is not a references note");
  }
  return {
    noteItem,
    noteContent,
  };
}
