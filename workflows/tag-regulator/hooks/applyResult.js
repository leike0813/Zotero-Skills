const GLOBAL_HOST_OPEN_KEY = "__zsWorkflowEditorHostOpen";
const GLOBAL_HOST_REGISTER_KEY = "__zsWorkflowEditorHostRegisterRenderer";
const GLOBAL_TAG_VOCAB_BRIDGE_KEY = "__zsTagVocabularyBridge";
const SUGGEST_TAGS_RENDERER_ID = "tag-regulator.suggest-tags.v1";
const SUGGEST_TAGS_SOURCE = "agent-suggest";
const DEFAULT_PREFS_PREFIX = "extensions.zotero.zotero-skills";
const TAG_VOCAB_PREF_SUFFIX = "tagVocabularyJson";
const TAG_PATTERN = /^[a-z_]+:[a-zA-Z0-9/_.-]+$/;
const FACETS = [
  "field",
  "topic",
  "method",
  "model",
  "ai_task",
  "data",
  "tool",
  "status",
];

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value) {
  return String(value || "").trim();
}

function normalizeUniqueStringArray(value) {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      values: [],
      reason: "expected array",
    };
  }
  const seen = new Set();
  const values = [];
  for (let i = 0; i < value.length; i++) {
    const text = asString(value[i]);
    if (!text) {
      return {
        ok: false,
        values: [],
        reason: `entry[${i}] must be non-empty string`,
      };
    }
    if (seen.has(text)) {
      continue;
    }
    seen.add(text);
    values.push(text);
  }
  return {
    ok: true,
    values,
    reason: "",
  };
}

function normalizeAdvisoryStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const values = [];
  for (const entry of value) {
    const text = asString(entry);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    values.push(text);
  }
  return values;
}

function normalizeSuggestTagEntries(value) {
  if (typeof value === "undefined" || value === null) {
    return {
      ok: true,
      entries: [],
      reason: "",
    };
  }
  if (!Array.isArray(value)) {
    return {
      ok: false,
      entries: [],
      reason: "expected array",
    };
  }
  const seen = new Set();
  const entries = [];
  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    if (!isObject(entry)) {
      return {
        ok: false,
        entries: [],
        reason: `entry[${i}] must be object`,
      };
    }
    const tag = asString(entry.tag);
    if (!tag) {
      return {
        ok: false,
        entries: [],
        reason: `entry[${i}].tag must be non-empty string`,
      };
    }
    if (typeof entry.note !== "string") {
      return {
        ok: false,
        entries: [],
        reason: `entry[${i}].note must be string`,
      };
    }
    const lowered = tag.toLowerCase();
    if (seen.has(lowered)) {
      continue;
    }
    seen.add(lowered);
    entries.push({
      tag,
      note: asString(entry.note),
    });
  }
  return {
    ok: true,
    entries,
    reason: "",
  };
}

function clearChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function createHtmlElement(doc, tag) {
  return doc.createElementNS("http://www.w3.org/1999/xhtml", tag);
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
    typeof addon !== "undefined" && addon?.data?.workflowEditorHost
      ? addon.data.workflowEditorHost
      : null;
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

function normalizeDialogSelectedTags(selected, suggestTagEntries) {
  const allow = new Set(
    (Array.isArray(suggestTagEntries) ? suggestTagEntries : [])
      .map((entry) => asString(entry?.tag))
      .filter(Boolean),
  );
  const values = Array.isArray(selected) ? selected : [];
  const seen = new Set();
  const normalized = [];
  for (const entry of values) {
    const text = asString(entry);
    if (!text || seen.has(text) || !allow.has(text)) {
      continue;
    }
    seen.add(text);
    normalized.push(text);
  }
  return normalized;
}

function normalizeDialogResult(openResult, suggestTagEntries) {
  const response = isObject(openResult) ? openResult : {};
  const saved = response.saved === true;
  if (!saved) {
    return {
      opened: true,
      canceled: true,
      reason: asString(response.reason || "canceled"),
      selectedTags: [],
    };
  }
  const result = isObject(response.result) ? response.result : {};
  const selectedRaw = Array.isArray(result.selectedTags)
    ? result.selectedTags
    : Array.isArray(response.selectedTags)
      ? response.selectedTags
      : Array.isArray(response.result)
        ? response.result
        : [];
  return {
    opened: true,
    canceled: false,
    reason: "",
    selectedTags: normalizeDialogSelectedTags(selectedRaw, suggestTagEntries),
  };
}

function resolvePrefsPrefix() {
  if (
    typeof addon !== "undefined" &&
    addon &&
    addon.data &&
    addon.data.config &&
    typeof addon.data.config.prefsPrefix === "string" &&
    addon.data.config.prefsPrefix.trim()
  ) {
    return addon.data.config.prefsPrefix.trim();
  }
  const globalAddon = globalThis?.addon;
  if (
    globalAddon &&
    globalAddon.data &&
    globalAddon.data.config &&
    typeof globalAddon.data.config.prefsPrefix === "string" &&
    globalAddon.data.config.prefsPrefix.trim()
  ) {
    return globalAddon.data.config.prefsPrefix.trim();
  }
  return DEFAULT_PREFS_PREFIX;
}

function resolvePrefsKey() {
  return `${resolvePrefsPrefix()}.${TAG_VOCAB_PREF_SUFFIX}`;
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    const facetCmp = String(left.facet || "").localeCompare(
      String(right.facet || ""),
      "en",
      { sensitivity: "base" },
    );
    if (facetCmp !== 0) {
      return facetCmp;
    }
    return String(left.tag || "").localeCompare(String(right.tag || ""), "en", {
      sensitivity: "base",
    });
  });
}

function collectValidationIssuesFallback(entries) {
  const issues = [];
  const seen = new Set();
  for (let i = 0; i < entries.length; i++) {
    const entry = isObject(entries[i]) ? entries[i] : {};
    const loc = `entry[${i}]`;
    const tag = asString(entry.tag);
    const facet = asString(entry.facet).toLowerCase();
    if (!FACETS.includes(facet)) {
      issues.push({
        code: "INVALID_FACET",
        message: `${loc}: facet '${facet}' is invalid`,
      });
    }
    if (!tag || !TAG_PATTERN.test(tag)) {
      issues.push({
        code: "INVALID_FORMAT",
        message: `${loc}: tag '${tag}' does not match required pattern`,
      });
    }
    const splitAt = tag.indexOf(":");
    const prefix = splitAt > 0 ? tag.slice(0, splitAt).toLowerCase() : "";
    if (prefix && facet && prefix !== facet) {
      issues.push({
        code: "FACET_FIELD_MATCH",
        message: `${loc}: facet '${facet}' does not match tag prefix '${prefix}'`,
      });
    }
    if (seen.has(tag.toLowerCase())) {
      issues.push({
        code: "DUPLICATE",
        message: `${loc}: tag '${tag}' duplicates existing entry`,
      });
    } else {
      seen.add(tag.toLowerCase());
    }
  }
  return issues;
}

function normalizePersistedEntries(entries) {
  return sortEntries(
    (Array.isArray(entries) ? entries : []).map((entry) => ({
      tag: asString(entry?.tag),
      facet: asString(entry?.facet).toLowerCase(),
      source: asString(entry?.source || "manual") || "manual",
      note: asString(entry?.note),
      deprecated: Boolean(entry?.deprecated),
    })),
  );
}

function fallbackLoadPersistedState() {
  const raw = Zotero.Prefs.get(resolvePrefsKey(), true);
  if (typeof raw !== "string" || !raw.trim()) {
    return {
      corrupted: false,
      entries: [],
      issues: [],
    };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      corrupted: true,
      entries: [],
      issues: [
        {
          code: "INVALID_JSON",
          message: "persisted payload is invalid JSON",
        },
      ],
    };
  }
  const entries = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.entries)
      ? parsed.entries
      : null;
  if (!entries) {
    return {
      corrupted: true,
      entries: [],
      issues: [
        {
          code: "INVALID_PAYLOAD",
          message: "persisted payload shape is invalid",
        },
      ],
    };
  }
  const normalized = normalizePersistedEntries(entries);
  const issues = collectValidationIssuesFallback(normalized);
  if (issues.length > 0) {
    return {
      corrupted: true,
      entries: [],
      issues,
    };
  }
  return {
    corrupted: false,
    entries: normalized,
    issues: [],
  };
}

function fallbackPersistEntries(entries) {
  const normalized = normalizePersistedEntries(entries);
  const issues = collectValidationIssuesFallback(normalized);
  if (issues.length > 0) {
    throw new Error(asString(issues[0]?.message || "tag vocabulary validation failed"));
  }
  Zotero.Prefs.set(
    resolvePrefsKey(),
    JSON.stringify({
      version: 1,
      entries: normalized,
    }),
    true,
  );
  return {
    version: 1,
    entries: normalized,
  };
}

function resolveTagVocabularyBridge() {
  const candidate = globalThis?.[GLOBAL_TAG_VOCAB_BRIDGE_KEY];
  if (
    candidate &&
    typeof candidate.loadPersistedState === "function" &&
    typeof candidate.persistEntries === "function"
  ) {
    return {
      loadPersistedState: candidate.loadPersistedState.bind(candidate),
      persistEntries: candidate.persistEntries.bind(candidate),
      collectValidationIssues:
        typeof candidate.collectValidationIssues === "function"
          ? candidate.collectValidationIssues.bind(candidate)
          : collectValidationIssuesFallback,
    };
  }
  return {
    loadPersistedState: fallbackLoadPersistedState,
    persistEntries: fallbackPersistEntries,
    collectValidationIssues: collectValidationIssuesFallback,
  };
}

function createSuggestTagsRenderer() {
  return {
    render({ doc, root, state, host }) {
      clearChildren(root);
      const suggestTags = normalizeSuggestTagEntries(state.suggestTagEntries);
      const suggestTagEntries = suggestTags.ok ? suggestTags.entries : [];
      const selectedTags = normalizeDialogSelectedTags(
        Array.isArray(state.selectedTags)
          ? state.selectedTags
          : suggestTagEntries.map((entry) => entry.tag),
        suggestTagEntries,
      );
      state.suggestTagEntries = suggestTagEntries;
      state.selectedTags = selectedTags;

      const panel = createHtmlElement(doc, "div");
      panel.style.display = "flex";
      panel.style.flexDirection = "column";
      panel.style.gap = "8px";
      panel.style.height = "100%";
      panel.style.boxSizing = "border-box";

      const hint = createHtmlElement(doc, "div");
      hint.textContent = "Select suggested tags to add into controlled vocabulary:";
      hint.style.fontSize = "12px";
      panel.appendChild(hint);

      const actionRow = createHtmlElement(doc, "div");
      actionRow.style.display = "flex";
      actionRow.style.gap = "8px";

      const selectAllBtn = createHtmlElement(doc, "button");
      selectAllBtn.type = "button";
      selectAllBtn.textContent = "Select All";
      selectAllBtn.addEventListener("click", () => {
        host.patchState((draft) => {
          draft.selectedTags = (Array.isArray(draft.suggestTagEntries)
            ? draft.suggestTagEntries
            : []
          ).map((entry) => asString(entry?.tag));
        });
      });
      actionRow.appendChild(selectAllBtn);

      const clearBtn = createHtmlElement(doc, "button");
      clearBtn.type = "button";
      clearBtn.textContent = "Clear";
      clearBtn.addEventListener("click", () => {
        host.patchState((draft) => {
          draft.selectedTags = [];
        });
      });
      actionRow.appendChild(clearBtn);
      panel.appendChild(actionRow);

      const list = createHtmlElement(doc, "div");
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "4px";
      list.style.overflowY = "auto";
      list.style.border = "1px solid #ddd";
      list.style.borderRadius = "4px";
      list.style.padding = "8px";
      list.style.maxHeight = "360px";

      const selectedSet = new Set(selectedTags);
      for (const suggestEntry of suggestTagEntries) {
        const tag = asString(suggestEntry.tag);
        const note = asString(suggestEntry.note);
        const option = createHtmlElement(doc, "label");
        option.style.display = "grid";
        option.style.gridTemplateColumns = "auto 1fr";
        option.style.alignItems = "start";
        option.style.gap = "8px";

        const checkbox = createHtmlElement(doc, "input");
        checkbox.type = "checkbox";
        checkbox.checked = selectedSet.has(tag);
        checkbox.addEventListener("change", () => {
          host.patchState((draft) => {
            const current = normalizeDialogSelectedTags(
              draft.selectedTags,
              draft.suggestTagEntries,
            );
            const next = new Set(current);
            if (checkbox.checked) {
              next.add(tag);
            } else {
              next.delete(tag);
            }
            draft.selectedTags = [...next];
          });
        });
        option.appendChild(checkbox);

        const content = createHtmlElement(doc, "div");
        content.style.display = "flex";
        content.style.flexDirection = "column";
        content.style.gap = "2px";

        const tagText = createHtmlElement(doc, "span");
        tagText.textContent = tag;
        tagText.style.fontFamily = "Consolas, Monaco, monospace";
        content.appendChild(tagText);

        if (note) {
          const noteText = createHtmlElement(doc, "span");
          noteText.textContent = note;
          noteText.style.fontSize = "11px";
          noteText.style.color = "#555";
          content.appendChild(noteText);
        }

        option.appendChild(content);
        list.appendChild(option);
      }
      panel.appendChild(list);

      root.appendChild(panel);
    },
    serialize({ state }) {
      const suggestTags = normalizeSuggestTagEntries(state.suggestTagEntries);
      const suggestTagEntries = suggestTags.ok ? suggestTags.entries : [];
      return {
        selectedTags: normalizeDialogSelectedTags(
          state.selectedTags,
          suggestTagEntries,
        ),
      };
    },
  };
}

async function openSuggestTagsDialog(args) {
  const suggestTags = normalizeSuggestTagEntries(args.suggestTagEntries);
  if (!suggestTags.ok) {
    return {
      opened: false,
      canceled: true,
      reason: `invalid suggest_tags: ${asString(suggestTags.reason || "malformed")}`,
      selectedTags: [],
    };
  }
  const suggestTagEntries = suggestTags.entries;
  if (suggestTagEntries.length === 0) {
    return {
      opened: false,
      canceled: false,
      reason: "",
      selectedTags: [],
    };
  }

  let bridge = null;
  try {
    bridge = resolveEditorHostBridge();
  } catch (error) {
    return {
      opened: false,
      canceled: true,
      reason: `dialog unavailable: ${asString(error?.message || error)}`,
      selectedTags: [],
    };
  }

  if (typeof bridge.registerRenderer === "function") {
    bridge.registerRenderer(SUGGEST_TAGS_RENDERER_ID, createSuggestTagsRenderer());
  }

  const openResult = await bridge.open({
    rendererId: SUGGEST_TAGS_RENDERER_ID,
    title: String(args.title || "Suggest Tags Intake"),
    initialState: {
      suggestTagEntries,
      selectedTags: suggestTagEntries.map((entry) => entry.tag),
    },
    layout: {
      width: 560,
      height: 520,
      minWidth: 480,
      minHeight: 420,
      maxWidth: 900,
      maxHeight: 900,
      padding: 8,
    },
    labels: {
      save: "加入受控词表",
      cancel: "取消",
    },
  });

  return normalizeDialogResult(openResult, suggestTagEntries);
}

function buildVocabularyEntryFromSuggestTag(suggestEntry) {
  const tagVocabularyBridge = resolveTagVocabularyBridge();
  const text = asString(suggestEntry?.tag);
  const note = asString(suggestEntry?.note);
  const splitAt = text.indexOf(":");
  if (splitAt <= 0 || splitAt === text.length - 1) {
    return {
      ok: false,
      entry: null,
      reason: "invalid tag format: expected facet:value",
    };
  }
  const facet = asString(text.slice(0, splitAt)).toLowerCase();
  const entry = {
    tag: text,
    facet,
    source: SUGGEST_TAGS_SOURCE,
    note,
    deprecated: false,
  };
  const issues = tagVocabularyBridge.collectValidationIssues([entry]);
  if (issues.length > 0) {
    return {
      ok: false,
      entry: null,
      reason: `invalid tag: ${asString(issues[0].message || issues[0].code || "unknown issue")}`,
    };
  }
  return {
    ok: true,
    entry,
    reason: "",
  };
}

function intakeSuggestTagsToVocabulary(args) {
  const tagVocabularyBridge = resolveTagVocabularyBridge();
  const suggestTagEntries = Array.isArray(args?.suggestTagEntries)
    ? args.suggestTagEntries
    : [];
  const noteByTag = new Map();
  for (const entry of suggestTagEntries) {
    const tag = asString(entry?.tag);
    if (!tag || noteByTag.has(tag.toLowerCase())) {
      continue;
    }
    noteByTag.set(tag.toLowerCase(), asString(entry?.note));
  }
  const summary = {
    selected: normalizeAdvisoryStringArray(args?.selectedTags),
    added: [],
    skipped: [],
    invalid: [],
  };
  if (summary.selected.length === 0) {
    return summary;
  }

  const loaded = tagVocabularyBridge.loadPersistedState();
  const existing = Array.isArray(loaded.entries) ? [...loaded.entries] : [];
  const existingLower = new Set(
    existing
      .map((entry) => asString(entry?.tag).toLowerCase())
      .filter((entry) => !!entry),
  );
  const nextEntries = [...existing];

  for (const tag of summary.selected) {
    const lowered = tag.toLowerCase();
    if (existingLower.has(lowered)) {
      summary.skipped.push(tag);
      continue;
    }
    const built = buildVocabularyEntryFromSuggestTag({
      tag,
      note: noteByTag.get(lowered) || "",
    });
    if (!built.ok || !built.entry) {
      summary.invalid.push({
        tag,
        reason: asString(built.reason || "invalid"),
      });
      continue;
    }
    nextEntries.push(built.entry);
    existingLower.add(lowered);
    summary.added.push(tag);
  }

  if (summary.added.length > 0) {
    try {
      tagVocabularyBridge.persistEntries(nextEntries);
    } catch (error) {
      const reason = `persist failed: ${asString(error?.message || error)}`;
      for (const tag of summary.added) {
        summary.invalid.push({
          tag,
          reason,
        });
      }
      summary.added = [];
    }
  }

  return summary;
}

async function collectSuggestTagsIntake(args) {
  const suggestTags = normalizeSuggestTagEntries(args.suggestTagEntries);
  if (!suggestTags.ok) {
    return {
      opened: false,
      canceled: true,
      reason: `invalid suggest_tags: ${asString(suggestTags.reason || "malformed")}`,
      selected: [],
      added: [],
      skipped: [],
      invalid: [],
    };
  }
  if (suggestTags.entries.length === 0) {
    return {
      opened: false,
      canceled: false,
      reason: "",
      selected: [],
      added: [],
      skipped: [],
      invalid: [],
    };
  }

  const dialog = await openSuggestTagsDialog({
    suggestTagEntries: suggestTags.entries,
    title: args.title,
  });
  if (!dialog.opened || dialog.canceled) {
    return {
      opened: dialog.opened,
      canceled: true,
      reason: asString(dialog.reason || "canceled"),
      selected: [],
      added: [],
      skipped: [],
      invalid: [],
    };
  }

  const intake = intakeSuggestTagsToVocabulary({
    selectedTags: dialog.selectedTags,
    suggestTagEntries: suggestTags.entries,
  });
  return {
    opened: true,
    canceled: false,
    reason: "",
    selected: intake.selected,
    added: intake.added,
    skipped: intake.skipped,
    invalid: intake.invalid,
  };
}

function resolveTagRegulatorOutput(runResult) {
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
    if (!isObject(candidate)) {
      continue;
    }
    const hasMutationFields =
      Object.prototype.hasOwnProperty.call(candidate, "remove_tags") ||
      Object.prototype.hasOwnProperty.call(candidate, "add_tags") ||
      Object.prototype.hasOwnProperty.call(candidate, "suggest_tags");
    const hasSkillError =
      Object.prototype.hasOwnProperty.call(candidate, "error") &&
      candidate.error !== null;
    if (hasMutationFields || hasSkillError) {
      return candidate;
    }
  }
  return null;
}

function collectCurrentTags(item) {
  const tags = Array.isArray(item.getTags?.()) ? item.getTags() : [];
  const seen = new Set();
  const values = [];
  for (const entry of tags) {
    const text = asString(entry?.tag);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    values.push(text);
  }
  return values;
}

async function applyTagMutations(item, removeTags, addTags) {
  const current = collectCurrentTags(item);
  const currentSet = new Set(current);

  const removed = [];
  for (const tag of removeTags) {
    if (!currentSet.has(tag)) {
      continue;
    }
    removed.push(tag);
    currentSet.delete(tag);
  }

  const added = [];
  for (const tag of addTags) {
    if (currentSet.has(tag)) {
      continue;
    }
    added.push(tag);
    currentSet.add(tag);
  }

  if (removed.length === 0 && added.length === 0) {
    return {
      changed: false,
      removed,
      added,
      current,
      next: [...currentSet],
    };
  }

  for (const tag of removed) {
    item.removeTag(tag);
  }
  for (const tag of added) {
    item.addTag(tag);
  }
  await item.saveTx();

  return {
    changed: true,
    removed,
    added,
    current,
    next: collectCurrentTags(item),
  };
}

export async function applyResult({ parent, runResult, runtime }) {
  const parentItem = runtime.helpers.resolveItemRef(parent);
  const output = resolveTagRegulatorOutput(runResult);
  if (!output) {
    return {
      applied: false,
      skipped: true,
      reason: "tag-regulator output malformed: missing result payload",
      removed: [],
      added: [],
      suggest_tags: [],
      warnings: [],
    };
  }

  const warnings = normalizeAdvisoryStringArray(output.warnings);
  const suggestTags = normalizeSuggestTagEntries(output.suggest_tags);
  if (!suggestTags.ok) {
    return {
      applied: false,
      skipped: true,
      reason: `tag-regulator output malformed: suggest_tags ${suggestTags.reason}`,
      removed: [],
      added: [],
      suggest_tags: [],
      warnings,
    };
  }
  const suggestTagEntries = suggestTags.entries;

  if (typeof output.error !== "undefined" && output.error !== null) {
    return {
      applied: false,
      skipped: true,
      reason: `skill error: ${asString(output.error?.message || output.error || "unknown error")}`,
      removed: [],
      added: [],
      suggest_tags: suggestTagEntries,
      warnings,
      error: output.error,
    };
  }

  const removeTags = normalizeUniqueStringArray(output.remove_tags);
  if (!removeTags.ok) {
    return {
      applied: false,
      skipped: true,
      reason: `tag-regulator output malformed: remove_tags ${removeTags.reason}`,
      removed: [],
      added: [],
      suggest_tags: suggestTagEntries,
      warnings,
    };
  }

  const addTags = normalizeUniqueStringArray(output.add_tags);
  if (!addTags.ok) {
    return {
      applied: false,
      skipped: true,
      reason: `tag-regulator output malformed: add_tags ${addTags.reason}`,
      removed: [],
      added: [],
      suggest_tags: suggestTagEntries,
      warnings,
    };
  }

  const mutation = await applyTagMutations(
    parentItem,
    removeTags.values,
    addTags.values,
  );

  const suggestIntake = await collectSuggestTagsIntake({
    suggestTagEntries,
    title: `Tag Regulator Suggest Tags - ${asString(parentItem?.getField?.("title") || "") || "Parent Item"}`,
  });

  return {
    applied: mutation.changed,
    skipped: false,
    removed: mutation.removed,
    added: mutation.added,
    suggest_tags: suggestTagEntries,
    suggest_intake: suggestIntake,
    warnings,
    before_tags: mutation.current,
    after_tags: mutation.next,
  };
}

export const __tagRegulatorApplyResultTestOnly = {
  buildVocabularyEntryFromSuggestTag,
  intakeSuggestTagsToVocabulary,
  normalizeDialogSelectedTags,
  normalizeSuggestTagEntries,
  normalizeUniqueStringArray,
  openSuggestTagsDialog,
  resolveTagRegulatorOutput,
};
