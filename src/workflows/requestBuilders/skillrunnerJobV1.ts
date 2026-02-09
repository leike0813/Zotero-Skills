import type { WorkflowManifest, WorkflowRequestSpec } from "../types";

type AttachmentLike = {
  filePath?: string | null;
  mimeType?: string | null;
  item?: {
    data?: {
      contentType?: string;
    };
  };
};

type SelectionLike = {
  items?: {
    attachments?: AttachmentLike[];
  };
};

function isMarkdownAttachment(entry: AttachmentLike) {
  const mime = (entry.mimeType || entry.item?.data?.contentType || "").toLowerCase();
  if (mime === "text/markdown" || mime === "text/x-markdown") {
    return true;
  }
  const filePath = String(entry.filePath || "").toLowerCase();
  return filePath.endsWith(".md");
}

function isPdfAttachment(entry: AttachmentLike) {
  const mime = (entry.mimeType || entry.item?.data?.contentType || "").toLowerCase();
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
  const path = matched[0].filePath || "";
  if (!path) {
    throw new Error(`Selector ${selector} resolved attachment without filePath`);
  }
  return path;
}

function resolveUploadFiles(
  selectionContext: unknown,
  request: WorkflowRequestSpec,
) {
  const selection = selectionContext as SelectionLike;
  const attachments = selection?.items?.attachments || [];
  const declaredFiles = request.input?.upload?.files || [];
  if (declaredFiles.length === 0) {
    throw new Error(
      "request.input.upload.files is required for skillrunner.job.v1 declarative request",
    );
  }

  const keys = new Set<string>();
  const resolved = declaredFiles.map((entry) => {
    if (!entry?.key || typeof entry.key !== "string") {
      throw new Error("request.input.upload.files[].key is required");
    }
    if (keys.has(entry.key)) {
      throw new Error(`Duplicated upload file key: ${entry.key}`);
    }
    keys.add(entry.key);
    const filePath = resolveAttachmentBySelector(
      attachments,
      entry.from as "selected.markdown" | "selected.pdf",
    );
    return {
      key: entry.key,
      path: filePath,
    };
  });
  return resolved;
}

function resolveTargetParentID(selectionContext: unknown) {
  const selection = selectionContext as {
    items?: {
      attachments?: Array<{ parent?: { id?: number } | null }>;
      parents?: Array<{ item?: { id?: number } }>;
      children?: Array<{ parent?: { id?: number } | null; item?: { id?: number } }>;
    };
  };

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
  throw new Error("Cannot resolve target parent item from selection context");
}

export function buildSkillrunnerJobV1Request(args: {
  selectionContext: unknown;
  manifest: WorkflowManifest;
}) {
  const request = args.manifest.request;
  if (!request) {
    throw new Error(`Workflow ${args.manifest.id} missing request declaration`);
  }

  const uploadFiles = resolveUploadFiles(args.selectionContext, request);
  const targetParentID = resolveTargetParentID(args.selectionContext);
  const fetchType = request.result?.fetch || "bundle";

  return {
    kind: "http.steps",
    targetParentID,
    steps: [
      {
        id: "create",
        request: {
          method: "POST",
          path: "/v1/jobs",
          json: {
            skill_id: request.create?.skill_id || args.manifest.backend?.skillId,
            engine: request.create?.engine || args.manifest.backend?.engine,
            parameter: request.create?.parameter || args.manifest.defaults || {},
            ...(request.create?.model ? { model: request.create.model } : {}),
            ...(request.create?.runtime_options
              ? { runtime_options: request.create.runtime_options }
              : {}),
          },
        },
        extract: {
          request_id: "$.request_id",
        },
      },
      {
        id: "upload",
        request: {
          method: "POST",
          path: "/v1/jobs/{request_id}/upload",
          multipart: true,
        },
        files: uploadFiles,
      },
      {
        id: "poll",
        request: {
          method: "GET",
          path: "/v1/jobs/{request_id}",
        },
        repeat_until: "status in ['succeeded','failed']",
      },
      {
        id: fetchType,
        request: {
          method: "GET",
          path:
            fetchType === "result"
              ? "/v1/jobs/{request_id}/result"
              : "/v1/jobs/{request_id}/bundle",
        },
      },
    ],
    poll: {
      interval_ms:
        request.poll?.interval_ms || args.manifest.execution?.poll_interval_ms,
      timeout_ms: request.poll?.timeout_ms || args.manifest.execution?.timeout_ms,
    },
  };
}
