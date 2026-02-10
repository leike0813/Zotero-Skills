function pickByParentFromSelectedAttachments(
  selectedAttachments,
  selectedParentIds,
  helpers,
  runtime,
  skipCache,
) {
  const groupedByParent = new Map();
  const selectedPdfByParent = new Map();

  for (const entry of selectedAttachments) {
    const parentId = helpers.getAttachmentParentId(entry);
    if (!parentId || selectedParentIds.has(parentId)) {
      continue;
    }
    if (hasBothDigestAndReferencesNotes(parentId, runtime, skipCache)) {
      continue;
    }
    if (helpers.isPdfAttachment(entry)) {
      const existingPdfs = selectedPdfByParent.get(parentId) || [];
      existingPdfs.push(entry);
      selectedPdfByParent.set(parentId, existingPdfs);
      continue;
    }
    if (!helpers.isMarkdownAttachment(entry)) {
      continue;
    }
    const existing = groupedByParent.get(parentId) || [];
    existing.push(entry);
    groupedByParent.set(parentId, existing);
  }

  const chosen = [];
  for (const [parentId, mdEntries] of groupedByParent.entries()) {
    if (mdEntries.length === 1) {
      chosen.push(mdEntries[0]);
      continue;
    }
    const pdfEntries = selectedPdfByParent.get(parentId) || [];
    const resolved = chooseMarkdownByPdfOrEarliest(mdEntries, pdfEntries, helpers);
    if (resolved) {
      chosen.push(resolved);
    }
  }
  return chosen;
}

function chooseMarkdownByPdfOrEarliest(mdEntries, pdfEntries, helpers) {
  const earliestPdf = helpers.pickEarliestPdfAttachment(pdfEntries);
  if (earliestPdf) {
    const stem = helpers.getAttachmentFileStem(earliestPdf);
    const matched = mdEntries.find(
      (entry) => helpers.getAttachmentFileStem(entry) === stem,
    );
    if (matched) {
      return matched;
    }
  }

  const sortedMds = [...mdEntries].sort((a, b) => {
    const delta =
      helpers.getAttachmentDateAdded(a) - helpers.getAttachmentDateAdded(b);
    if (delta !== 0) {
      return delta;
    }
    return helpers
      .getAttachmentFileName(a)
      .localeCompare(helpers.getAttachmentFileName(b));
  });
  return sortedMds[0] || null;
}

function pickBySelectedParents(selectedParents, helpers, runtime, skipCache) {
  const chosen = [];
  for (const parent of selectedParents) {
    const parentId = parent?.item?.id;
    if (!parentId) {
      continue;
    }
    if (hasBothDigestAndReferencesNotes(parentId, runtime, skipCache)) {
      continue;
    }
    const allAttachments = parent?.attachments || [];
    const mdEntries = allAttachments.filter((entry) =>
      helpers.isMarkdownAttachment(entry),
    );
    if (mdEntries.length === 0) {
      continue;
    }
    if (mdEntries.length === 1) {
      chosen.push(mdEntries[0]);
      continue;
    }
    const pdfEntries = allAttachments.filter((entry) =>
      helpers.isPdfAttachment(entry),
    );
    const resolved = chooseMarkdownByPdfOrEarliest(mdEntries, pdfEntries, helpers);
    if (resolved) {
      chosen.push(resolved);
    }
  }
  return chosen;
}

function parseGeneratedNoteKind(noteContent) {
  const text = String(noteContent || "");

  if (/data-zs-payload=(["'])digest-markdown\1/i.test(text)) {
    return "digest";
  }
  if (/data-zs-payload=(["'])references-json\1/i.test(text)) {
    return "references";
  }

  const kindMatch = text.match(
    /data-zs-note-kind\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
  );
  const kind = kindMatch
    ? String(kindMatch[1] || kindMatch[2] || kindMatch[3] || "")
    : "";
  if (kind === "digest" || kind === "references") {
    return kind;
  }
  if (kind === "literature-digest") {
    return "digest";
  }

  const hasDigestHeading =
    /<h1[^>]*>\s*Digest\s*<\/h1>/i.test(text) ||
    /<p[^>]*>\s*(?:<strong>)?\s*Digest\s*(?:<\/strong>)?\s*<\/p>/i.test(
      text,
    ) ||
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

  if (hasDigestHeading) {
    return "digest";
  }
  if (hasReferencesHeading) {
    return "references";
  }

  return "";
}

function hasBothDigestAndReferencesNotes(parentId, runtime, cache) {
  if (!parentId || cache.has(parentId)) {
    return cache.get(parentId) === true;
  }

  let hasDigest = false;
  let hasReferences = false;
  try {
    const parentItem = runtime.helpers.resolveItemRef(parentId);
    const noteIds = parentItem.getNotes?.() || [];
    for (const noteRef of noteIds) {
      let noteItem;
      try {
        noteItem = runtime.helpers.resolveItemRef(noteRef);
      } catch {
        noteItem = null;
      }
      if (!noteItem) {
        continue;
      }
      const kind = parseGeneratedNoteKind(noteItem.getNote?.() || "");
      if (kind === "digest") {
        hasDigest = true;
      }
      if (kind === "references") {
        hasReferences = true;
      }
      if (hasDigest && hasReferences) {
        break;
      }
    }
    if (typeof console !== "undefined") {
      console.info(
        `[literature-digest/filterInputs] parent=${parentId} notes=${noteIds.length} digest=${hasDigest} references=${hasReferences}`,
      );
    }
  } catch {
    // ignore note scan failures and keep workflow runnable
  }

  const matched = hasDigest && hasReferences;
  cache.set(parentId, matched);
  return matched;
}

export function filterInputs({ selectionContext, runtime }) {
  const helpers = runtime.helpers;
  const selectedParents = selectionContext?.items?.parents || [];
  const selectedAttachments = selectionContext?.items?.attachments || [];
  const skipCache = new Map();
  const selectedParentIds = new Set(
    selectedParents.map((entry) => entry?.item?.id).filter(Boolean),
  );

  const fromParents = pickBySelectedParents(
    selectedParents,
    helpers,
    runtime,
    skipCache,
  );
  const fromSelectedAttachments = pickByParentFromSelectedAttachments(
    selectedAttachments,
    selectedParentIds,
    helpers,
    runtime,
    skipCache,
  );

  const byParent = new Map();
  for (const entry of [...fromParents, ...fromSelectedAttachments]) {
    const parentId = helpers.getAttachmentParentId(entry);
    if (!parentId || byParent.has(parentId)) {
      continue;
    }
    byParent.set(parentId, entry);
  }

  if (typeof console !== "undefined") {
    const skippedParentIds = Array.from(skipCache.entries())
      .filter(([, matched]) => matched)
      .map(([parentId]) => parentId);
    if (skippedParentIds.length > 0) {
      console.info(
        `[literature-digest/filterInputs] skipped parents due to existing notes: ${JSON.stringify(skippedParentIds)}`,
      );
    }
  }

  return helpers.withFilteredAttachments(
    selectionContext,
    Array.from(byParent.values()),
  );
}
