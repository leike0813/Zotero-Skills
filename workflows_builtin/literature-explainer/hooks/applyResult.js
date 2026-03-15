function escapeHtml(input) {
  return String(input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(input) {
  return escapeHtml(input).replaceAll('"', "&quot;");
}

function encodeBase64Utf8(text) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(text, "utf8").toString("base64");
  }

  if (typeof TextEncoder !== "undefined" && typeof btoa === "function") {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(text)));
  }

  throw new Error("No base64 encoder available in current runtime");
}

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

function renderPayloadBlock(payloadType, payload) {
  const json = JSON.stringify(payload);
  const encoded = encodeBase64Utf8(json);
  return `<span data-zs-block="payload" data-zs-payload="${escapeAttribute(payloadType)}" data-zs-version="1" data-zs-encoding="base64" data-zs-value="${escapeAttribute(encoded)}"></span>`;
}

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getNotePathFromRecord(record) {
  if (!isRecord(record)) {
    return "";
  }
  const candidates = [
    record.note_path,
    record.data?.note_path,
    record.result?.note_path,
    record.result?.data?.note_path,
    record.data?.result?.note_path,
    record.data?.result?.data?.note_path,
  ];
  for (const value of candidates) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function resolveNotePathFromRunResult(runResult) {
  const candidates = [
    runResult?.resultJson?.result?.data,
    runResult?.resultJson?.result,
    runResult?.resultJson?.data?.data,
    runResult?.resultJson?.data,
    runResult?.resultJson,
    runResult?.responseJson?.result?.data,
    runResult?.responseJson?.result,
    runResult?.responseJson?.data?.data,
    runResult?.responseJson?.data,
    runResult?.responseJson,
    runResult?.result?.data,
    runResult?.result,
    runResult?.data?.data,
    runResult?.data,
    runResult,
  ];
  for (const candidate of candidates) {
    const resolved = getNotePathFromRecord(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return "";
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

async function resolveNotePath(args) {
  const fromRunResult = resolveNotePathFromRunResult(args.runResult);
  if (fromRunResult) {
    return fromRunResult;
  }
  try {
    const resultJsonText = await args.bundleReader.readText("result/result.json");
    const parsed = JSON.parse(resultJsonText);
    return getNotePathFromRecord(parsed);
  } catch {
    return "";
  }
}

function formatLocalTimestamp() {
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${yy}${mm}${dd}${hh}${min}`;
}

export async function applyResult({ parent, bundleReader, runResult, runtime }) {
  const parentItem = runtime.helpers.resolveItemRef(parent);
  const notePath = await resolveNotePath({
    bundleReader,
    runResult,
  });

  if (!notePath) {
    return {
      notes: [],
      skipped: true,
      reason: "note_path is empty",
    };
  }

  const noteCandidates = resolveBundleEntryPath(notePath, "result/conversation-note.md");
  if (noteCandidates.length === 0) {
    return {
      notes: [],
      skipped: true,
      reason: "note_path not found in bundle",
      note_path: notePath,
    };
  }

  let markdown = "";
  let noteEntry = "";
  let lastError = null;
  for (const candidate of noteCandidates) {
    try {
      markdown = await bundleReader.readText(candidate);
      noteEntry = candidate;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!noteEntry) {
    return {
      notes: [],
      skipped: true,
      reason: "note_path not found in bundle",
      note_path: notePath,
      bundle_entry: noteCandidates[0],
      candidates: noteCandidates,
      last_error: String(
        lastError && lastError.message ? lastError.message : lastError || "unknown",
      ),
    };
  }
  const title = `Conversation Note ${formatLocalTimestamp()}`;
  const noteContent = [
    '<div data-zs-note-kind="conversation-note">',
    `<h1>${escapeHtml(title)}</h1>`,
    '<div data-zs-view="conversation-note-html">',
    renderMarkdownToHtml(markdown),
    "</div>",
    renderPayloadBlock("conversation-note-markdown", {
      version: 1,
      path: noteEntry,
      format: "markdown",
      content: markdown,
    }),
    "</div>",
  ].join("\n");

  const note = await runtime.handlers.parent.addNote(parentItem, {
    content: noteContent,
  });

  return {
    notes: [note],
    note_path: noteEntry,
    title,
  };
}
