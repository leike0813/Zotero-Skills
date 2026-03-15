function cloneSelectionContext(selectionContext) {
  return JSON.parse(JSON.stringify(selectionContext || {}));
}

function normalizePath(value) {
  return String(value || "").replace(/[\\/]+/g, "/").toLowerCase();
}

function toNativePath(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (/^[A-Za-z]:\//.test(text)) {
    return text.replace(/\//g, "\\");
  }
  return text;
}

function basenamePath(filePath) {
  const parts = String(filePath || "")
    .split(/[\\/]+/)
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

function dirnamePath(filePath) {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return "";
  }
  const hasDrive = /^[A-Za-z]:/.test(parts[0]);
  const prefix = normalized.startsWith("/") ? "/" : "";
  const joined = parts.slice(0, -1).join("/");
  if (hasDrive) {
    return toNativePath(joined);
  }
  return toNativePath(`${prefix}${joined}`);
}

function joinPath(baseDir, name) {
  const left = String(baseDir || "").replace(/[\\/]+$/, "");
  const right = String(name || "").replace(/^[\\/]+/, "");
  if (!left) {
    return right;
  }
  if (!right) {
    return toNativePath(left);
  }
  const separator = left.includes("\\") ? "\\" : "/";
  return toNativePath(`${left}${separator}${right}`);
}

function replaceExtensionAsMd(filePath) {
  const normalized = String(filePath || "");
  if (!normalized.trim()) {
    return "";
  }
  return normalized.replace(/\.[^.]+$/, ".md");
}

function fileExists(filePath) {
  const text = toNativePath(filePath);
  if (!text) {
    return false;
  }
  try {
    const nsFile = Zotero.File.pathToFile(text);
    return !!nsFile?.exists?.();
  } catch {
    const fallback = /^[A-Za-z]:\//.test(String(filePath || ""))
      ? String(filePath || "").replace(/\//g, "\\")
      : "";
    if (!fallback) {
      return false;
    }
    try {
      const nsFile = Zotero.File.pathToFile(fallback);
      return !!nsFile?.exists?.();
    } catch {
      return false;
    }
  }
}

function resolveDataPath(entry, dataPath) {
  const text = String(dataPath || "").trim();
  if (!text) {
    return "";
  }
  if (/^attachments?:/i.test(text)) {
    const relativePath = text
      .replace(/^attachments?:/i, "")
      .replace(/^[\\/]+/, "");
    const candidates = [text, relativePath].filter(Boolean);
    try {
      if (typeof Zotero.Attachments?.resolveRelativePath === "function") {
        for (const candidate of candidates) {
          const resolved = Zotero.Attachments.resolveRelativePath(candidate);
          const resolvedPath = String(
            (resolved && typeof resolved === "object" && resolved.path) || resolved || "",
          ).trim();
          if (resolvedPath) {
            return resolvedPath;
          }
        }
      }
    } catch {
      // ignore
    }
    const baseAttachmentPath = String(
      Zotero.Prefs?.get?.("baseAttachmentPath") || "",
    ).trim();
    if (baseAttachmentPath && relativePath) {
      return joinPath(baseAttachmentPath, relativePath);
    }
  }
  if (/^storage:/i.test(text)) {
    try {
      const itemKey = String(entry?.item?.key || "").trim();
      const libraryID = Number(entry?.item?.libraryID || 0) || Zotero.Libraries.userLibraryID;
      if (
        itemKey &&
        typeof Zotero.Attachments?.getStorageDirectoryByLibraryAndKey === "function"
      ) {
        const relative = text.replace(/^storage:/i, "");
        const dir = Zotero.Attachments.getStorageDirectoryByLibraryAndKey(
          libraryID,
          itemKey,
        );
        const nsFile = Zotero.File.pathToFile(dir.path ?? dir);
        for (const segment of relative.split(/[\\/]+/).filter(Boolean)) {
          nsFile.append(segment);
        }
        return String(nsFile.path || "");
      }
    } catch {
      // ignore
    }
  }
  return text;
}

async function resolveSourcePathFromItem(entry, runtime) {
  const itemId = Number(entry?.item?.id || 0);
  if (!itemId) {
    return "";
  }
  try {
    const item = runtime.helpers.resolveItemRef(itemId);
    if (!item || typeof item.getFilePathAsync !== "function") {
      return "";
    }
    const resolved = String((await item.getFilePathAsync()) || "").trim();
    return resolved;
  } catch {
    return "";
  }
}

async function resolveAttachmentSourcePath(entry, runtime) {
  const fromItem = await resolveSourcePathFromItem(entry, runtime);
  const candidates = [
    fromItem,
    runtime.helpers.getAttachmentFilePath(entry),
    entry?.filePath,
    entry?.item?.data?.path,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  for (const candidate of candidates) {
    const resolved = resolveDataPath(entry, candidate);
    if (resolved && fileExists(resolved)) {
      return resolved;
    }
    if (fileExists(candidate)) {
      return candidate;
    }
  }
  return "";
}

function collectCandidateAttachments(selectionContext) {
  const candidates = [];
  const pushEntries = (entries) => {
    for (const entry of entries || []) {
      if (entry) {
        candidates.push(entry);
      }
    }
  };
  pushEntries(selectionContext?.items?.attachments || []);
  for (const parent of selectionContext?.items?.parents || []) {
    pushEntries(parent?.attachments || []);
  }
  for (const child of selectionContext?.items?.children || []) {
    pushEntries(child?.attachments || []);
  }
  return candidates;
}

async function dedupeAttachments(attachments, runtime) {
  const seen = new Set();
  const deduped = [];
  for (const entry of attachments) {
    const id = entry?.item?.id;
    const filePath = await resolveAttachmentSourcePath(entry, runtime);
    const parentId = runtime.helpers.getAttachmentParentId(entry);
    const key =
      typeof id === "number"
        ? `id:${id}`
        : `file:${normalizePath(filePath)}|parent:${parentId || "none"}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}

async function hasMarkdownTargetConflict(entry, runtime) {
  const sourcePath = await resolveAttachmentSourcePath(entry, runtime);
  if (!sourcePath) {
    return true;
  }
  const sourceDir = dirnamePath(sourcePath);
  const mdName = replaceExtensionAsMd(basenamePath(sourcePath));
  if (!mdName) {
    return true;
  }
  const mdPath = joinPath(sourceDir, mdName);
  return fileExists(mdPath);
}

export async function filterInputs({ selectionContext, runtime }) {
  const candidates = collectCandidateAttachments(selectionContext)
    .filter((entry) => runtime.helpers.isPdfAttachment(entry));
  const deduped = await dedupeAttachments(candidates, runtime);
  const accepted = [];
  for (const entry of deduped) {
    if (!(await hasMarkdownTargetConflict(entry, runtime))) {
      accepted.push(entry);
    }
  }
  if (accepted.length === 0) {
    return null;
  }
  const cloned = cloneSelectionContext(selectionContext);
  return runtime.helpers.withFilteredAttachments(cloned, accepted);
}
