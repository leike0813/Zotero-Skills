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

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }
  return [];
}

function renderReferencesTable(references) {
  const headers = ["#", "Citekey", "Year", "Title", "Authors"];
  const rows = references.map((entry, index) => {
    const citekey = String(entry?.citekey || entry?.citeKey || "").trim();
    const year = String(entry?.year || "");
    const title = String(entry?.title || "");
    const authors = asArray(entry?.author || entry?.authors).join("; ");

    return `<tr>
<td>${index + 1}</td>
<td>${escapeHtml(citekey)}</td>
<td>${escapeHtml(year)}</td>
<td>${escapeHtml(title)}</td>
<td>${escapeHtml(authors)}</td>
</tr>`;
  });

  return [
    '<table data-zs-view="references-table">',
    "<thead>",
    "<tr>",
    ...headers.map((header) => `<th>${escapeHtml(header)}</th>`),
    "</tr>",
    "</thead>",
    "<tbody>",
    rows.join("\n"),
    "</tbody>",
    "</table>",
  ].join("\n");
}

function renderPayloadBlock(payloadType, payload) {
  const json = JSON.stringify(payload);
  const encoded = encodeBase64Utf8(json);
  return `<span data-zs-block="payload" data-zs-payload="${escapeAttribute(payloadType)}" data-zs-version="1" data-zs-encoding="base64" data-zs-value="${escapeAttribute(encoded)}"></span>`;
}

function parseGeneratedNoteKind(noteContent) {
  const text = String(noteContent || "");

  if (/data-zs-payload=(["'])digest-markdown\1/i.test(text)) {
    return "digest";
  }
  if (/data-zs-payload=(["'])references-json\1/i.test(text)) {
    return "references";
  }

  const kindMatch = text.match(
    /data-zs-note-kind\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
  );
  const kind = kindMatch
    ? String(kindMatch[1] || kindMatch[2] || kindMatch[3] || "")
    : "";
  if (kind === "digest" || kind === "references") {
    return kind;
  }
  if (kind === "literature-digest") {
    return "digest";
  }

  const hasDigestHeading =
    /<h1[^>]*>\s*Digest\s*<\/h1>/i.test(text) ||
    /<p[^>]*>\s*(?:<strong>)?\s*Digest\s*(?:<\/strong>)?\s*<\/p>/i.test(
      text,
    ) ||
    /(^|\n)\s*#\s*Digest\s*($|\n)/i.test(text) ||
    /<h1[^>]*>\s*Literature Digest\s*<\/h1>/i.test(text) ||
    /<p[^>]*>\s*(?:<strong>)?\s*Literature Digest\s*(?:<\/strong>)?\s*<\/p>/i.test(
      text,
    ) ||
    /(^|\n)\s*#\s*Literature Digest\s*($|\n)/i.test(text);
  const hasReferencesHeading =
    /<h1[^>]*>\s*References(?:\s+JSON)?\s*<\/h1>/i.test(text) ||
    /<p[^>]*>\s*(?:<strong>)?\s*References(?:\s+JSON)?\s*(?:<\/strong>)?\s*<\/p>/i.test(
      text,
    ) ||
    /(^|\n)\s*#\s*References(?:\s+JSON)?\s*($|\n)/i.test(text);

  if (hasDigestHeading) {
    return "digest";
  }
  if (hasReferencesHeading) {
    return "references";
  }

  return "";
}

function collectGeneratedNotesByKind(parentItem, runtime) {
  const byKind = new Map([
    ["digest", []],
    ["references", []],
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
    return args.runtime.handlers.parent.addNote(args.parentItem, {
      content: args.content,
    });
  }

  const primary = existingNotes[0];
  await args.runtime.handlers.note.update(primary, {
    content: args.content,
  });
  for (let i = 1; i < existingNotes.length; i++) {
    await args.runtime.handlers.note.remove(existingNotes[i]);
  }
  return primary;
}

export async function applyResult({ parent, bundleReader, runtime }) {
  const helpers = runtime.helpers;
  const parentItem = helpers.resolveItemRef(parent);
  const resultJsonText = await bundleReader.readText("result/result.json");
  const result = JSON.parse(resultJsonText);

  const digestEntry = `artifacts/${helpers.basenameOrFallback(
    result?.data?.digest_path,
    "digest.md",
  )}`;
  const referencesEntry = `artifacts/${helpers.basenameOrFallback(
    result?.data?.references_path,
    "references.json",
  )}`;

  const digestMarkdown = await bundleReader.readText(digestEntry);
  const referencesJson = await bundleReader.readText(referencesEntry);

  let parsedReferences;
  try {
    parsedReferences = JSON.parse(referencesJson);
  } catch {
    parsedReferences = [];
  }
  const references = normalizeReferences(parsedReferences);

  const digestNoteContent = [
    '<div data-zs-note-kind="digest">',
    "<h1>Digest</h1>",
    '<div data-zs-view="digest-html">',
    renderMarkdownToHtml(digestMarkdown),
    "</div>",
    renderPayloadBlock("digest-markdown", {
      version: 1,
      entry: digestEntry,
      format: "markdown",
      content: digestMarkdown,
    }),
    "</div>",
  ].join("\n");

  const referencesNoteContent = [
    '<div data-zs-note-kind="references">',
    "<h1>References</h1>",
    renderReferencesTable(references),
    renderPayloadBlock("references-json", {
      version: 1,
      entry: referencesEntry,
      format: "json",
      references,
    }),
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

  return {
    notes: [digestNote, referencesNote],
  };
}
