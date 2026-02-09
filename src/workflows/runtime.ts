import { handlers } from "../handlers";
import { createHookHelpers } from "./helpers";
import { buildRequestFromManifest } from "./requestBuilders";
import type {
  LoadedWorkflow,
  WorkflowRuntimeContext,
} from "./types";

type AttachmentLike = {
  item?: {
    id?: number;
    title?: string;
    parentItemID?: number | null;
    data?: { contentType?: string };
  };
  filePath?: string | null;
  mimeType?: string | null;
  parent?: { id?: number | null } | null;
};

type ParentLike = {
  item?: { id?: number };
};

type NoteLike = {
  item?: { id?: number };
};

type SelectionLike = {
  items?: {
    attachments?: AttachmentLike[];
    parents?: Array<ParentLike & { attachments?: AttachmentLike[] }>;
    children?: Array<{ attachments?: AttachmentLike[] }>;
    notes?: NoteLike[];
  };
  summary?: {
    parentCount?: number;
    childCount?: number;
    attachmentCount?: number;
    noteCount?: number;
  };
};

function createRuntimeContext(
  override?: Partial<WorkflowRuntimeContext>,
): WorkflowRuntimeContext {
  const zotero = override?.zotero || Zotero;
  return {
    handlers: override?.handlers || handlers,
    zotero,
    helpers: override?.helpers || createHookHelpers(zotero),
  };
}

function copySelection(selectionContext: unknown): SelectionLike {
  if (!selectionContext || typeof selectionContext !== "object") {
    return {};
  }
  return JSON.parse(JSON.stringify(selectionContext)) as SelectionLike;
}

function flattenAttachments(selection: SelectionLike) {
  const items = selection.items || {};
  const direct = Array.isArray(items.attachments) ? items.attachments : [];
  const fromParents = (Array.isArray(items.parents) ? items.parents : [])
    .flatMap((entry) => entry.attachments || [])
    .filter(Boolean);
  const fromChildren = (Array.isArray(items.children) ? items.children : [])
    .flatMap((entry) => entry.attachments || [])
    .filter(Boolean);
  const merged = [...direct, ...fromParents, ...fromChildren];
  const seen = new Set<string>();
  const deduped: AttachmentLike[] = [];
  for (const entry of merged) {
    const key =
      typeof entry.item?.id === "number"
        ? `id:${entry.item.id}`
        : `file:${entry.filePath || ""}|parent:${getAttachmentParentId(entry) || ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}

function collectAttachmentCandidates(selection: SelectionLike) {
  const direct = selection.items?.attachments || [];
  if (direct.length > 0) {
    return flattenAttachments({
      items: {
        attachments: direct,
        parents: [],
        children: [],
      },
    });
  }
  return flattenAttachments(selection);
}

function getAttachmentMime(entry: AttachmentLike) {
  return (entry.mimeType || entry.item?.data?.contentType || "").trim();
}

function getAttachmentParentId(entry: AttachmentLike) {
  return entry.parent?.id || entry.item?.parentItemID || null;
}

function applyAttachmentMimeFilter(
  attachments: AttachmentLike[],
  mimes: string[] | undefined,
) {
  if (!mimes || mimes.length === 0) {
    return attachments;
  }
  return attachments.filter((entry) => {
    const mime = getAttachmentMime(entry);
    if (mime && mimes.includes(mime)) {
      return true;
    }
    const filePath = String(entry.filePath || "").toLowerCase();
    if (
      filePath.endsWith(".md") &&
      (mimes.includes("text/markdown") ||
        mimes.includes("text/x-markdown") ||
        mimes.includes("text/plain"))
    ) {
      return true;
    }
    if (filePath.endsWith(".pdf") && mimes.includes("application/pdf")) {
      return true;
    }
    return false;
  });
}

function splitAttachmentsByPerParentRules(args: {
  attachments: AttachmentLike[];
  min: number;
  max: number;
}) {
  const byParent = new Map<number, AttachmentLike[]>();
  const valid: AttachmentLike[] = [];
  const ambiguousParents = new Set<number>();

  for (const entry of args.attachments) {
    const parentId = getAttachmentParentId(entry);
    if (!parentId) {
      continue;
    }
    const entries = byParent.get(parentId) || [];
    entries.push(entry);
    byParent.set(parentId, entries);
  }

  for (const [parentId, entries] of byParent.entries()) {
    if (entries.length < args.min) {
      continue;
    }
    if (entries.length > args.max) {
      ambiguousParents.add(parentId);
      continue;
    }
    valid.push(...entries);
  }
  return { valid, ambiguousParents };
}

function withScopedAttachments(
  selection: SelectionLike,
  attachments: AttachmentLike[],
  runtime: WorkflowRuntimeContext,
) {
  return runtime.helpers.withFilteredAttachments(
    selection,
    attachments as unknown[],
  ) as SelectionLike;
}

function buildParentSelectionUnits(selection: SelectionLike) {
  const parents = selection.items?.parents || [];
  return parents.map((parent) => {
    const cloned = copySelection(selection);
    if (!cloned.items) {
      cloned.items = {};
    }
    cloned.items.parents = [parent];
    cloned.items.attachments = [];
    cloned.items.children = [];
    cloned.items.notes = [];
    if (!cloned.summary) {
      cloned.summary = {};
    }
    cloned.summary.parentCount = 1;
    cloned.summary.attachmentCount = 0;
    cloned.summary.childCount = 0;
    cloned.summary.noteCount = 0;
    return cloned;
  });
}

function buildNoteSelectionUnits(selection: SelectionLike) {
  const notes = selection.items?.notes || [];
  return notes.map((note) => {
    const cloned = copySelection(selection);
    if (!cloned.items) {
      cloned.items = {};
    }
    cloned.items.notes = [note];
    cloned.items.attachments = [];
    cloned.items.children = [];
    cloned.items.parents = [];
    if (!cloned.summary) {
      cloned.summary = {};
    }
    cloned.summary.noteCount = 1;
    cloned.summary.attachmentCount = 0;
    cloned.summary.childCount = 0;
    cloned.summary.parentCount = 0;
    return cloned;
  });
}

async function resolveAttachmentSelectionUnits(args: {
  workflow: LoadedWorkflow;
  selectionContext: unknown;
  runtime: WorkflowRuntimeContext;
}) {
  const copied = copySelection(args.selectionContext);
  const inputs = args.workflow.manifest.inputs;
  const allowedMimes = inputs?.accepts?.mime;
  const perParentMin = Math.max(0, inputs?.per_parent?.min ?? 0);
  const rawMax = inputs?.per_parent?.max ?? Number.POSITIVE_INFINITY;
  const perParentMax = Math.max(perParentMin, rawMax);

  const candidates = applyAttachmentMimeFilter(
    collectAttachmentCandidates(copied),
    allowedMimes,
  );
  const declarativeFiltered = withScopedAttachments(
    copied,
    candidates,
    args.runtime,
  );

  let split = splitAttachmentsByPerParentRules({
    attachments: candidates,
    min: perParentMin,
    max: perParentMax,
  });

  if (split.ambiguousParents.size > 0 && args.workflow.hooks.filterInputs) {
    const fromHook = (await args.workflow.hooks.filterInputs({
      selectionContext: declarativeFiltered,
      manifest: args.workflow.manifest,
      runtime: args.runtime,
    })) as SelectionLike;

    const hookAttachments = applyAttachmentMimeFilter(
      collectAttachmentCandidates(copySelection(fromHook)),
      allowedMimes,
    );
    split = splitAttachmentsByPerParentRules({
      attachments: hookAttachments,
      min: perParentMin,
      max: perParentMax,
    });
  }

  return split.valid.map((entry) =>
    withScopedAttachments(copied, [entry], args.runtime),
  );
}

async function resolveSelectionContexts(args: {
  workflow: LoadedWorkflow;
  selectionContext: unknown;
  runtime: WorkflowRuntimeContext;
}) {
  const unit = args.workflow.manifest.inputs?.unit || "attachment";
  if (unit === "parent") {
    return buildParentSelectionUnits(copySelection(args.selectionContext));
  }
  if (unit === "note") {
    return buildNoteSelectionUnits(copySelection(args.selectionContext));
  }
  return resolveAttachmentSelectionUnits(args);
}

export async function executeBuildRequests(args: {
  workflow: LoadedWorkflow;
  selectionContext: unknown;
  runtime?: Partial<WorkflowRuntimeContext>;
}) {
  const runtime = createRuntimeContext(args.runtime);
  const resolvedSelections = await resolveSelectionContexts({
    workflow: args.workflow,
    selectionContext: args.selectionContext,
    runtime,
  });

  if (resolvedSelections.length === 0) {
    throw new Error(
      `Workflow ${args.workflow.manifest.id} has no valid input units after filtering`,
    );
  }

  const requests = [];
  for (const selectionContext of resolvedSelections) {
    if (args.workflow.hooks.buildRequest) {
      requests.push(
        await args.workflow.hooks.buildRequest({
          selectionContext,
          manifest: args.workflow.manifest,
          runtime,
        }),
      );
      continue;
    }

    const request = args.workflow.manifest.request;
    if (!request?.kind) {
      throw new Error(
        `Workflow ${args.workflow.manifest.id} missing buildRequest hook and request declaration`,
      );
    }

    requests.push(
      buildRequestFromManifest({
        kind: request.kind,
        selectionContext,
        manifest: args.workflow.manifest,
      }),
    );
  }
  return requests;
}

export async function executeApplyResult(args: {
  workflow: LoadedWorkflow;
  parent: Zotero.Item | number | string;
  bundleReader: { readText: (entryPath: string) => Promise<string> };
  runResult?: unknown;
  runtime?: Partial<WorkflowRuntimeContext>;
}) {
  const runtime = createRuntimeContext(args.runtime);
  return args.workflow.hooks.applyResult({
    parent: args.parent,
    bundleReader: args.bundleReader,
    runResult: args.runResult,
    manifest: args.workflow.manifest,
    runtime,
  });
}
