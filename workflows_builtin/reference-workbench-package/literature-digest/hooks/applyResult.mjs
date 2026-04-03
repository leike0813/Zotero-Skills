import {
  encodeBase64Utf8,
  escapeAttribute,
  escapeHtml,
} from "../../lib/htmlCodec.mjs";
import { parseGeneratedNoteKind } from "../../lib/referencesNote.mjs";
import { requireHostApi, withPackageRuntimeScope } from "../../lib/runtime.mjs";

function renderInlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, url) =>
      `<a href="${escapeAttribute(url)}">${escapeHtml(label)}</a>`,
  );
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

function closeLists(state, blocks) {
  if (state.inUl) {
    blocks.push("</ul>");
    state.inUl = false;
  }
  if (state.inOl) {
    blocks.push("</ol>");
    state.inOl = false;
  }
}

function renderMarkdownToHtml(markdown) {
  const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  const state = {
    inCodeBlock: false,
    codeLines: [],
    inUl: false,
    inOl: false,
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^```(\w+)?\s*$/);
    if (fenceMatch) {
      closeLists(state, blocks);
      if (!state.inCodeBlock) {
        state.inCodeBlock = true;
        state.codeLines = [];
      } else {
        blocks.push(
          `<pre><code>${escapeHtml(state.codeLines.join("\n"))}</code></pre>`,
        );
        state.inCodeBlock = false;
        state.codeLines = [];
      }
      continue;
    }

    if (state.inCodeBlock) {
      state.codeLines.push(line);
      continue;
    }

    if (/^\s*$/.test(line)) {
      closeLists(state, blocks);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeLists(state, blocks);
      const level = headingMatch[1].length;
      blocks.push(
        `<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`,
      );
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      if (!state.inUl) {
        closeLists(state, blocks);
        blocks.push("<ul>");
        state.inUl = true;
      }
      blocks.push(`<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`);
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (!state.inOl) {
        closeLists(state, blocks);
        blocks.push("<ol>");
        state.inOl = true;
      }
      blocks.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
      continue;
    }

    closeLists(state, blocks);
    blocks.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  closeLists(state, blocks);
  if (state.inCodeBlock && state.codeLines.length > 0) {
    blocks.push(`<pre><code>${escapeHtml(state.codeLines.join("\n"))}</code></pre>`);
  }
  return blocks.join("\n");
}

function normalizeReferences(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.items)) {
      return parsed.items;
    }
    if (Array.isArray(parsed.references)) {
      return parsed.references;
    }
  }
  return [];
}

function renderPayloadBlock(payloadType, payload, runtime) {
  const json = JSON.stringify(payload);
  const encoded = encodeBase64Utf8(json, runtime);
  return `<span data-zs-block="payload" data-zs-payload="${escapeAttribute(payloadType)}" data-zs-version="1" data-zs-encoding="base64" data-zs-value="${escapeAttribute(encoded)}"></span>`;
}

function renderSourceMetadataBlock(sourceAttachmentItemKey) {
  const itemKey = String(sourceAttachmentItemKey || "").trim();
  if (!itemKey) {
    return "";
  }
  return `<span data-zs-block="meta" data-zs-meta="source-attachment" data-zs-source_attachment_item_key="${escapeAttribute(itemKey)}" hidden="hidden"></span>`;
}

function normalizePathForCompare(targetPath) {
  const text = String(targetPath || "").trim();
  if (!text) {
    return "";
  }
  return text
    .replace(/^file:\/\/+/, "")
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/");
}

function getBaseNameFromPath(targetPath) {
  const normalized = normalizePathForCompare(targetPath);
  if (!normalized) {
    return "";
  }
  const parts = normalized.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1].toLowerCase() : "";
}

function resolveBundleEntryPath(rawPath, fallbackPath) {
  const normalizedRaw = normalizePathForCompare(rawPath);
  const normalizedFallback = normalizePathForCompare(fallbackPath);
  const candidates = [];
  const seen = new Set();

  const addCandidate = (value) => {
    const normalized = normalizePathForCompare(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  // Priority 1: trust backend-returned bundle-relative path as-is.
  addCandidate(normalizedRaw);

  // Priority 2: derive suffix candidates for absolute/non-canonical paths.
  const lowered = normalizedRaw.toLowerCase();
  for (const marker of ["/uploads/", "/artifacts/", "/result/", "/bundle/"]) {
    const index = lowered.lastIndexOf(marker);
    if (index >= 0) {
      addCandidate(normalizedRaw.slice(index + 1));
    }
  }

  // Priority 3: legacy fallback path from workflow contract.
  addCandidate(normalizedFallback);

  return candidates;
}

async function readBundleTextWithPathFallback(args) {
  const candidates = resolveBundleEntryPath(args.rawPath, args.fallbackPath);
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const text = await args.bundleReader.readText(candidate);
      return {
        entryPath: candidate,
        text,
      };
    } catch (error) {
      lastError = error;
    }
  }
  const rawPath = normalizePathForCompare(args.rawPath);
  const fallbackPath = normalizePathForCompare(args.fallbackPath);
  const reason = String(lastError && lastError.message ? lastError.message : lastError || "unknown");
  throw new Error(
    `[${args.fieldName}] bundle entry not found; raw_path=${rawPath || "<empty>"}; candidates=${JSON.stringify(candidates)}; fallback=${fallbackPath || "<empty>"}; last_error=${reason}`,
  );
}

function collectSourceAttachmentPathsFromRequest(request) {
  if (!request || typeof request !== "object") {
    return [];
  }

  const typed = request;
  const fromSource = Array.isArray(typed.sourceAttachmentPaths)
    ? typed.sourceAttachmentPaths
    : [];
  const fromUploadFiles = Array.isArray(typed.upload_files)
    ? typed.upload_files.map((entry) => entry?.path)
    : [];
  const fromNestedUploadFiles = Array.isArray(typed?.request?.json?.upload_files)
    ? typed.request.json.upload_files.map((entry) => entry?.path)
    : [];

  const combined = [...fromSource, ...fromUploadFiles, ...fromNestedUploadFiles]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

  return Array.from(new Set(combined));
}

async function resolveSourceAttachmentItemKey({ parentItem, request, runtime }) {
  if (!parentItem) {
    return "";
  }

  const sourcePaths = collectSourceAttachmentPathsFromRequest(request);
  if (sourcePaths.length === 0) {
    return "";
  }

  const sourcePathSet = new Set(
    sourcePaths.map(normalizePathForCompare).filter(Boolean),
  );
  const sourcePathInsensitiveSet = new Set(
    Array.from(sourcePathSet).map((entry) => entry.toLowerCase()),
  );
  const sourceBasenames = new Set(
    sourcePaths.map(getBaseNameFromPath).filter(Boolean),
  );

  const basenameMatchKeys = new Set();
  const attachmentRefs = parentItem.getAttachments?.() || [];
  for (const attachmentRef of attachmentRefs) {
    let attachment = null;
    try {
      attachment = runtime.helpers.resolveItemRef(attachmentRef);
    } catch {
      attachment = null;
    }
    if (!attachment) {
      continue;
    }

    const attachmentKey = String(attachment.key || "").trim();
    if (!attachmentKey) {
      continue;
    }

    let attachmentPath = "";
    try {
      attachmentPath = String((await attachment.getFilePathAsync?.()) || "").trim();
    } catch {
      attachmentPath = "";
    }

    if (!attachmentPath) {
      attachmentPath = String(attachment.getField?.("path") || "").trim();
    }

    const normalizedAttachmentPath = normalizePathForCompare(attachmentPath);
    if (
      normalizedAttachmentPath &&
      (sourcePathSet.has(normalizedAttachmentPath) ||
        sourcePathInsensitiveSet.has(normalizedAttachmentPath.toLowerCase()))
    ) {
      return attachmentKey;
    }

    const attachmentBasename =
      getBaseNameFromPath(attachmentPath) ||
      getBaseNameFromPath(String(attachment.getField?.("title") || ""));
    if (attachmentBasename && sourceBasenames.has(attachmentBasename)) {
      basenameMatchKeys.add(attachmentKey);
    }
  }

  if (basenameMatchKeys.size === 1) {
    return Array.from(basenameMatchKeys)[0];
  }

  return "";
}

function collectGeneratedNotesByKind(parentItem, runtime) {
  const byKind = new Map([
    ["digest", []],
    ["references", []],
    ["citation-analysis", []],
  ]);
  const noteIds = parentItem.getNotes?.() || [];
  for (const noteRef of noteIds) {
    let noteItem;
    try {
      noteItem = runtime.helpers.resolveItemRef(noteRef);
    } catch {
      noteItem = null;
    }
    if (!noteItem) {
      continue;
    }
    const kind = parseGeneratedNoteKind(noteItem.getNote?.() || "");
    if (!byKind.has(kind)) {
      continue;
    }
    byKind.get(kind).push(noteItem);
  }
  return byKind;
}

async function upsertUniqueGeneratedNote(args) {
  const existingNotes = args.existingNotes || [];
  if (existingNotes.length === 0) {
    return requireHostApi(args.runtime).parents.addNote(args.parentItem, {
      content: args.content,
    });
  }

  const primary = existingNotes[0];
  await requireHostApi(args.runtime).notes.update(primary, {
    content: args.content,
  });
  for (let i = 1; i < existingNotes.length; i++) {
    await requireHostApi(args.runtime).notes.remove(existingNotes[i]);
  }
  return primary;
}

async function applyResultImpl({ parent, bundleReader, request, runtime }) {
  const helpers = runtime.helpers;
  const parentItem = helpers.resolveItemRef(parent);
  const resultJsonText = await bundleReader.readText("result/result.json");
  const result = JSON.parse(resultJsonText);

  const digestResolved = await readBundleTextWithPathFallback({
    bundleReader,
    fieldName: "digest_path",
    rawPath: result?.data?.digest_path,
    fallbackPath: "artifacts/digest.md",
  });
  const referencesResolved = await readBundleTextWithPathFallback({
    bundleReader,
    fieldName: "references_path",
    rawPath: result?.data?.references_path,
    fallbackPath: "artifacts/references.json",
  });
  const citationAnalysisResolved = await readBundleTextWithPathFallback({
    bundleReader,
    fieldName: "citation_analysis_path",
    rawPath: result?.data?.citation_analysis_path,
    fallbackPath: "artifacts/citation_analysis.json",
  });
  const digestEntry = digestResolved.entryPath;
  const referencesEntry = referencesResolved.entryPath;
  const citationAnalysisEntry = citationAnalysisResolved.entryPath;
  const digestMarkdown = digestResolved.text;
  const referencesJson = referencesResolved.text;
  const citationAnalysisJson = citationAnalysisResolved.text;

  let parsedReferences;
  try {
    parsedReferences = JSON.parse(referencesJson);
  } catch {
    parsedReferences = [];
  }
  const references = normalizeReferences(parsedReferences);
  const sourceAttachmentItemKey = await resolveSourceAttachmentItemKey({
    parentItem,
    request,
    runtime,
  });

  let parsedCitationAnalysis = {};
  try {
    parsedCitationAnalysis = JSON.parse(citationAnalysisJson) || {};
  } catch {
    parsedCitationAnalysis = {};
  }
  const citationReportMarkdown =
    parsedCitationAnalysis && typeof parsedCitationAnalysis === "object"
      ? String(parsedCitationAnalysis.report_md || "")
      : "";

  const digestNoteContent = [
    '<div data-zs-note-kind="digest">',
    renderSourceMetadataBlock(sourceAttachmentItemKey),
    "<h1>Digest</h1>",
    '<div data-zs-view="digest-html">',
    renderMarkdownToHtml(digestMarkdown),
    "</div>",
    renderPayloadBlock("digest-markdown", {
      version: 1,
      entry: digestEntry,
      format: "markdown",
      content: digestMarkdown,
    }, runtime),
    "</div>",
  ].join("\n");

  const referencesNoteContent = [
    '<div data-zs-note-kind="references">',
    "<h1>References</h1>",
    runtime.helpers.renderReferencesTable(references),
    renderPayloadBlock("references-json", {
      version: 1,
      entry: referencesEntry,
      format: "json",
      references,
    }, runtime),
    "</div>",
  ].join("\n");

  const citationAnalysisNoteContent = [
    '<div data-zs-note-kind="citation-analysis">',
    "<h1>Citation Analysis</h1>",
    '<div data-zs-view="citation-analysis-html">',
    renderMarkdownToHtml(citationReportMarkdown),
    "</div>",
    renderPayloadBlock("citation-analysis-json", {
      version: 1,
      entry: citationAnalysisEntry,
      format: "json",
      citation_analysis: parsedCitationAnalysis,
    }, runtime),
    "</div>",
  ].join("\n");

  const existingByKind = collectGeneratedNotesByKind(parentItem, runtime);

  const digestNote = await upsertUniqueGeneratedNote({
    runtime,
    parentItem,
    content: digestNoteContent,
    existingNotes: existingByKind.get("digest"),
  });

  const referencesNote = await upsertUniqueGeneratedNote({
    runtime,
    parentItem,
    content: referencesNoteContent,
    existingNotes: existingByKind.get("references"),
  });

  const citationAnalysisNote = await upsertUniqueGeneratedNote({
    runtime,
    parentItem,
    content: citationAnalysisNoteContent,
    existingNotes: existingByKind.get("citation-analysis"),
  });

  return {
    notes: [digestNote, referencesNote, citationAnalysisNote],
  };
}

export async function applyResult(args) {
  return withPackageRuntimeScope(args?.runtime, () => applyResultImpl(args));
}
