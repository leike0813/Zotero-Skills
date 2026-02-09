function pickByParentFromSelectedAttachments(
  selectedAttachments,
  selectedParentIds,
  helpers,
) {
  const groupedByParent = new Map();
  const selectedPdfByParent = new Map();

  for (const entry of selectedAttachments) {
    const parentId = helpers.getAttachmentParentId(entry);
    if (!parentId || selectedParentIds.has(parentId)) {
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

function pickBySelectedParents(selectedParents, helpers) {
  const chosen = [];
  for (const parent of selectedParents) {
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
