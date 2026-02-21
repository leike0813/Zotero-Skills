import { getBaseName } from "../utils/path";
import type {
  GenericHttpRequestV1,
  GenericHttpStepsRequestV1,
  PassThroughRunRequestV1,
  SkillRunnerJobRequestV1,
} from "../providers/contracts";
import { PASS_THROUGH_REQUEST_KIND } from "../config/defaults";
import {
  assertRequestKindSupported,
  assertRequestPayloadContract,
} from "../providers/requestContracts";
import type { WorkflowManifest, WorkflowRequestSpec } from "./types";

type AttachmentLike = {
  filePath?: string | null;
  mimeType?: string | null;
  parent?: { id?: number | null; title?: string; data?: { title?: string } } | null;
  item?: {
    id?: number;
    key?: string;
    title?: string;
    parentItemID?: number | null;
    data?: {
      title?: string;
      contentType?: string;
    };
  };
};

type SelectionLike = {
  items?: {
    attachments?: AttachmentLike[];
    parents?: Array<{ item?: { id?: number; title?: string; data?: { title?: string } } }>;
    children?: Array<{
      parent?: { id?: number | null; title?: string; data?: { title?: string } } | null;
      item?: { id?: number; title?: string; data?: { title?: string } };
    }>;
    notes?: Array<{
      parent?: { id?: number | null; title?: string; data?: { title?: string } } | null;
      item?: { id?: number; title?: string; data?: { title?: string } };
    }>;
  };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function resolveDefaultWorkflowParams(manifest: WorkflowManifest) {
  const schemaMap = manifest.parameters || {};
  const defaults: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(schemaMap)) {
    if (typeof schema?.default === "undefined") {
      continue;
    }
    defaults[key] = schema.default;
  }
  return defaults;
}

function resolveWorkflowParams(args: {
  manifest: WorkflowManifest;
  executionOptions?: {
    workflowParams?: Record<string, unknown>;
  };
}) {
  return {
    ...resolveDefaultWorkflowParams(args.manifest),
    ...(
      args.executionOptions?.workflowParams &&
      isObject(args.executionOptions.workflowParams)
        ? args.executionOptions.workflowParams
        : {}
    ),
  };
}

function getAttachmentMime(entry: AttachmentLike) {
  return (
    entry.mimeType ||
    entry.item?.data?.contentType ||
    ""
  ).toLowerCase();
}

function isMarkdownAttachment(entry: AttachmentLike) {
  const mime = getAttachmentMime(entry);
  if (mime === "text/markdown" || mime === "text/x-markdown") {
    return true;
  }
  const filePath = String(entry.filePath || "").toLowerCase();
  return filePath.endsWith(".md");
}

function isPdfAttachment(entry: AttachmentLike) {
  const mime = getAttachmentMime(entry);
  if (mime === "application/pdf") {
    return true;
  }
  const filePath = String(entry.filePath || "").toLowerCase();
  return filePath.endsWith(".pdf");
}

function resolveAttachmentBySelector(
  attachments: AttachmentLike[],
  selector: "selected.markdown" | "selected.pdf",
) {
  const matched = attachments.filter((entry) => {
    if (selector === "selected.markdown") {
      return isMarkdownAttachment(entry);
    }
    return isPdfAttachment(entry);
  });
  if (matched.length !== 1) {
    throw new Error(
      `Selector ${selector} requires exactly 1 matched attachment, got ${matched.length}`,
    );
  }
  const path = String(matched[0].filePath || "").trim();
  if (!path) {
    throw new Error(`Selector ${selector} resolved attachment without filePath`);
  }
  return path;
}

function resolveTargetParentID(selectionContext: unknown) {
  const selection = selectionContext as SelectionLike;
  const attachmentParentID = selection?.items?.attachments?.[0]?.parent?.id;
  if (attachmentParentID) {
    return attachmentParentID;
  }
  const selectedParentID = selection?.items?.parents?.[0]?.item?.id;
  if (selectedParentID) {
    return selectedParentID;
  }
  const childParentID = selection?.items?.children?.[0]?.parent?.id;
  if (childParentID) {
    return childParentID;
  }
  const childID = selection?.items?.children?.[0]?.item?.id;
  if (childID) {
    return childID;
  }
  const noteParentID = selection?.items?.notes?.[0]?.parent?.id;
  if (noteParentID) {
    return noteParentID;
  }
  const noteID = selection?.items?.notes?.[0]?.item?.id;
  if (noteID) {
    return noteID;
  }
  throw new Error("Cannot resolve target parent item from selection context");
}

function resolveSelectionAttachments(selectionContext: unknown) {
  const selection = selectionContext as SelectionLike;
  return (selection?.items?.attachments || []).filter(Boolean);
}

function resolveSourceAttachmentPaths(attachments: AttachmentLike[]) {
  const paths = attachments
    .map((entry) => String(entry.filePath || "").trim())
    .filter(Boolean);
  return Array.from(new Set(paths));
}

function getFileStem(filePath: string) {
  const name = getBaseName(filePath);
  if (!name) {
    return "";
  }
  return name.replace(/\.[^.]+$/, "");
}

function resolveSingleSourceAttachment(
  attachments: AttachmentLike[],
  sourceAttachmentPaths: string[],
) {
  const targetPath = sourceAttachmentPaths[0] || "";
  const matched = attachments.find(
    (entry) => String(entry.filePath || "").trim() === targetPath,
  );
  return matched || attachments[0] || null;
}

function resolveTaskName(args: {
  sourceAttachmentPaths: string[];
  selectionContext: unknown;
  targetParentID: number;
}) {
  if (args.sourceAttachmentPaths.length > 0) {
    return getBaseName(args.sourceAttachmentPaths[0]);
  }
  const selection = args.selectionContext as SelectionLike;
  const parentTitle =
    selection?.items?.attachments?.[0]?.parent?.title ||
    selection?.items?.attachments?.[0]?.parent?.data?.title ||
    selection?.items?.parents?.[0]?.item?.title ||
    selection?.items?.parents?.[0]?.item?.data?.title ||
    selection?.items?.children?.[0]?.parent?.title ||
    selection?.items?.children?.[0]?.parent?.data?.title ||
    selection?.items?.children?.[0]?.item?.title ||
    selection?.items?.children?.[0]?.item?.data?.title ||
    selection?.items?.notes?.[0]?.parent?.title ||
    selection?.items?.notes?.[0]?.parent?.data?.title ||
    selection?.items?.notes?.[0]?.item?.title ||
    selection?.items?.notes?.[0]?.item?.data?.title ||
    "";
  if (String(parentTitle || "").trim()) {
    return String(parentTitle).trim();
  }
  return `item-${args.targetParentID}`;
}

function buildSkillRunnerJobRequest(args: {
  selectionContext: unknown;
  manifest: WorkflowManifest;
  executionOptions?: {
    workflowParams?: Record<string, unknown>;
  };
}) {
  const request = args.manifest.request as WorkflowRequestSpec | undefined;
  if (!request) {
    throw new Error(`Workflow ${args.manifest.id} missing request declaration`);
  }
  const skillId = String(request.create?.skill_id || "").trim();
  if (!skillId) {
    throw new Error(
      `Workflow ${args.manifest.id} skillrunner.job.v1 requires request.create.skill_id`,
    );
  }
  const attachments = resolveSelectionAttachments(args.selectionContext);
  const declaredFiles = request.input?.upload?.files || [];
  if (declaredFiles.length === 0) {
    throw new Error(
      "request.input.upload.files is required for skillrunner.job.v1 declarative request",
    );
  }
  const keys = new Set<string>();
  const uploadFiles = declaredFiles.map((entry) => {
    if (!entry?.key || typeof entry.key !== "string") {
      throw new Error("request.input.upload.files[].key is required");
    }
    if (keys.has(entry.key)) {
      throw new Error(`Duplicated upload file key: ${entry.key}`);
    }
    keys.add(entry.key);
    return {
      key: entry.key,
      path: resolveAttachmentBySelector(
        attachments,
        entry.from as "selected.markdown" | "selected.pdf",
      ),
    };
  });

  const targetParentID = resolveTargetParentID(args.selectionContext);
  const sourceAttachmentPaths = resolveSourceAttachmentPaths(attachments);
  const taskName = resolveTaskName({
    sourceAttachmentPaths,
    selectionContext: args.selectionContext,
    targetParentID,
  });
  const workflowParams = resolveWorkflowParams({
    manifest: args.manifest,
    executionOptions: args.executionOptions,
  });
  const fetchType = args.manifest.result?.fetch?.type || "bundle";
  const declaredInput = isObject(request.input) ? request.input : null;
  const inlineInput = declaredInput
    ? Object.fromEntries(
        Object.entries(declaredInput).filter(([key]) => key !== "upload"),
      )
    : {};

  const requestPayload: SkillRunnerJobRequestV1 = {
    kind: "skillrunner.job.v1",
    targetParentID,
    taskName,
    sourceAttachmentPaths,
    skill_id: skillId,
    upload_files: uploadFiles,
    parameter: workflowParams,
    ...(Object.keys(inlineInput).length > 0 ? { input: inlineInput } : {}),
    poll: {
      interval_ms:
        request.poll?.interval_ms || args.manifest.execution?.poll_interval_ms,
      timeout_ms:
        request.poll?.timeout_ms || args.manifest.execution?.timeout_ms,
    },
    fetch_type: fetchType === "result" ? "result" : "bundle",
  };
  return requestPayload;
}

function buildGenericHttpRequest(args: {
  selectionContext: unknown;
  manifest: WorkflowManifest;
}) {
  const requestSpec = args.manifest.request as {
    http?: {
      method?: string;
      path?: string;
      headers?: Record<string, string>;
      json?: unknown;
      timeout_ms?: number;
    };
  } | null;
  const http = requestSpec?.http || {};
  const method = String(http.method || "").trim().toUpperCase();
  const path = String(http.path || "").trim();
  if (!method || !path) {
    throw new Error(
      `Workflow ${args.manifest.id} generic-http.request.v1 requires request.http.method and request.http.path`,
    );
  }

  const attachments = resolveSelectionAttachments(args.selectionContext);
  const targetParentID = resolveTargetParentID(args.selectionContext);
  const sourceAttachmentPaths = resolveSourceAttachmentPaths(attachments);
  const taskName = resolveTaskName({
    sourceAttachmentPaths,
    selectionContext: args.selectionContext,
    targetParentID,
  });
  const sharedPayload = {
    workflow_id: args.manifest.id,
    workflow_label: args.manifest.label,
    target_parent_id: targetParentID,
    attachment_paths: sourceAttachmentPaths,
  };
  const payload =
    isObject(http.json)
      ? {
          ...sharedPayload,
          ...http.json,
        }
      : typeof http.json === "undefined"
        ? sharedPayload
        : {
            ...sharedPayload,
            input: http.json,
          };

  const requestPayload: GenericHttpRequestV1 = {
    kind: "generic-http.request.v1",
    targetParentID,
    taskName,
    sourceAttachmentPaths,
    request: {
      method,
      path,
      ...(http.headers ? { headers: http.headers } : {}),
      json: payload,
    },
    timeout_ms:
      typeof http.timeout_ms === "number"
        ? http.timeout_ms
        : args.manifest.execution?.timeout_ms,
  };
  return requestPayload;
}

function buildPassThroughRequest(args: {
  selectionContext: unknown;
  manifest: WorkflowManifest;
  executionOptions?: {
    workflowParams?: Record<string, unknown>;
  };
}) {
  const attachments = resolveSelectionAttachments(args.selectionContext);
  const targetParentID = resolveTargetParentID(args.selectionContext);
  const sourceAttachmentPaths = resolveSourceAttachmentPaths(attachments);
  const taskName = resolveTaskName({
    sourceAttachmentPaths,
    selectionContext: args.selectionContext,
    targetParentID,
  });
  const workflowParams = resolveWorkflowParams({
    manifest: args.manifest,
    executionOptions: args.executionOptions,
  });

  const requestPayload: PassThroughRunRequestV1 = {
    kind: PASS_THROUGH_REQUEST_KIND,
    targetParentID,
    taskName,
    sourceAttachmentPaths,
    selectionContext: args.selectionContext,
    parameter: workflowParams,
  };
  return requestPayload;
}

function buildGenericHttpStepsRequest(args: {
  selectionContext: unknown;
  manifest: WorkflowManifest;
  executionOptions?: {
    workflowParams?: Record<string, unknown>;
  };
}) {
  const requestSpec = args.manifest.request as {
    steps?: unknown;
    poll?: {
      interval_ms?: number;
      timeout_ms?: number;
    };
    context?: Record<string, unknown>;
  } | null;
  const declaredSteps = Array.isArray(requestSpec?.steps)
    ? requestSpec?.steps || []
    : [];
  if (declaredSteps.length === 0) {
    throw new Error(
      `Workflow ${args.manifest.id} generic-http.steps.v1 requires request.steps[]`,
    );
  }

  const attachments = resolveSelectionAttachments(args.selectionContext);
  const targetParentID = resolveTargetParentID(args.selectionContext);
  const sourceAttachmentPaths = resolveSourceAttachmentPaths(attachments);
  const taskName = resolveTaskName({
    sourceAttachmentPaths,
    selectionContext: args.selectionContext,
    targetParentID,
  });
  const workflowParams = resolveWorkflowParams({
    manifest: args.manifest,
    executionOptions: args.executionOptions,
  });
  const sourceAttachment = resolveSingleSourceAttachment(
    attachments,
    sourceAttachmentPaths,
  );
  const sourceAttachmentPath = sourceAttachmentPaths[0] || "";

  const context = {
    ...workflowParams,
    workflow_id: args.manifest.id,
    workflow_label: args.manifest.label,
    target_parent_id: targetParentID,
    source_attachment_path: sourceAttachmentPath,
    source_attachment_name: sourceAttachmentPath
      ? getBaseName(sourceAttachmentPath)
      : "",
    source_attachment_stem: sourceAttachmentPath
      ? getFileStem(sourceAttachmentPath)
      : "",
    source_attachment_item_id: sourceAttachment?.item?.id || null,
    source_attachment_item_key: sourceAttachment?.item?.key || "",
    ...(isObject(requestSpec?.context) ? requestSpec?.context || {} : {}),
  };

  const requestPayload: GenericHttpStepsRequestV1 = {
    kind: "generic-http.steps.v1",
    targetParentID,
    taskName,
    sourceAttachmentPaths,
    context,
    steps: declaredSteps as GenericHttpStepsRequestV1["steps"],
    poll: {
      interval_ms:
        requestSpec?.poll?.interval_ms || args.manifest.execution?.poll_interval_ms,
      timeout_ms:
        requestSpec?.poll?.timeout_ms || args.manifest.execution?.timeout_ms,
    },
  };
  return requestPayload;
}

export function compileDeclarativeRequest(args: {
  kind: string;
  selectionContext: unknown;
  manifest: WorkflowManifest;
  executionOptions?: {
    workflowParams?: Record<string, unknown>;
    providerOptions?: Record<string, unknown>;
  };
}) {
  const resolvedKind = assertRequestKindSupported(args.kind).requestKind;
  if (resolvedKind === "skillrunner.job.v1") {
    const request = buildSkillRunnerJobRequest(args);
    assertRequestPayloadContract({
      requestKind: resolvedKind,
      request,
    });
    return request;
  }
  if (resolvedKind === "generic-http.request.v1") {
    const request = buildGenericHttpRequest(args);
    assertRequestPayloadContract({
      requestKind: resolvedKind,
      request,
    });
    return request;
  }
  if (resolvedKind === "generic-http.steps.v1") {
    const request = buildGenericHttpStepsRequest(args);
    assertRequestPayloadContract({
      requestKind: resolvedKind,
      request,
    });
    return request;
  }
  if (resolvedKind === PASS_THROUGH_REQUEST_KIND) {
    const request = buildPassThroughRequest(args);
    assertRequestPayloadContract({
      requestKind: resolvedKind,
      request,
    });
    return request;
  }
  throw new Error(`Unsupported declarative request kind: ${resolvedKind}`);
}
