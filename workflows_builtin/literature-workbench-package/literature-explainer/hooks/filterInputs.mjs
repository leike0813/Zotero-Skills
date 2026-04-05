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

  const sortedMds = [...mdEntries].sort((a, b) =>
    compareByDateAndName(a, b, helpers),
  );
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
) {
  const groupedByParent = new Map();

  for (const entry of selectedAttachments) {
    const parentId = helpers.getAttachmentParentId(entry);
    if (!parentId || selectedParentIds.has(parentId)) {
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

function pickBySelectedParents(selectedParents, helpers) {
  const chosen = [];
  for (const parent of selectedParents) {
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

export function filterInputs({ selectionContext, runtime }) {
  const helpers = runtime.helpers;
  const selectedParents = selectionContext?.items?.parents || [];
  const selectedAttachments = selectionContext?.items?.attachments || [];
  const selectedParentIds = new Set(
    selectedParents.map((entry) => entry?.item?.id).filter(Boolean),
  );

  const fromParents = pickBySelectedParents(selectedParents, helpers);
  const fromSelectedAttachments = pickByParentFromSelectedAttachments(
    selectedAttachments,
    selectedParentIds,
    helpers,
  );

  const byParent = new Map();
  for (const entry of [...fromParents, ...fromSelectedAttachments]) {
    const parentId = helpers.getAttachmentParentId(entry);
    if (!parentId || byParent.has(parentId)) {
      continue;
    }
    byParent.set(parentId, entry);
  }

  return helpers.withFilteredAttachments(
    selectionContext,
    Array.from(byParent.values()),
  );
}

