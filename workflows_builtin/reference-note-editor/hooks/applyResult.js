const HTML_NS = "http://www.w3.org/1999/xhtml";
const GLOBAL_HOST_OPEN_KEY = "__zsWorkflowEditorHostOpen";
const GLOBAL_HOST_REGISTER_KEY = "__zsWorkflowEditorHostRegisterRenderer";
const RENDERER_ID = "reference-note-editor.default.v1";

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
    return Buffer.from(String(text || ""), "utf8").toString("base64");
  }
  if (typeof TextEncoder !== "undefined" && typeof btoa === "function") {
    const bytes = new TextEncoder().encode(String(text || ""));
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(String(text || ""))));
  }
  throw new Error("No base64 encoder available in current runtime");
}

function decodeBase64Utf8(text) {
  const encoded = String(text || "").trim();
  if (!encoded) {
    throw new Error("references payload data-zs-value is empty");
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(encoded, "base64").toString("utf8");
  }
  if (typeof TextDecoder !== "undefined" && typeof atob === "function") {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  if (typeof atob === "function") {
    return decodeURIComponent(escape(atob(encoded)));
  }
  throw new Error("No base64 decoder available in current runtime");
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const parsed = parseInt(hex, 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      const parsed = parseInt(dec, 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    })
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function readTagAttribute(tagText, attributeName) {
  const match = String(tagText || "").match(
    new RegExp(
      `${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i",
    ),
  );
  if (!match) {
    return "";
  }
  return String(match[1] || match[2] || match[3] || "");
}

function setTagAttribute(tagText, attributeName, nextValue) {
  const escaped = escapeAttribute(String(nextValue || ""));
  const regex = new RegExp(
    `(${attributeName}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s>]+)`,
    "i",
  );
  if (regex.test(tagText)) {
    return String(tagText || "").replace(regex, `$1"${escaped}"`);
  }
  return String(tagText || "").replace(/>$/, ` ${attributeName}="${escaped}">`);
}

function parseReferencesPayload(noteContent, runtime) {
  const payloadTagMatch = String(noteContent || "").match(
    /<span[^>]*data-zs-payload=(["'])references-json\1[^>]*>/i,
  );
  if (!payloadTagMatch) {
    throw new Error("references payload block not found in note");
  }
  const payloadTag = payloadTagMatch[0];
  const encoding = (
    readTagAttribute(payloadTag, "data-zs-encoding") || "base64"
  ).toLowerCase();
  const encodedValue = decodeHtmlEntities(
    readTagAttribute(payloadTag, "data-zs-value"),
  );
  let jsonText = "";
  if (encoding === "base64") {
    jsonText = decodeBase64Utf8(encodedValue);
  } else if (encoding === "plain" || encoding === "utf8") {
    jsonText = encodedValue;
  } else {
    throw new Error(`Unsupported references payload encoding: ${encoding}`);
  }

  let payload = null;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new Error("references payload JSON is malformed");
  }
  const references = runtime.helpers.normalizeReferencesPayload(payload);
  return {
    payload,
    references,
    payloadTag,
  };
}

function normalizeReferenceAuthors(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeReferenceEntry(entry, index) {
  const normalized = entry && typeof entry === "object" ? { ...entry } : {};
  const id = String(normalized.id || `ref-${index + 1}`).trim();
  const title = String(normalized.title || "").trim();
  const year = String(normalized.year || "").trim();
  const rawText = String(normalized.rawText || "").trim();
  const citekey = String(normalized.citekey || normalized.citeKey || "").trim();
  const author = normalizeReferenceAuthors(normalized.author || normalized.authors);
  const output = {
    ...normalized,
    id,
    title,
    year,
    author,
    rawText,
  };
  const optionalFields = [
    "publicationTitle",
    "conferenceName",
    "university",
    "archiveID",
    "volume",
    "issue",
    "pages",
    "place",
  ];
  for (const field of optionalFields) {
    const value = String(output[field] || "").trim();
    if (value) {
      output[field] = value;
    } else {
      delete output[field];
    }
  }
  if (citekey) {
    output.citekey = citekey;
  } else {
    delete output.citekey;
    delete output.citeKey;
  }
  return output;
}

function normalizeReferencesArray(value) {
  const refs = Array.isArray(value) ? value : [];
  return refs.map((entry, index) => normalizeReferenceEntry(entry, index));
}

function replaceReferencesTable(noteContent, tableHtml) {
  const pattern =
    /<table[^>]*data-zs-view=(["'])references-table\1[^>]*>[\s\S]*?<\/table>/i;
  if (pattern.test(noteContent)) {
    return String(noteContent).replace(pattern, tableHtml);
  }
  const payloadTagPattern =
    /<span[^>]*data-zs-payload=(["'])references-json\1[^>]*>/i;
  if (payloadTagPattern.test(noteContent)) {
    return String(noteContent).replace(payloadTagPattern, `${tableHtml}$&`);
  }
  return `${String(noteContent || "")}\n${tableHtml}`;
}

function updatePayloadBlock(noteContent, payloadTag, nextPayload) {
  const nextEncoded = encodeBase64Utf8(JSON.stringify(nextPayload));
  let nextTag = setTagAttribute(payloadTag, "data-zs-encoding", "base64");
  nextTag = setTagAttribute(nextTag, "data-zs-value", nextEncoded);
  return String(noteContent).replace(payloadTag, nextTag);
}

function parseReferencesNoteKind(noteContent) {
  const payloadType = String(noteContent || "").match(
    /data-zs-payload\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
  );
  if (payloadType) {
    const parsed = String(
      payloadType[1] || payloadType[2] || payloadType[3] || "",
    );
    if (parsed === "references-json") {
      return "references";
    }
  }
  const kind = String(noteContent || "").match(
    /data-zs-note-kind\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
  );
  const parsedKind = kind
    ? String(kind[1] || kind[2] || kind[3] || "")
    : "";
  return parsedKind === "references" ? "references" : "";
}

function resolveSelectedReferenceNote(runResult, runtime) {
  const selectionContext = runResult?.resultJson?.selectionContext;
  const notes = Array.isArray(selectionContext?.items?.notes)
    ? selectionContext.items.notes
    : [];
  if (notes.length !== 1) {
    throw new Error(
      `reference-note-editor expects exactly one selected references note, got ${notes.length}`,
    );
  }
  const noteRef =
    typeof notes[0]?.item?.id === "number"
      ? notes[0].item.id
      : String(notes[0]?.item?.key || "").trim();
  if (!noteRef) {
    throw new Error("reference-note-editor cannot resolve selected note reference");
  }
  const noteItem = runtime.helpers.resolveItemRef(noteRef);
  const noteContent = String(noteItem.getNote?.() || "");
  if (parseReferencesNoteKind(noteContent) !== "references") {
    throw new Error("selected note is not a references note");
  }
  return {
    noteItem,
    noteContent,
  };
}

function resolveEditorHostBridge() {
  const runtime = globalThis;
  const openFromGlobal =
    typeof runtime[GLOBAL_HOST_OPEN_KEY] === "function"
      ? runtime[GLOBAL_HOST_OPEN_KEY]
      : null;
  const registerFromGlobal =
    typeof runtime[GLOBAL_HOST_REGISTER_KEY] === "function"
      ? runtime[GLOBAL_HOST_REGISTER_KEY]
      : null;
  const host =
    typeof addon !== "undefined" ? addon?.data?.workflowEditorHost : null;
  const openFromAddon =
    host && typeof host.open === "function" ? host.open.bind(host) : null;
  const registerFromAddon =
    host && typeof host.registerRenderer === "function"
      ? host.registerRenderer.bind(host)
      : null;

  const open = openFromAddon || openFromGlobal;
  if (!open) {
    throw new Error("workflow editor host bridge is unavailable");
  }
  return {
    open,
    registerRenderer: registerFromAddon || registerFromGlobal,
  };
}

function resolveParentInfo(noteItem) {
  const parentID = noteItem?.parentItemID || null;
  if (!parentID) {
    return {
      parentID: null,
      parentTitle: "",
    };
  }
  const parent = Zotero.Items.get(parentID);
  return {
    parentID,
    parentTitle: String(parent?.getField?.("title") || "").trim(),
  };
}

function normalizeEditorResultReferences(editorResult, fallbackReferences) {
  if (!editorResult || editorResult.saved !== true) {
    return null;
  }
  const fromResult =
    Array.isArray(editorResult.result) ? editorResult.result : null;
  const fromCompat =
    Array.isArray(editorResult.references) ? editorResult.references : null;
  if (!fromResult && !fromCompat) {
    return normalizeReferencesArray(fallbackReferences);
  }
  return normalizeReferencesArray(fromResult || fromCompat);
}

function createHtmlElement(doc, tag) {
  return doc.createElementNS(HTML_NS, tag);
}

function clearChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function styleInput(input) {
  input.style.width = "100%";
  input.style.boxSizing = "border-box";
  input.style.border = "1px solid #8f8f9d";
  input.style.borderRadius = "4px";
  input.style.padding = "4px 6px";
  input.style.fontSize = "13px";
  input.style.color = "#222";
  input.style.background = "#fff";
}

function toAuthorText(authors) {
  return Array.isArray(authors) ? authors.join("; ") : "";
}

function toAuthorsFromText(value) {
  return String(value || "")
    .split(/[;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readOptionalField(entry, key) {
  return String(entry?.[key] || "").trim();
}

function writeOptionalField(entry, key, value) {
  const nextValue = String(value || "").trim();
  if (nextValue) {
    entry[key] = nextValue;
  } else {
    delete entry[key];
  }
}

function renderField(doc, args) {
  const wrap = createHtmlElement(doc, "div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.gap = "2px";
  wrap.style.minWidth = "0";

  const label = createHtmlElement(doc, "label");
  label.textContent = args.label;
  label.style.fontSize = "12px";
  label.style.color = "#555";
  wrap.appendChild(label);
  wrap.appendChild(args.input);
  return wrap;
}

function createReferenceRenderer() {
  return {
    render({ doc, root, state, context, host }) {
      clearChildren(root);
      const references = Array.isArray(state.references) ? state.references : [];

      root.style.width = "100%";
      root.style.height = "100%";
      root.style.boxSizing = "border-box";
      root.style.overflow = "hidden";

      const panel = createHtmlElement(doc, "div");
      panel.style.width = "100%";
      panel.style.height = "100%";
      panel.style.display = "flex";
      panel.style.flexDirection = "column";
      panel.style.boxSizing = "border-box";
      panel.style.gap = "8px";
      panel.style.padding = "6px";

      const header = createHtmlElement(doc, "div");
      header.style.display = "flex";
      header.style.flexDirection = "column";
      header.style.gap = "4px";
      const title = createHtmlElement(doc, "h3");
      title.style.margin = "0";
      title.textContent = "Reference Note Editor";
      header.appendChild(title);
      const contextLine = createHtmlElement(doc, "div");
      contextLine.style.fontSize = "12px";
      contextLine.style.color = "#555";
      const parentTitle = String(context?.parentTitle || "").trim();
      const progressLabel = String(context?.progressLabel || "Item 1/1").trim();
      contextLine.textContent = `Target Parent: ${parentTitle || "(no parent)"} | ${progressLabel}`;
      header.appendChild(contextLine);
      panel.appendChild(header);

      const toolbar = createHtmlElement(doc, "div");
      toolbar.style.display = "flex";
      toolbar.style.alignItems = "center";
      toolbar.style.justifyContent = "space-between";
      toolbar.style.gap = "10px";

      const hint = createHtmlElement(doc, "div");
      hint.textContent =
        "Edit references, then Save to rewrite payload + rendered table.";
      hint.style.fontSize = "12px";
      hint.style.color = "#555";
      toolbar.appendChild(hint);

      const addBtn = createHtmlElement(doc, "button");
      addBtn.type = "button";
      addBtn.textContent = "Add Row";
      addBtn.addEventListener("click", () => {
        host.patchState((draft) => {
          const list = Array.isArray(draft.references) ? draft.references : [];
          list.push({
            id: `ref-${list.length + 1}`,
            title: "",
            year: "",
            author: [],
            citekey: "",
            rawText: "",
            publicationTitle: "",
            conferenceName: "",
            university: "",
            archiveID: "",
            volume: "",
            issue: "",
            pages: "",
            place: "",
          });
          draft.references = list;
        });
      });
      toolbar.appendChild(addBtn);
      panel.appendChild(toolbar);

      const listWrap = createHtmlElement(doc, "div");
      listWrap.style.flex = "1 1 auto";
      listWrap.style.minHeight = "460px";
      listWrap.style.maxHeight = "100%";
      listWrap.style.overflowY = "auto";
      listWrap.style.overflowX = "hidden";
      listWrap.style.border = "1px solid #d7d7de";
      listWrap.style.borderRadius = "6px";
      listWrap.style.padding = "8px";
      listWrap.style.boxSizing = "border-box";
      listWrap.style.background = "#fafafa";
      listWrap.style.display = "flex";
      listWrap.style.flexDirection = "column";
      listWrap.style.gap = "8px";

      if (references.length === 0) {
        const empty = createHtmlElement(doc, "div");
        empty.style.color = "#666";
        empty.textContent = "No references. Click Add Row to create one.";
        listWrap.appendChild(empty);
      }

      references.forEach((entry, index) => {
        const row = createHtmlElement(doc, "div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "34px minmax(0, 1fr) 34px";
        row.style.gap = "8px";
        row.style.border = "1px solid #d8d8dd";
        row.style.borderRadius = "6px";
        row.style.background = "#fff";
        row.style.padding = "8px";

        const idx = createHtmlElement(doc, "div");
        idx.textContent = String(index + 1);
        idx.style.fontWeight = "600";
        idx.style.color = "#444";
        idx.style.fontSize = "13px";
        idx.style.paddingTop = "4px";
        idx.style.textAlign = "center";
        row.appendChild(idx);

        const content = createHtmlElement(doc, "div");
        content.style.display = "flex";
        content.style.flexDirection = "column";
        content.style.gap = "6px";
        content.style.minWidth = "0";

        const topGrid = createHtmlElement(doc, "div");
        topGrid.style.display = "grid";
        topGrid.style.gridTemplateColumns =
          "minmax(360px, 4fr) minmax(88px, 0.8fr) minmax(200px, 1.4fr)";
        topGrid.style.gap = "8px";

        const titleInput = createHtmlElement(doc, "input");
        titleInput.type = "text";
        titleInput.value = String(entry.title || "");
        styleInput(titleInput);
        titleInput.addEventListener("input", () => {
          entry.title = String(titleInput.value || "").trim();
        });
        topGrid.appendChild(
          renderField(doc, {
            label: "Title",
            input: titleInput,
          }),
        );

        const yearInput = createHtmlElement(doc, "input");
        yearInput.type = "text";
        yearInput.value = String(entry.year || "");
        styleInput(yearInput);
        yearInput.addEventListener("input", () => {
          entry.year = String(yearInput.value || "").trim();
        });
        topGrid.appendChild(
          renderField(doc, {
            label: "Year",
            input: yearInput,
          }),
        );

        const citekeyInput = createHtmlElement(doc, "input");
        citekeyInput.type = "text";
        citekeyInput.value = String(entry.citekey || "");
        styleInput(citekeyInput);
        citekeyInput.addEventListener("input", () => {
          const value = String(citekeyInput.value || "").trim();
          if (value) {
            entry.citekey = value;
          } else {
            delete entry.citekey;
            delete entry.citeKey;
          }
        });
        topGrid.appendChild(
          renderField(doc, {
            label: "Citekey",
            input: citekeyInput,
          }),
        );
        content.appendChild(topGrid);

        const sourceGrid = createHtmlElement(doc, "div");
        sourceGrid.style.display = "grid";
        sourceGrid.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
        sourceGrid.style.gap = "8px";
        const sourceFieldDefs = [
          { key: "publicationTitle", label: "Publication" },
          { key: "conferenceName", label: "Conference" },
          { key: "university", label: "University" },
          { key: "archiveID", label: "Archive ID" },
        ];
        for (const fieldDef of sourceFieldDefs) {
          const input = createHtmlElement(doc, "input");
          input.type = "text";
          input.value = readOptionalField(entry, fieldDef.key);
          styleInput(input);
          input.addEventListener("input", () => {
            writeOptionalField(entry, fieldDef.key, input.value);
          });
          sourceGrid.appendChild(
            renderField(doc, {
              label: fieldDef.label,
              input,
            }),
          );
        }
        content.appendChild(sourceGrid);

        const locatorGrid = createHtmlElement(doc, "div");
        locatorGrid.style.display = "grid";
        locatorGrid.style.gridTemplateColumns =
          "minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(160px, 1.2fr) minmax(160px, 1.2fr)";
        locatorGrid.style.gap = "8px";
        const locatorFieldDefs = [
          { key: "volume", label: "Volume" },
          { key: "issue", label: "Issue" },
          { key: "pages", label: "Pages" },
          { key: "place", label: "Place" },
        ];
        for (const fieldDef of locatorFieldDefs) {
          const input = createHtmlElement(doc, "input");
          input.type = "text";
          input.value = readOptionalField(entry, fieldDef.key);
          styleInput(input);
          input.addEventListener("input", () => {
            writeOptionalField(entry, fieldDef.key, input.value);
          });
          locatorGrid.appendChild(
            renderField(doc, {
              label: fieldDef.label,
              input,
            }),
          );
        }
        content.appendChild(locatorGrid);

        const authorsArea = createHtmlElement(doc, "textarea");
        authorsArea.rows = 2;
        authorsArea.value = toAuthorText(entry.author);
        styleInput(authorsArea);
        authorsArea.addEventListener("input", () => {
          entry.author = toAuthorsFromText(authorsArea.value);
        });
        content.appendChild(
          renderField(doc, {
            label: "Authors (use ';' or newline)",
            input: authorsArea,
          }),
        );

        const rawTextArea = createHtmlElement(doc, "textarea");
        rawTextArea.rows = 4;
        rawTextArea.value = String(entry.rawText || "");
        styleInput(rawTextArea);
        rawTextArea.style.lineHeight = "1.35";
        rawTextArea.style.minHeight = "90px";
        rawTextArea.style.whiteSpace = "pre-wrap";
        rawTextArea.style.wordBreak = "break-word";
        rawTextArea.style.color = "#111";
        rawTextArea.addEventListener("input", () => {
          const value = String(rawTextArea.value || "").trim();
          if (value) {
            entry.rawText = value;
          } else {
            delete entry.rawText;
          }
        });
        content.appendChild(
          renderField(doc, {
            label: "Raw Text",
            input: rawTextArea,
          }),
        );
        row.appendChild(content);

        const actions = createHtmlElement(doc, "div");
        actions.style.display = "flex";
        actions.style.flexDirection = "column";
        actions.style.alignItems = "stretch";
        actions.style.gap = "4px";
        actions.style.paddingTop = "20px";

        const moveUp = createHtmlElement(doc, "button");
        moveUp.type = "button";
        moveUp.title = "Move up";
        moveUp.textContent = "↑";
        moveUp.disabled = index === 0;
        moveUp.addEventListener("click", () => {
          if (index === 0) return;
          host.patchState((draft) => {
            const list = Array.isArray(draft.references) ? draft.references : [];
            const prev = list[index - 1];
            list[index - 1] = list[index];
            list[index] = prev;
            draft.references = list;
          });
        });
        actions.appendChild(moveUp);

        const moveDown = createHtmlElement(doc, "button");
        moveDown.type = "button";
        moveDown.title = "Move down";
        moveDown.textContent = "↓";
        moveDown.disabled = index >= references.length - 1;
        moveDown.addEventListener("click", () => {
          if (index >= references.length - 1) return;
          host.patchState((draft) => {
            const list = Array.isArray(draft.references) ? draft.references : [];
            const next = list[index + 1];
            list[index + 1] = list[index];
            list[index] = next;
            draft.references = list;
          });
        });
        actions.appendChild(moveDown);

        const remove = createHtmlElement(doc, "button");
        remove.type = "button";
        remove.title = "Delete row";
        remove.textContent = "✕";
        remove.addEventListener("click", () => {
          host.patchState((draft) => {
            const list = Array.isArray(draft.references) ? draft.references : [];
            list.splice(index, 1);
            draft.references = list;
          });
        });
        actions.appendChild(remove);
        row.appendChild(actions);
        listWrap.appendChild(row);
      });

      panel.appendChild(listWrap);
      root.appendChild(panel);
    },
    serialize({ state }) {
      return normalizeReferencesArray(state.references || []);
    },
  };
}

async function openReferenceEditor(args) {
  const host = resolveEditorHostBridge();
  if (typeof host.registerRenderer === "function") {
    host.registerRenderer(RENDERER_ID, createReferenceRenderer());
  }
  return host.open({
    rendererId: RENDERER_ID,
    title: String(args.title || "Reference Note Editor"),
    context: args.context || {},
    initialState: {
      references: normalizeReferencesArray(args.references || []),
    },
    layout: {
      width: 1160,
      height: 820,
      minWidth: 1000,
      minHeight: 700,
      maxWidth: 1500,
      maxHeight: 1080,
      padding: 4,
    },
    labels: {
      save: "Save",
      cancel: "Cancel",
    },
  });
}

export async function applyResult({ runResult, runtime, manifest }) {
  const { noteItem, noteContent } = resolveSelectedReferenceNote(
    runResult,
    runtime,
  );
  const { payload, references, payloadTag } = parseReferencesPayload(
    noteContent,
    runtime,
  );
  const parent = resolveParentInfo(noteItem);
  const editorResult = await openReferenceEditor({
    title: [
      String(manifest?.label || "Reference Note Editor").trim(),
      parent.parentTitle,
    ]
      .filter(Boolean)
      .join(" - "),
    references: normalizeReferencesArray(references),
    context: {
      parentTitle: parent.parentTitle,
      progressLabel: "Item 1/1",
    },
  });

  const nextReferences = normalizeEditorResultReferences(editorResult, references);
  if (!nextReferences) {
    const reason = String(editorResult?.reason || "canceled").trim();
    throw new Error(`reference-note-editor canceled by user: ${reason}`);
  }

  const nextPayload = runtime.helpers.replacePayloadReferences(
    payload,
    nextReferences,
  );
  const withPayload = updatePayloadBlock(noteContent, payloadTag, nextPayload);
  const nextNoteContent = replaceReferencesTable(
    withPayload,
    runtime.helpers.renderReferencesTable(nextReferences),
  );
  await runtime.handlers.note.update(noteItem, {
    content: nextNoteContent,
  });

  return {
    updated: 1,
    total: nextReferences.length,
  };
}
