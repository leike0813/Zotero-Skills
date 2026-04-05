import {
  decodeBase64Utf8,
  decodeHtmlEntities,
  readTagAttribute,
} from "./htmlCodec.mjs";
import {
  parseGeneratedNoteKind,
  parseReferencesPayload,
} from "./referencesNote.mjs";
import { escapeAttribute } from "./htmlCodec.mjs";
import { requireHostApi } from "./runtime.mjs";
import { getBaseName, sanitizeFileNameSegment } from "./path.mjs";
import {
  buildConversationNoteContent,
  buildCustomNoteContent,
  buildMarkdownBackedNoteContent,
  createConversationNote,
  parsePayloadBlock,
  renderPayloadBlock,
  renderMarkdownToHtml,
} from "./noteCodecs.mjs";

function renderSourceMetadataBlock(sourceAttachmentItemKey) {
  const itemKey = String(sourceAttachmentItemKey || "").trim();
  if (!itemKey) {
    return "";
  }
  return `<span data-zs-block="meta" data-zs-meta="source-attachment" data-zs-source_attachment_item_key="${escapeAttribute(itemKey)}" hidden="hidden"></span>`;
}

export function parseDigestPayload(noteContent, runtime) {
  return parsePayloadBlock(noteContent, "digest-markdown", runtime, {
    payloadFormat: "json",
  });
}

export function parseCitationAnalysisPayload(noteContent, runtime) {
  return parsePayloadBlock(noteContent, "citation-analysis-json", runtime, {
    payloadFormat: "json",
  });
}

function cloneSerializable(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function toNativeReferencesYear(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  const text = String(value).trim();
  if (/^-?\d+$/.test(text)) {
    const parsed = Number.parseInt(text, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toNativeReferencesArtifact(payload) {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.references)
      ? payload.references
      : [];
  return items.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return entry;
    }
    return {
      ...cloneSerializable(entry),
      year: toNativeReferencesYear(entry.year),
    };
  });
}

function toNativeCitationArtifact(payload) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    if (payload.citation_analysis && typeof payload.citation_analysis === "object") {
      return cloneSerializable(payload.citation_analysis);
    }
  }
  return cloneSerializable(payload);
}

export function collectGeneratedNotesByKind(parentItem, runtime) {
  const byKind = new Map([
    ["digest", []],
    ["references", []],
    ["citation-analysis", []],
  ]);
  const noteIds = parentItem.getNotes?.() || [];
  for (const noteRef of noteIds) {
    let noteItem = null;
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
  for (let index = 1; index < existingNotes.length; index += 1) {
    await requireHostApi(args.runtime).notes.remove(existingNotes[index]);
  }
  return primary;
}

export async function upsertLiteratureDigestGeneratedNotes(args) {
  const existingByKind = collectGeneratedNotesByKind(args.parentItem, args.runtime);
  const writtenNotes = [];

  if (args.digest) {
    const digestNoteContent = buildMarkdownBackedNoteContent({
      noteKind: "digest",
      title: "Digest",
      viewName: "digest-html",
      payloadType: "digest-markdown",
      payload: args.digest.payload,
      payloadFormat: "json",
      markdown: args.digest.payload.content,
      runtime: args.runtime,
      metadataBlocks: [renderSourceMetadataBlock(args.digest.sourceAttachmentItemKey)],
    });
    writtenNotes.push(
      await upsertUniqueGeneratedNote({
        runtime: args.runtime,
        parentItem: args.parentItem,
        content: digestNoteContent,
        existingNotes: existingByKind.get("digest"),
      }),
    );
  }

  if (args.references) {
    const referencesNoteContent = [
      '<div data-zs-note-kind="references">',
      "<h1>References</h1>",
      args.runtime.helpers.renderReferencesTable(args.references.payload.references || []),
      renderPayloadBlock("references-json", args.references.payload, args.runtime, {
        payloadFormat: "json",
      }),
      "</div>",
    ].join("\n");
    writtenNotes.push(
      await upsertUniqueGeneratedNote({
        runtime: args.runtime,
        parentItem: args.parentItem,
        content: referencesNoteContent,
        existingNotes: existingByKind.get("references"),
      }),
    );
  }

  if (args.citationAnalysis) {
    const reportMarkdown = String(
      args.citationAnalysis.payload?.citation_analysis?.report_md || "",
    );
    const citationNoteContent = buildMarkdownBackedNoteContent({
      noteKind: "citation-analysis",
      title: "Citation Analysis",
      viewName: "citation-analysis-html",
      payloadType: "citation-analysis-json",
      payload: args.citationAnalysis.payload,
      payloadFormat: "json",
      markdown: reportMarkdown,
      runtime: args.runtime,
    });
    writtenNotes.push(
      await upsertUniqueGeneratedNote({
        runtime: args.runtime,
        parentItem: args.parentItem,
        content: citationNoteContent,
        existingNotes: existingByKind.get("citation-analysis"),
      }),
    );
  }

  return {
    notes: writtenNotes,
  };
}

export async function exportGeneratedNoteCandidate(args) {
  const noteItem = args.runtime.helpers.resolveItemRef(args.noteItemID);
  const noteContent = String(noteItem.getNote?.() || "");
  const kind = String(args.kind || "").trim();
  if (kind === "digest") {
    const parsed = parseDigestPayload(noteContent, args.runtime);
    return {
      kind,
      payload: parsed.payload,
      files: [
        {
          fileName: "digest.md",
          content: String(parsed.payload?.content || ""),
        },
      ],
    };
  }
  if (kind === "references") {
    const parsed = parseReferencesPayload(noteContent, args.runtime);
    const nativeArtifact = toNativeReferencesArtifact(parsed.payload);
    return {
      kind,
      payload: nativeArtifact,
      files: [
        {
          fileName: "references.json",
          content: JSON.stringify(nativeArtifact, null, 2),
        },
      ],
    };
  }
  if (kind === "citation-analysis") {
    const parsed = parseCitationAnalysisPayload(noteContent, args.runtime);
    const nativeArtifact = toNativeCitationArtifact(parsed.payload);
    return {
      kind,
      payload: nativeArtifact,
      files: [
        {
          fileName: "citation_analysis.json",
          content: JSON.stringify(nativeArtifact, null, 2),
        },
        {
          fileName: "citation_analysis.md",
          content: String(nativeArtifact?.report_md || ""),
        },
      ],
    };
  }
  if (kind === "custom") {
    return exportCustomNote({ noteItem, noteContent, runtime: args.runtime });
  }
  if (kind === "conversation-note") {
    return exportConversationNote({
      noteItem,
      noteContent,
      runtime: args.runtime,
    });
  }
  throw new Error(`unsupported generated note kind for export: ${kind}`);
}

function buildSafeExportFileName(title, extension) {
  const safeTitle = sanitizeFileNameSegment(title);
  const normalizedExtension = String(extension || "").trim().replace(/^\.+/, "");
  return normalizedExtension ? `${safeTitle}.${normalizedExtension}` : safeTitle;
}

function deriveNoteTitleFromContent(noteContent) {
  const headingMatch = String(noteContent || "").match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!headingMatch) {
    return "";
  }
  return decodeHtmlEntities(
    String(headingMatch[1] || "")
      .replace(/<[^>]+>/g, "")
      .trim(),
  );
}

function resolveExportNoteTitle(noteItem, noteContent) {
  const directTitle = String(noteItem.getField?.("title") || "").trim();
  if (directTitle) {
    return directTitle;
  }
  const derivedTitle = deriveNoteTitleFromContent(noteContent);
  if (derivedTitle) {
    return derivedTitle;
  }
  return "untitled";
}

/**
 * Export a custom note.
 * - If the note contains a base64-encoded payload with markdown content
 *   (data-zs-payload ends with "-markdown", e.g. "custom-markdown" or "conversation-note-markdown"),
 *   decode it and write to a .md file.
 * - Otherwise, write the note content as .html.
 */
export function exportCustomNote(args) {
  const { noteItem, noteContent, runtime } = args;
  const noteTitle = resolveExportNoteTitle(noteItem, noteContent);

  // Try to find any markdown payload block (matches *-markdown pattern)
  const payloadTagMatch = noteContent.match(
    /<span[^>]*data-zs-payload=(["'])([a-zA-Z0-9-]+-markdown)\1[^>]*>/i
  );

  if (payloadTagMatch) {
    // Decode base64 payload
    const payloadTag = payloadTagMatch[0];
    const encodedValue = decodeHtmlEntities(readTagAttribute(payloadTag, "data-zs-value"));
    const markdownContent = decodeBase64Utf8(encodedValue, runtime);
    return {
      kind: "custom",
      payload: { markdown: markdownContent },
      files: [
        {
          fileName: buildSafeExportFileName(noteTitle, "md"),
          content: markdownContent,
        },
      ],
    };
  }

  // No payload found - export as HTML
  return {
    kind: "custom",
    payload: { html: noteContent },
    files: [
      {
        fileName: buildSafeExportFileName(noteTitle, "html"),
        content: noteContent,
      },
    ],
  };
}

export function exportConversationNote(args) {
  const noteTitle = resolveExportNoteTitle(args.noteItem, args.noteContent);
  const parsed = parsePayloadBlock(
    args.noteContent,
    "conversation-note-markdown",
    args.runtime,
    { payloadFormat: "json" },
  );
  return {
    kind: "conversation-note",
    payload: parsed.payload,
    files: [
      {
        fileName: buildSafeExportFileName(noteTitle, "md"),
        content: String(parsed.payload?.content || ""),
      },
    ],
  };
}

/**
 * Import custom notes from markdown files.
 * For each markdown file:
 * - Read the markdown content
 * - Render to HTML
 * - Create a note with data-zs-note-kind="custom" and base64-encoded payload
 * - Note title is the file name (without extension)
 */
export async function importCustomNotes(args) {
  const { runtime, parentItem, customNotes } = args;
  const createdNotes = [];

  for (const customNote of customNotes) {
    const sourcePath = String(customNote.sourcePath || "").trim();
    const fileName = String(customNote.fileName || getBaseName(sourcePath).replace(/\.md$/i, "") || "untitled").trim();

    const markdownContent = await runtime.hostApi.file.readText(sourcePath);
    const noteContent = buildCustomNoteContent({
      title: fileName,
      markdown: markdownContent,
      runtime,
    });
    const noteItem = await requireHostApi(runtime).parents.addNote(parentItem, {
      content: noteContent,
      title: fileName,
    });
    createdNotes.push(noteItem);
  }

  return {
    notes: createdNotes,
  };
}

export {
  buildConversationNoteContent,
  buildCustomNoteContent,
  createConversationNote,
  renderMarkdownToHtml,
};
