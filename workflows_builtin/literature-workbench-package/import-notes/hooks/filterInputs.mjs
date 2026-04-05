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

export function filterInputs({ selectionContext, runtime }) {
  return withPackageRuntimeScope(runtime, () => {
    const parents = Array.isArray(selectionContext?.items?.parents)
      ? selectionContext.items.parents
      : [];
    const notes = Array.isArray(selectionContext?.items?.notes)
      ? selectionContext.items.notes
      : [];
    const attachments = Array.isArray(selectionContext?.items?.attachments)
      ? selectionContext.items.attachments
      : [];
    const children = Array.isArray(selectionContext?.items?.children)
      ? selectionContext.items.children
      : [];

    if (
      parents.length !== 1 ||
      notes.length > 0 ||
      attachments.length > 0 ||
      children.length > 0
    ) {
      return null;
    }

    const cloned = cloneSelectionContext(selectionContext);
    cloned.items = {
      parents: [parents[0]],
      notes: [],
      attachments: [],
      children: [],
    };
    cloned.summary = resetSummary(cloned.summary);
    cloned.summary.parentCount = 1;
    cloned.selectionType = "parent";
    return cloned;
  });
}
