import { handlers } from "../handlers";
import { getBaseName } from "../utils/path";
import { createHookHelpers } from "./helpers";
import { compileDeclarativeRequest } from "./declarativeRequestCompiler";
import {
  PASS_THROUGH_BACKEND_TYPE,
  PASS_THROUGH_REQUEST_KIND,
} from "../config/defaults";
import { assertRequestPayloadContract } from "../providers/requestContracts";
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
  item?: { id?: number; title?: string };
  parent?: { id?: number | null; title?: string } | null;
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

type NoValidInputUnitsError = Error & {
  code: "NO_VALID_INPUT_UNITS";
  workflowId: string;
  totalUnits: number;
  skippedUnits: number;
};

function createNoValidInputUnitsError(args: {
  workflowId: string;
  totalUnits: number;
}): NoValidInputUnitsError {
  const error = new Error(
    `Workflow ${args.workflowId} has no valid input units after filtering`,
  ) as NoValidInputUnitsError;
  error.name = "NoValidInputUnitsError";
  error.code = "NO_VALID_INPUT_UNITS";
  error.workflowId = args.workflowId;
  error.totalUnits = Math.max(0, Number(args.totalUnits || 0));
  error.skippedUnits = error.totalUnits;
  return error;
}

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
  const noteParentID = selectionContext?.items?.notes?.[0]?.parent?.id;
  if (noteParentID) {
    return noteParentID;
  }
  const noteID = selectionContext?.items?.notes?.[0]?.item?.id;
  if (noteID) {
    return noteID;
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
    args.selectionContext?.items?.notes?.[0]?.parent?.title ||
    args.selectionContext?.items?.notes?.[0]?.item?.title ||
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

function hasAnySelectionItems(selectionContext: SelectionLike) {
  const items = selectionContext?.items || {};
  const attachmentCount = Array.isArray(items.attachments)
    ? items.attachments.length
    : 0;
  const parentCount = Array.isArray(items.parents) ? items.parents.length : 0;
  const childCount = Array.isArray(items.children) ? items.children.length : 0;
  const noteCount = Array.isArray(items.notes) ? items.notes.length : 0;
  return attachmentCount + parentCount + childCount + noteCount > 0;
}

function getSelectionItemCounts(selectionContext: SelectionLike) {
  const items = selectionContext?.items || {};
  return {
    attachments: Array.isArray(items.attachments) ? items.attachments.length : 0,
    parents: Array.isArray(items.parents) ? items.parents.length : 0,
    children: Array.isArray(items.children) ? items.children.length : 0,
    notes: Array.isArray(items.notes) ? items.notes.length : 0,
  };
}

function countNonZeroKinds(counts: {
  attachments: number;
  parents: number;
  children: number;
  notes: number;
}) {
  return [
    counts.attachments > 0,
    counts.parents > 0,
    counts.children > 0,
    counts.notes > 0,
  ].filter(Boolean).length;
}

function estimatePassThroughTotalUnits(selectionContext: SelectionLike) {
  const counts = getSelectionItemCounts(selectionContext);
  const nonZeroKinds = countNonZeroKinds(counts);
  if (nonZeroKinds === 0) {
    return 1;
  }
  if (nonZeroKinds > 1) {
    return 1;
  }
  if (counts.notes > 0) {
    return counts.notes;
  }
  if (counts.parents > 0) {
    return counts.parents;
  }
  if (counts.children > 0) {
    return counts.children;
  }
  if (counts.attachments > 0) {
    return counts.attachments;
  }
  return 1;
}

function splitPassThroughSelectionUnits(selection: SelectionLike) {
  const counts = getSelectionItemCounts(selection);
  const nonZeroKinds = countNonZeroKinds(counts);
  if (nonZeroKinds !== 1) {
    return [selection];
  }
  if (counts.notes > 1) {
    return buildNoteSelectionUnits(selection);
  }
  if (counts.parents > 1) {
    return buildParentSelectionUnits(selection);
  }
  return [selection];
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
  const isPassThroughWorkflow =
    String(args.workflow.manifest.provider || "").trim() ===
    PASS_THROUGH_BACKEND_TYPE;
  if (isPassThroughWorkflow && !args.workflow.manifest.inputs?.unit) {
    const passThroughTotalBeforeHook = estimatePassThroughTotalUnits(
      copySelection(args.selectionContext),
    );
    let scopedSelection = copySelection(args.selectionContext);
    if (args.workflow.hooks.filterInputs) {
      const filtered = await args.workflow.hooks.filterInputs({
        selectionContext: scopedSelection,
        manifest: args.workflow.manifest,
        runtime: args.runtime,
      });
      scopedSelection = copySelection(filtered);
    }
    if (!scopedSelection || typeof scopedSelection !== "object") {
      return {
        contexts: [],
        totalUnits: passThroughTotalBeforeHook,
      };
    }
    if (!hasAnySelectionItems(scopedSelection)) {
      return {
        contexts: [],
        totalUnits: passThroughTotalBeforeHook,
      };
    }
    const contexts = splitPassThroughSelectionUnits(scopedSelection);
    return {
      contexts,
      totalUnits: Math.max(passThroughTotalBeforeHook, contexts.length),
    };
  }

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
    throw createNoValidInputUnitsError({
      workflowId: args.workflow.manifest.id,
      totalUnits: resolved.totalUnits,
    });
  }

  const requests: BuildRequestsResult = [];
  for (const selectionContext of resolvedSelections) {
    const passThroughFallbackKind =
      String(args.workflow.manifest.provider || "").trim() ===
      PASS_THROUGH_BACKEND_TYPE
        ? PASS_THROUGH_REQUEST_KIND
        : "";
    const requestKind = String(
      args.workflow.manifest.request?.kind || passThroughFallbackKind,
    ).trim();

    if (args.workflow.hooks.buildRequest) {
      const builtRequest = enrichRequestWithSelectionMeta(
        await args.workflow.hooks.buildRequest({
          selectionContext,
          manifest: args.workflow.manifest,
          executionOptions: args.executionOptions,
          runtime,
        }),
        selectionContext,
      );
      if (requestKind) {
        assertRequestPayloadContract({
          requestKind,
          request: builtRequest,
        });
      }
      requests.push(builtRequest);
      continue;
    }

    const request = args.workflow.manifest.request;
    const requestKindFromManifest = String(
      request?.kind || passThroughFallbackKind,
    ).trim();
    if (!requestKindFromManifest) {
      throw new Error(
        `Workflow ${args.workflow.manifest.id} missing buildRequest hook and request declaration`,
      );
    }

    const compiledRequest = enrichRequestWithSelectionMeta(
      compileDeclarativeRequest({
        kind: requestKindFromManifest,
        selectionContext,
        manifest: args.workflow.manifest,
        executionOptions: args.executionOptions,
      }),
      selectionContext,
    );
    assertRequestPayloadContract({
      requestKind: requestKindFromManifest,
      request: compiledRequest,
    });
    requests.push(compiledRequest);
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
  bundleReader: {
    readText: (entryPath: string) => Promise<string>;
    getExtractedDir?: () => Promise<string>;
  };
  request?: unknown;
  runResult?: unknown;
  runtime?: Partial<WorkflowRuntimeContext>;
}) {
  const runtime = createRuntimeContext(args.runtime);
  return args.workflow.hooks.applyResult({
    parent: args.parent,
    bundleReader: args.bundleReader,
    request: args.request,
    runResult: args.runResult,
    manifest: args.workflow.manifest,
    runtime,
  });
}
