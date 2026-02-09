import type { HookHelpers } from "./types";

type AttachmentLike = {
  item?: {
    parentItemID?: number | null;
    title?: string;
    data?: {
      dateAdded?: string;
      path?: string;
      contentType?: string;
    };
  };
  parent?: { id?: number } | null;
  filePath?: string | null;
  mimeType?: string | null;
};

function parseDate(value: unknown) {
  if (typeof value !== "string" || value.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY;
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getAttachment(entry: unknown): AttachmentLike {
  return (entry || {}) as AttachmentLike;
}

function getBaseName(targetPath: string) {
  const normalized = targetPath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

export function createHookHelpers(zotero: typeof Zotero): HookHelpers {
  const helpers: HookHelpers = {
    getAttachmentParentId: (entry) => {
      const attachment = getAttachment(entry);
      return attachment.parent?.id || attachment.item?.parentItemID || null;
    },
    getAttachmentFilePath: (entry) => {
      const attachment = getAttachment(entry);
      return (
        attachment.filePath ||
        attachment.item?.data?.path ||
        attachment.item?.title ||
        ""
      );
    },
    getAttachmentFileName: (entry) => {
      const rawPath = helpers.getAttachmentFilePath(entry);
      const normalized = rawPath
        .replace(/^attachments:/, "")
        .replace(/^storage:/, "");
      return getBaseName(normalized);
    },
    getAttachmentFileStem: (entry) =>
      helpers.getAttachmentFileName(entry).replace(/\.[^.]+$/, "").toLowerCase(),
    getAttachmentDateAdded: (entry) =>
      parseDate(getAttachment(entry).item?.data?.dateAdded),
    isMarkdownAttachment: (entry) => {
      const name = helpers.getAttachmentFileName(entry).toLowerCase();
      if (name.endsWith(".md")) {
        return true;
      }
      const attachment = getAttachment(entry);
      const mime = String(
        attachment.mimeType || attachment.item?.data?.contentType || "",
      ).toLowerCase();
      return mime === "text/markdown";
    },
    isPdfAttachment: (entry) => {
      const name = helpers.getAttachmentFileName(entry).toLowerCase();
      if (name.endsWith(".pdf")) {
        return true;
      }
      const attachment = getAttachment(entry);
      const mime = String(
        attachment.mimeType || attachment.item?.data?.contentType || "",
      ).toLowerCase();
      return mime === "application/pdf";
    },
    pickEarliestPdfAttachment: (entries) => {
      const sorted = [...entries]
        .filter((entry) => helpers.isPdfAttachment(entry))
        .sort((a, b) => {
          const delta =
            helpers.getAttachmentDateAdded(a) - helpers.getAttachmentDateAdded(b);
          if (delta !== 0) {
            return delta;
          }
          return helpers
            .getAttachmentFileName(a)
            .localeCompare(helpers.getAttachmentFileName(b));
        });
      return sorted[0] || null;
    },
    cloneSelectionContext: <T>(selectionContext: T): T =>
      JSON.parse(JSON.stringify(selectionContext || {})) as T,
    withFilteredAttachments: <T>(selectionContext: T, attachments: unknown[]): T => {
      const cloned = helpers.cloneSelectionContext(selectionContext) as {
        items?: { attachments?: unknown[] };
        summary?: { attachmentCount?: number };
      };
      if (!cloned.items) {
        cloned.items = {};
      }
      cloned.items.attachments = attachments;
      if (!cloned.summary) {
        cloned.summary = {};
      }
      cloned.summary.attachmentCount = attachments.length;
      return cloned as T;
    },
    resolveItemRef: (ref) => {
      if (typeof ref === "object") {
        return ref;
      }
      if (typeof ref === "number") {
        const item = zotero.Items.get(ref);
        if (!item) {
          throw new Error(`Item not found: ${ref}`);
        }
        return item;
      }
      const item = zotero.Items.getByLibraryAndKey(zotero.Libraries.userLibraryID, ref);
      if (!item) {
        throw new Error(`Item not found: ${ref}`);
      }
      return item;
    },
    basenameOrFallback: (targetPath, fallback) =>
      targetPath ? getBaseName(targetPath) : fallback,
    toHtmlNote: (title, body) =>
      `<div><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(body)}</pre></div>`,
  };

  return helpers;
}
