function compareByDateAndName(left, right, helpers) {
  const dateDelta =
    helpers.getAttachmentDateAdded(left) - helpers.getAttachmentDateAdded(right);
  if (dateDelta !== 0) {
    return dateDelta;
  }
  return helpers
    .getAttachmentFileName(left)
    .localeCompare(helpers.getAttachmentFileName(right));
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

  const sortedMds = [...mdEntries].sort((a, b) => compareByDateAndName(a, b, helpers));
  return sortedMds[0] || null;
}

function chooseSourceByPolicy(mdEntries, pdfEntries, helpers) {
  if (mdEntries.length > 0) {
    if (mdEntries.length === 1) {
      return mdEntries[0];
    }
    return chooseMarkdownByPdfOrEarliest(mdEntries, pdfEntries, helpers);
  }
  if (pdfEntries.length > 0) {
    const sortedPdfs = [...pdfEntries].sort((a, b) =>
      compareByDateAndName(a, b, helpers),
    );
    return sortedPdfs[0] || null;
  }
  return null;
}

function pickByParentFromSelectedAttachments(
  selectedAttachments,
  selectedParentIds,
  helpers,
  runtime,
  skipCache,
) {
  const groupedByParent = new Map();

  for (const entry of selectedAttachments) {
    const parentId = helpers.getAttachmentParentId(entry);
    if (!parentId || selectedParentIds.has(parentId)) {
      continue;
    }
    if (hasAllGeneratedNotes(parentId, runtime, skipCache)) {
      continue;
    }
    if (!helpers.isMarkdownAttachment(entry) && !helpers.isPdfAttachment(entry)) {
      continue;
    }
    const bucket = groupedByParent.get(parentId) || { mdEntries: [], pdfEntries: [] };
    if (helpers.isMarkdownAttachment(entry)) {
      bucket.mdEntries.push(entry);
    } else if (helpers.isPdfAttachment(entry)) {
      bucket.pdfEntries.push(entry);
    }
    groupedByParent.set(parentId, bucket);
  }

  const chosen = [];
  for (const [, grouped] of groupedByParent.entries()) {
    const resolved = chooseSourceByPolicy(
      grouped.mdEntries,
      grouped.pdfEntries,
      helpers,
    );
    if (resolved) {
      chosen.push(resolved);
    }
  }
  return chosen;
}

function pickBySelectedParents(selectedParents, helpers, runtime, skipCache) {
  const chosen = [];
  for (const parent of selectedParents) {
    const parentId = parent?.item?.id;
    if (!parentId) {
      continue;
    }
    if (hasAllGeneratedNotes(parentId, runtime, skipCache)) {
      continue;
    }
    const allAttachments = parent?.attachments || [];
    const mdEntries = allAttachments.filter((entry) =>
      helpers.isMarkdownAttachment(entry),
    );
    const pdfEntries = allAttachments.filter((entry) =>
      helpers.isPdfAttachment(entry),
    );
    const resolved = chooseSourceByPolicy(mdEntries, pdfEntries, helpers);
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

function hasAllGeneratedNotes(parentId, runtime, cache) {
  if (!parentId || cache.has(parentId)) {
    return cache.get(parentId) === true;
  }

  let hasDigest = false;
  let hasReferences = false;
  let hasCitationAnalysis = false;
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
      if (kind === "citation-analysis") {
        hasCitationAnalysis = true;
      }
      if (hasDigest && hasReferences && hasCitationAnalysis) {
        break;
      }
    }
    if (typeof console !== "undefined") {
      console.info(
        `[literature-digest/filterInputs] parent=${parentId} notes=${noteIds.length} digest=${hasDigest} references=${hasReferences} citationAnalysis=${hasCitationAnalysis}`,
      );
    }
  } catch {
    // ignore note scan failures and keep workflow runnable
  }

  const matched = hasDigest && hasReferences && hasCitationAnalysis;
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
