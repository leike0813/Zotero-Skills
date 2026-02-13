import { getBaseName } from "../../utils/path";

export function resolveTargetParentIDFromRequest(request: unknown) {
  const parsed = request as { targetParentID?: number };
  return typeof parsed.targetParentID === "number"
    ? parsed.targetParentID
    : null;
}

function resolveAttachmentPathsFromRequest(request: unknown) {
  const typed = request as {
    sourceAttachmentPaths?: unknown;
    request?: { json?: { attachment_paths?: unknown } };
    attachment_paths?: unknown;
  };
  const fromSource = Array.isArray(typed.sourceAttachmentPaths)
    ? typed.sourceAttachmentPaths
    : [];
  const fromRequestJson = Array.isArray(typed.request?.json?.attachment_paths)
    ? typed.request?.json?.attachment_paths || []
    : [];
  const fromTopLevel = Array.isArray(typed.attachment_paths)
    ? typed.attachment_paths || []
    : [];
  return [...fromSource, ...fromRequestJson, ...fromTopLevel]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function resolveParentTaskName(targetParentID: number | null) {
  if (!targetParentID) {
    return "";
  }
  const parent = Zotero.Items.get(targetParentID);
  if (!parent) {
    return "";
  }
  const title = String(parent.getField?.("title") || "").trim();
  return title || "";
}

export function resolveTaskNameFromRequest(request: unknown, index: number) {
  const fromRequest = String(
    (request as { taskName?: unknown }).taskName || "",
  ).trim();
  if (fromRequest) {
    return fromRequest;
  }
  const attachmentPaths = resolveAttachmentPathsFromRequest(request);
  if (attachmentPaths.length > 0) {
    return getBaseName(attachmentPaths[0]) || attachmentPaths[0];
  }
  const targetParentID = resolveTargetParentIDFromRequest(request);
  const parentName = resolveParentTaskName(targetParentID);
  if (parentName) {
    return parentName;
  }
  return `task-${index + 1}`;
}
