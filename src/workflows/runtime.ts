import { handlers } from "../handlers";
import { getBaseName } from "../utils/path";
import { createHookHelpers } from "./helpers";
import { compileDeclarativeRequest } from "./declarativeRequestCompiler";
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
  parent?: { id?: number | null; title?: string } | null;
};

type ParentLike = {
  item?: { id?: number; title?: string };
};

type NoteLike = {
  item?: { id?: number };
};

type SelectionLike = {
  items?: {
    attachments?: AttachmentLike[];
    parents?: Array<ParentLike & { attachments?: AttachmentLike[] }>;
    children?: Array<{
      item?: { id?: number; title?: string };
      parent?: { id?: number | null; title?: string } | null;
      attachments?: AttachmentLike[];
    }>;
    notes?: NoteLike[];
  };
  summary?: {
    parentCount?: number;
    childCount?: number;
    attachmentCount?: number;
    noteCount?: number;
  };
};

type ResolvedSelectionContexts = {
  contexts: SelectionLike[];
  totalUnits: number;
};

type BuildRequestStats = {
  totalUnits: number;
  requestCount: number;
  skippedUnits: number;
};

type BuildRequestsResult = unknown[] & {
  __stats?: BuildRequestStats;
};

function resolveTargetParentIDFromSelection(selectionContext: SelectionLike) {
  const attachmentParentID = selectionContext?.items?.attachments?.[0]?.parent?.id;
  if (attachmentParentID) {
    return attachmentParentID;
  }
  const selectedParentID = selectionContext?.items?.parents?.[0]?.item?.id;
  if (selectedParentID) {
    return selectedParentID;
  }
  const childParentID = selectionContext?.items?.children?.[0]?.parent?.id;
  if (childParentID) {
    return childParentID;
  }
  const childID = selectionContext?.items?.children?.[0]?.item?.id;
  if (childID) {
    return childID;
  }
  return null;
}

function resolveSourceAttachmentPathsFromSelection(selectionContext: SelectionLike) {
  const paths = collectAttachmentCandidates(selectionContext)
    .map((entry) => String(entry.filePath || "").trim())
    .filter(Boolean);
  return Array.from(new Set(paths));
}

function resolveTaskNameFromSelection(args: {
  selectionContext: SelectionLike;
  targetParentID: number | null;
  sourceAttachmentPaths: string[];
}) {
  if (args.sourceAttachmentPaths.length > 0) {
    return getBaseName(args.sourceAttachmentPaths[0]);
  }
  const parentTitle =
    args.selectionContext?.items?.attachments?.[0]?.parent?.title ||
    args.selectionContext?.items?.parents?.[0]?.item?.title ||
    args.selectionContext?.items?.children?.[0]?.parent?.title ||
    args.selectionContext?.items?.children?.[0]?.item?.title ||
    "";
  if (String(parentTitle || "").trim()) {
    return String(parentTitle).trim();
  }
  if (args.targetParentID) {
    return `item-${args.targetParentID}`;
  }
  return "task";
}

function enrichRequestWithSelectionMeta(
  request: unknown,
  selectionContext: SelectionLike,
) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new Error("buildRequest must return an object request payload");
  }
  const normalized = {
    ...(request as Record<string, unknown>),
  };
  const targetParentID = resolveTargetParentIDFromSelection(selectionContext);
  if (typeof normalized.targetParentID !== "number" && targetParentID) {
    normalized.targetParentID = targetParentID;
  }

  const sourceAttachmentPaths =
    Array.isArray(normalized.sourceAttachmentPaths) &&
    normalized.sourceAttachmentPaths.length > 0
      ? normalized.sourceAttachmentPaths
          .map((entry) => String(entry || "").trim())
          .filter(Boolean)
      : resolveSourceAttachmentPathsFromSelection(selectionContext);
  normalized.sourceAttachmentPaths = sourceAttachmentPaths;

  const taskName =
    typeof normalized.taskName === "string" ? normalized.taskName.trim() : "";
  if (!taskName) {
    normalized.taskName = resolveTaskNameFromSelection({
      selectionContext,
      targetParentID:
        typeof normalized.targetParentID === "number"
          ? normalized.targetParentID
          : targetParentID,
      sourceAttachmentPaths,
    });
  }
  return normalized;
}

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
}): Promise<ResolvedSelectionContexts> {
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
  const totalUnitsBeforeHook = split.valid.length + split.ambiguousParents.size;

  if (args.workflow.hooks.filterInputs) {
    const fromHook = (await args.workflow.hooks.filterInputs({
      selectionContext: declarativeFiltered,
      manifest: args.workflow.manifest,
      runtime: args.runtime,
    })) as SelectionLike;

    const hookSelection = copySelection(fromHook);
    const hookDirectAttachments = hookSelection.items?.attachments;
    const hookSourceAttachments = Array.isArray(hookDirectAttachments)
      ? (hookDirectAttachments as AttachmentLike[])
      : collectAttachmentCandidates(hookSelection);
    const hookAttachments = applyAttachmentMimeFilter(
      hookSourceAttachments,
      allowedMimes,
    );
    split = splitAttachmentsByPerParentRules({
      attachments: hookAttachments,
      min: perParentMin,
      max: perParentMax,
    });
  }

  const contexts = split.valid.map((entry) =>
    withScopedAttachments(copied, [entry], args.runtime),
  );
  return {
    contexts,
    totalUnits: totalUnitsBeforeHook,
  };
}

async function resolveSelectionContexts(args: {
  workflow: LoadedWorkflow;
  selectionContext: unknown;
  runtime: WorkflowRuntimeContext;
}): Promise<ResolvedSelectionContexts> {
  const unit = args.workflow.manifest.inputs?.unit || "attachment";
  if (unit === "parent") {
    const contexts = buildParentSelectionUnits(copySelection(args.selectionContext));
    return {
      contexts,
      totalUnits: contexts.length,
    };
  }
  if (unit === "note") {
    const contexts = buildNoteSelectionUnits(copySelection(args.selectionContext));
    return {
      contexts,
      totalUnits: contexts.length,
    };
  }
  return resolveAttachmentSelectionUnits(args);
}

export async function executeBuildRequests(args: {
  workflow: LoadedWorkflow;
  selectionContext: unknown;
  executionOptions?: {
    workflowParams?: Record<string, unknown>;
    providerOptions?: Record<string, unknown>;
  };
  runtime?: Partial<WorkflowRuntimeContext>;
}) {
  const runtime = createRuntimeContext(args.runtime);
  const resolved = await resolveSelectionContexts({
    workflow: args.workflow,
    selectionContext: args.selectionContext,
    runtime,
  });
  const resolvedSelections = resolved.contexts;

  if (resolvedSelections.length === 0) {
    throw new Error(
      `Workflow ${args.workflow.manifest.id} has no valid input units after filtering`,
    );
  }

  const requests: BuildRequestsResult = [];
  for (const selectionContext of resolvedSelections) {
    if (args.workflow.hooks.buildRequest) {
      requests.push(
        enrichRequestWithSelectionMeta(
          await args.workflow.hooks.buildRequest({
            selectionContext,
            manifest: args.workflow.manifest,
            executionOptions: args.executionOptions,
            runtime,
          }),
          selectionContext,
        ),
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
      enrichRequestWithSelectionMeta(
        compileDeclarativeRequest({
          kind: request.kind,
          selectionContext,
          manifest: args.workflow.manifest,
          executionOptions: args.executionOptions,
        }),
        selectionContext,
      ),
    );
  }
  const skippedUnits = Math.max(0, resolved.totalUnits - requests.length);
  Object.defineProperty(requests, "__stats", {
    value: {
      totalUnits: resolved.totalUnits,
      requestCount: requests.length,
      skippedUnits,
    } satisfies BuildRequestStats,
    enumerable: false,
    configurable: true,
    writable: false,
  });

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
