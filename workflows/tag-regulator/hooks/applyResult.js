const GLOBAL_HOST_OPEN_KEY = "__zsWorkflowEditorHostOpen";
const GLOBAL_HOST_REGISTER_KEY = "__zsWorkflowEditorHostRegisterRenderer";
const GLOBAL_TAG_VOCAB_BRIDGE_KEY = "__zsTagVocabularyBridge";
const SUGGEST_TAGS_RENDERER_ID = "tag-regulator.suggest-tags.v1";
const SUGGEST_TAGS_SOURCE = "agent-suggest";
const TAG_VOCAB_STAGED_PREF_SUFFIX = "tagVocabularyStagedJson";
const STAGED_SOURCE_FLOW = "tag-regulator-suggest";
const SUGGEST_DIALOG_TIMEOUT_SECONDS = 10;
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

function resolveStagedPrefsKey() {
  return `${resolvePrefsPrefix()}.${TAG_VOCAB_STAGED_PREF_SUFFIX}`;
}

function nowIsoTimestamp() {
  return new Date().toISOString();
}

function toIsoTimestamp(value) {
  const text = asString(value);
  if (!text) {
    return "";
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

function getTagPrefix(tag) {
  const text = asString(tag);
  const splitAt = text.indexOf(":");
  if (splitAt <= 0) {
    return "";
  }
  return text.slice(0, splitAt).toLowerCase();
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

function normalizePersistedStagedEntries(entries) {
  return sortEntries(
    (Array.isArray(entries) ? entries : []).map((entry) => {
      const tag = asString(entry?.tag);
      const facet = asString(entry?.facet).toLowerCase() || getTagPrefix(tag) || "topic";
      const createdAt = toIsoTimestamp(entry?.createdAt) || nowIsoTimestamp();
      const updatedAt = toIsoTimestamp(entry?.updatedAt) || createdAt;
      return {
        tag,
        facet,
        source: asString(entry?.source || SUGGEST_TAGS_SOURCE) || SUGGEST_TAGS_SOURCE,
        note: asString(entry?.note),
        deprecated: Boolean(entry?.deprecated),
        createdAt,
        updatedAt,
        sourceFlow:
          asString(entry?.sourceFlow || STAGED_SOURCE_FLOW) || STAGED_SOURCE_FLOW,
      };
    }),
  );
}

function fallbackLoadPersistedStagedState() {
  const raw = Zotero.Prefs.get(resolveStagedPrefsKey(), true);
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
          message: "persisted staged payload is invalid JSON",
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
          message: "persisted staged payload shape is invalid",
        },
      ],
    };
  }
  return {
    corrupted: false,
    entries: normalizePersistedStagedEntries(entries),
    issues: [],
  };
}

function fallbackPersistStagedEntries(entries) {
  const normalized = normalizePersistedStagedEntries(entries);
  Zotero.Prefs.set(
    resolveStagedPrefsKey(),
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
      loadPersistedStagedState:
        typeof candidate.loadPersistedStagedState === "function"
          ? candidate.loadPersistedStagedState.bind(candidate)
          : fallbackLoadPersistedStagedState,
      persistStagedEntries:
        typeof candidate.persistStagedEntries === "function"
          ? candidate.persistStagedEntries.bind(candidate)
          : fallbackPersistStagedEntries,
    };
  }
  return {
    loadPersistedState: fallbackLoadPersistedState,
    persistEntries: fallbackPersistEntries,
    collectValidationIssues: collectValidationIssuesFallback,
    loadPersistedStagedState: fallbackLoadPersistedStagedState,
    persistStagedEntries: fallbackPersistStagedEntries,
  };
}

function normalizeDialogSelectedTags(selected, suggestTagEntries) {
  const allow = new Set(
    (Array.isArray(suggestTagEntries) ? suggestTagEntries : [])
      .map((entry) => asString(entry?.tag).toLowerCase())
      .filter(Boolean),
  );
  const values = Array.isArray(selected) ? selected : [];
  const seen = new Set();
  const normalized = [];
  for (const entry of values) {
    const text = asString(entry);
    const lowered = text.toLowerCase();
    if (!text || seen.has(lowered) || !allow.has(lowered)) {
      continue;
    }
    seen.add(lowered);
    normalized.push(text);
  }
  return normalized;
}

function ensureArrayField(state, key) {
  if (!Array.isArray(state[key])) {
    state[key] = [];
  }
}

function ensureObjectField(state, key) {
  if (!isObject(state[key])) {
    state[key] = {};
  }
}

function addUniqueStrings(target, values) {
  if (!Array.isArray(target) || !Array.isArray(values)) {
    return;
  }
  const seen = new Set(target.map((entry) => asString(entry).toLowerCase()).filter(Boolean));
  for (const entry of values) {
    const text = asString(entry);
    const lowered = text.toLowerCase();
    if (!text || seen.has(lowered)) {
      continue;
    }
    seen.add(lowered);
    target.push(text);
  }
}

function addUniqueInvalid(target, invalidItems) {
  if (!Array.isArray(target) || !Array.isArray(invalidItems)) {
    return;
  }
  const indexByTag = new Map();
  for (let i = 0; i < target.length; i++) {
    const lowered = asString(target[i]?.tag).toLowerCase();
    if (lowered) {
      indexByTag.set(lowered, i);
    }
  }
  for (const item of invalidItems) {
    const tag = asString(item?.tag);
    if (!tag) {
      continue;
    }
    const lowered = tag.toLowerCase();
    const payload = {
      tag,
      reason: asString(item?.reason || "invalid"),
    };
    if (indexByTag.has(lowered)) {
      target[indexByTag.get(lowered)] = payload;
    } else {
      indexByTag.set(lowered, target.length);
      target.push(payload);
    }
  }
}

function removeSuggestEntriesByTags(entries, tags) {
  const lowered = new Set(
    (Array.isArray(tags) ? tags : [])
      .map((entry) => asString(entry).toLowerCase())
      .filter(Boolean),
  );
  return (Array.isArray(entries) ? entries : []).filter(
    (entry) => !lowered.has(asString(entry?.tag).toLowerCase()),
  );
}

function ensureSuggestDialogState(state) {
  const suggestTags = normalizeSuggestTagEntries(state?.suggestTagEntries);
  state.suggestTagEntries = suggestTags.ok ? suggestTags.entries : [];
  ensureObjectField(state, "rowErrors");
  ensureArrayField(state, "addedDirect");
  ensureArrayField(state, "staged");
  ensureArrayField(state, "rejected");
  ensureArrayField(state, "invalid");
  ensureArrayField(state, "skippedDirect");
  ensureArrayField(state, "stagedSkipped");
  if (!Number.isFinite(Number(state.countdownSeconds))) {
    state.countdownSeconds = SUGGEST_DIALOG_TIMEOUT_SECONDS;
  } else {
    state.countdownSeconds = Math.max(0, Number(state.countdownSeconds));
  }
  state.timedOut = state.timedOut === true;
  state.closePolicyApplied = state.closePolicyApplied === true;
}

function buildSuggestTagLookup(suggestTagEntries) {
  const map = new Map();
  for (const entry of Array.isArray(suggestTagEntries) ? suggestTagEntries : []) {
    const tag = asString(entry?.tag);
    if (!tag) {
      continue;
    }
    const lowered = tag.toLowerCase();
    if (map.has(lowered)) {
      continue;
    }
    map.set(lowered, {
      tag,
      note: asString(entry?.note),
    });
  }
  return map;
}

function buildStagedEntryFromSuggestTag(suggestEntry) {
  const tag = asString(suggestEntry?.tag);
  if (!tag) {
    return {
      ok: false,
      entry: null,
      reason: "missing tag",
    };
  }
  const now = nowIsoTimestamp();
  return {
    ok: true,
    entry: {
      tag,
      facet: getTagPrefix(tag) || "topic",
      source: SUGGEST_TAGS_SOURCE,
      note: asString(suggestEntry?.note),
      deprecated: false,
      createdAt: now,
      updatedAt: now,
      sourceFlow: STAGED_SOURCE_FLOW,
    },
    reason: "",
  };
}

function intakeSuggestTagsToStaged(args) {
  const tagVocabularyBridge = resolveTagVocabularyBridge();
  const suggestTagEntries = Array.isArray(args?.suggestTagEntries)
    ? args.suggestTagEntries
    : [];
  const suggestLookup = buildSuggestTagLookup(suggestTagEntries);
  const summary = {
    selected: normalizeAdvisoryStringArray(args?.selectedTags),
    staged: [],
    skipped: [],
    invalid: [],
  };
  if (summary.selected.length === 0) {
    return summary;
  }

  const controlledLoaded = tagVocabularyBridge.loadPersistedState();
  const controlledLower = new Set(
    (Array.isArray(controlledLoaded.entries) ? controlledLoaded.entries : [])
      .map((entry) => asString(entry?.tag).toLowerCase())
      .filter(Boolean),
  );

  const stagedLoaded = tagVocabularyBridge.loadPersistedStagedState();
  const existingStaged = Array.isArray(stagedLoaded.entries)
    ? [...stagedLoaded.entries]
    : [];
  const stagedLower = new Set(
    existingStaged
      .map((entry) => asString(entry?.tag).toLowerCase())
      .filter(Boolean),
  );
  const nextStaged = [...existingStaged];

  for (const tag of summary.selected) {
    const lowered = tag.toLowerCase();
    if (controlledLower.has(lowered) || stagedLower.has(lowered)) {
      summary.skipped.push(tag);
      continue;
    }
    const source = suggestLookup.get(lowered);
    if (!source) {
      summary.invalid.push({
        tag,
        reason: "missing suggest tag entry",
      });
      continue;
    }
    const built = buildStagedEntryFromSuggestTag(source);
    if (!built.ok || !built.entry) {
      summary.invalid.push({
        tag,
        reason: asString(built.reason || "invalid"),
      });
      continue;
    }
    nextStaged.push(built.entry);
    stagedLower.add(lowered);
    summary.staged.push(tag);
  }

  if (summary.staged.length > 0) {
    try {
      tagVocabularyBridge.persistStagedEntries(nextStaged);
    } catch (error) {
      const reason = `persist staged failed: ${asString(error?.message || error)}`;
      for (const tag of summary.staged) {
        summary.invalid.push({
          tag,
          reason,
        });
      }
      summary.staged = [];
    }
  }

  return summary;
}

function applyJoinTagAction(state, tag) {
  ensureSuggestDialogState(state);
  const lowered = asString(tag).toLowerCase();
  if (!lowered) {
    return;
  }
  const entry = (Array.isArray(state.suggestTagEntries) ? state.suggestTagEntries : []).find(
    (item) => asString(item?.tag).toLowerCase() === lowered,
  );
  if (!entry) {
    return;
  }
  const intake = intakeSuggestTagsToVocabulary({
    selectedTags: [entry.tag],
    suggestTagEntries: [entry],
  });
  addUniqueStrings(state.addedDirect, intake.added);
  addUniqueStrings(state.skippedDirect, intake.skipped);
  addUniqueInvalid(state.invalid, intake.invalid);
  if (intake.invalid.length > 0) {
    state.rowErrors[lowered] = asString(
      intake.invalid[0]?.reason || "invalid suggest tag",
    );
    return;
  }
  delete state.rowErrors[lowered];
  state.suggestTagEntries = removeSuggestEntriesByTags(state.suggestTagEntries, [entry.tag]);
}

function applyRejectTagAction(state, tag) {
  ensureSuggestDialogState(state);
  const text = asString(tag);
  if (!text) {
    return;
  }
  const lowered = text.toLowerCase();
  addUniqueStrings(state.rejected, [text]);
  delete state.rowErrors[lowered];
  state.suggestTagEntries = removeSuggestEntriesByTags(state.suggestTagEntries, [text]);
}

function applyJoinAllAction(state) {
  ensureSuggestDialogState(state);
  const snapshot = [...state.suggestTagEntries];
  for (const entry of snapshot) {
    applyJoinTagAction(state, asString(entry?.tag));
  }
  return {
    closeable: state.suggestTagEntries.length === 0,
  };
}

function applyStageAllAction(state) {
  ensureSuggestDialogState(state);
  const remaining = (Array.isArray(state.suggestTagEntries) ? state.suggestTagEntries : []).map(
    (entry) => asString(entry?.tag),
  );
  if (remaining.length === 0) {
    return {
      closeable: true,
    };
  }
  const intake = intakeSuggestTagsToStaged({
    selectedTags: remaining,
    suggestTagEntries: state.suggestTagEntries,
  });
  addUniqueStrings(state.staged, intake.staged);
  addUniqueStrings(state.stagedSkipped, intake.skipped);
  addUniqueInvalid(state.invalid, intake.invalid);
  const processed = [...intake.staged, ...intake.skipped];
  state.suggestTagEntries = removeSuggestEntriesByTags(state.suggestTagEntries, processed);
  return {
    closeable: intake.invalid.length === 0,
  };
}

function applyRejectAllAction(state) {
  ensureSuggestDialogState(state);
  const remaining = (Array.isArray(state.suggestTagEntries) ? state.suggestTagEntries : []).map(
    (entry) => asString(entry?.tag),
  );
  addUniqueStrings(state.rejected, remaining);
  state.suggestTagEntries = [];
  state.rowErrors = {};
  return {
    closeable: true,
  };
}

function createSuggestTagsRenderer(options) {
  const runtime = options?.runtime || {};
  return {
    render({ doc, root, state, host }) {
      runtime.state = state;
      clearChildren(root);
      ensureSuggestDialogState(state);
      const suggestTagEntries = state.suggestTagEntries;

      const panel = createHtmlElement(doc, "div");
      panel.style.display = "flex";
      panel.style.flexDirection = "column";
      panel.style.gap = "8px";
      panel.style.height = "100%";
      panel.style.boxSizing = "border-box";

      const hint = createHtmlElement(doc, "div");
      hint.textContent =
        "逐条处理建议标签：加入=直接入受控词表；拒绝=直接废弃。未处理项在倒计时结束后自动暂存。";
      hint.style.fontSize = "12px";
      panel.appendChild(hint);

      const countdown = createHtmlElement(doc, "div");
      countdown.style.fontSize = "12px";
      countdown.style.color = state.countdownSeconds <= 3 ? "#b3261e" : "#444";
      countdown.textContent = `自动暂存倒计时：${state.countdownSeconds}s`;
      panel.appendChild(countdown);

      const list = createHtmlElement(doc, "div");
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "6px";
      list.style.overflowY = "auto";
      list.style.border = "1px solid #ddd";
      list.style.borderRadius = "4px";
      list.style.padding = "8px";
      list.style.maxHeight = "380px";

      const rowErrors = isObject(state.rowErrors) ? state.rowErrors : {};
      for (const suggestEntry of suggestTagEntries) {
        const tag = asString(suggestEntry.tag);
        const lowered = tag.toLowerCase();
        const note = asString(suggestEntry.note);
        const option = createHtmlElement(doc, "div");
        option.style.display = "grid";
        option.style.gridTemplateColumns = "1fr auto auto";
        option.style.alignItems = "start";
        option.style.gap = "8px";

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
        const rowError = asString(rowErrors[lowered]);
        if (rowError) {
          const errorText = createHtmlElement(doc, "span");
          errorText.textContent = rowError;
          errorText.style.fontSize = "11px";
          errorText.style.color = "#b3261e";
          content.appendChild(errorText);
        }
        option.appendChild(content);

        const joinBtn = createHtmlElement(doc, "button");
        joinBtn.type = "button";
        joinBtn.textContent = "加入";
        joinBtn.addEventListener("click", () => {
          host.patchState((draft) => {
            applyJoinTagAction(draft, tag);
          });
        });
        option.appendChild(joinBtn);

        const rejectBtn = createHtmlElement(doc, "button");
        rejectBtn.type = "button";
        rejectBtn.textContent = "拒绝";
        rejectBtn.addEventListener("click", () => {
          host.patchState((draft) => {
            applyRejectTagAction(draft, tag);
          });
        });
        option.appendChild(rejectBtn);
        list.appendChild(option);
      }
      if (suggestTagEntries.length === 0) {
        const empty = createHtmlElement(doc, "div");
        empty.textContent = "没有剩余待处理标签。";
        empty.style.color = "#666";
        empty.style.fontSize = "12px";
        list.appendChild(empty);
      }
      panel.appendChild(list);

      root.appendChild(panel);

      if (!runtime.timerStarted) {
        runtime.timerStarted = true;
        runtime.timerHandle = setInterval(() => {
          const liveState = runtime.state;
          if (!liveState) {
            clearInterval(runtime.timerHandle);
            runtime.timerHandle = null;
            return;
          }
          const current = Number(liveState.countdownSeconds);
          if (!Number.isFinite(current) || current <= 1) {
            liveState.countdownSeconds = 0;
            liveState.timedOut = true;
            liveState.closePolicyApplied = true;
            clearInterval(runtime.timerHandle);
            runtime.timerHandle = null;
            host.rerender();
            return;
          }
          liveState.countdownSeconds = current - 1;
          host.rerender();
        }, 1000);
      }
    },
    serialize({ state }) {
      ensureSuggestDialogState(state);
      return {
        suggestTagEntries: state.suggestTagEntries,
        rowErrors: state.rowErrors,
        addedDirect: state.addedDirect,
        staged: state.staged,
        rejected: state.rejected,
        invalid: state.invalid,
        skippedDirect: state.skippedDirect,
        stagedSkipped: state.stagedSkipped,
        countdownSeconds: state.countdownSeconds,
        timedOut: state.timedOut,
        closePolicyApplied: state.closePolicyApplied,
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
    bridge.registerRenderer(
      SUGGEST_TAGS_RENDERER_ID,
      createSuggestTagsRenderer(args.rendererOptions || {}),
    );
  }

  const initialState = {
    suggestTagEntries,
    rowErrors: {},
    addedDirect: [],
    staged: [],
    rejected: [],
    invalid: [],
    skippedDirect: [],
    stagedSkipped: [],
    countdownSeconds: SUGGEST_DIALOG_TIMEOUT_SECONDS,
    timedOut: false,
    closePolicyApplied: false,
  };
  const closeActionId = asString(args.closeActionId || "stage-all");
  const parsedAutoCloseAfterMs = Number(
    args?.autoClose?.afterMs || SUGGEST_DIALOG_TIMEOUT_SECONDS * 1000,
  );
  const autoCloseAfterMs =
    Number.isFinite(parsedAutoCloseAfterMs) && parsedAutoCloseAfterMs > 0
      ? parsedAutoCloseAfterMs
      : SUGGEST_DIALOG_TIMEOUT_SECONDS * 1000;
  const autoCloseActionId = asString(args?.autoClose?.actionId || closeActionId);
  const openResult = await bridge.open({
    rendererId: SUGGEST_TAGS_RENDERER_ID,
    title: String(args.title || "Suggest Tags Intake"),
    initialState,
    layout: {
      width: 560,
      height: 520,
      minWidth: 480,
      minHeight: 420,
      maxWidth: 900,
      maxHeight: 900,
      padding: 8,
    },
    actions: Array.isArray(args.actions) ? args.actions : [],
    closeActionId,
    autoClose: {
      afterMs: autoCloseAfterMs,
      actionId: autoCloseActionId,
    },
  });

  if (args.rendererOptions?.runtime?.timerHandle) {
    clearInterval(args.rendererOptions.runtime.timerHandle);
    args.rendererOptions.runtime.timerHandle = null;
  }

  const response = isObject(openResult) ? openResult : {};
  const resultState = isObject(response.result) ? response.result : initialState;
  ensureSuggestDialogState(resultState);
  return {
    opened: true,
    actionId: asString(response.actionId || ""),
    reason: asString(response.reason || ""),
    state: resultState,
    saved: response.saved === true,
  };
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
      addedDirect: [],
      staged: [],
      rejected: [],
      timedOut: false,
      closePolicyApplied: false,
    };
  }

  const dialogRuntime = {
    timerStarted: false,
    timerHandle: null,
    state: null,
  };
  const dialog = await openSuggestTagsDialog({
    suggestTagEntries: suggestTags.entries,
    title: args.title,
    actions: [
      {
        id: "join-all",
        label: "全部加入",
        noClose: true,
        onClick: ({ state, closeWithAction, rerender }) => {
          const result = applyJoinAllAction(state);
          rerender();
          if (result.closeable) {
            closeWithAction("join-all");
          }
        },
      },
      {
        id: "stage-all",
        label: "全部暂存",
        noClose: true,
        onClick: ({ state, closeWithAction, rerender }) => {
          const result = applyStageAllAction(state);
          if (result.closeable) {
            closeWithAction("stage-all");
            return;
          }
          rerender();
        },
      },
      {
        id: "reject-all",
        label: "全部拒绝",
        noClose: true,
        onClick: ({ state, closeWithAction }) => {
          applyRejectAllAction(state);
          closeWithAction("reject-all");
        },
      },
    ],
    closeActionId: "stage-all",
    rendererOptions: {
      runtime: dialogRuntime,
    },
  });
  if (!dialog.opened) {
    return {
      opened: false,
      canceled: true,
      reason: asString(dialog.reason || "dialog unavailable"),
      selected: [],
      added: [],
      skipped: [],
      invalid: [],
      addedDirect: [],
      staged: [],
      rejected: [],
      timedOut: false,
      closePolicyApplied: false,
    };
  }

  const state = isObject(dialog.state) ? dialog.state : {};
  ensureSuggestDialogState(state);

  if (dialog.actionId === "join-all" && state.suggestTagEntries.length > 0) {
    applyJoinAllAction(state);
  } else if (dialog.actionId === "stage-all" && state.suggestTagEntries.length > 0) {
    state.closePolicyApplied = true;
    applyStageAllAction(state);
  } else if (dialog.actionId === "reject-all" && state.suggestTagEntries.length > 0) {
    applyRejectAllAction(state);
  }

  const selected = [
    ...(Array.isArray(state.addedDirect) ? state.addedDirect : []),
    ...(Array.isArray(state.staged) ? state.staged : []),
    ...(Array.isArray(state.rejected) ? state.rejected : []),
  ];
  return {
    opened: true,
    canceled: false,
    reason: asString(dialog.reason || ""),
    selected,
    added: Array.isArray(state.addedDirect) ? state.addedDirect : [],
    skipped: [
      ...(Array.isArray(state.skippedDirect) ? state.skippedDirect : []),
      ...(Array.isArray(state.stagedSkipped) ? state.stagedSkipped : []),
    ],
    invalid: Array.isArray(state.invalid) ? state.invalid : [],
    addedDirect: Array.isArray(state.addedDirect) ? state.addedDirect : [],
    staged: Array.isArray(state.staged) ? state.staged : [],
    rejected: Array.isArray(state.rejected) ? state.rejected : [],
    timedOut: state.timedOut === true,
    closePolicyApplied: state.closePolicyApplied === true,
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
  createSuggestTagsRenderer,
  buildVocabularyEntryFromSuggestTag,
  intakeSuggestTagsToStaged,
  intakeSuggestTagsToVocabulary,
  normalizeDialogSelectedTags,
  normalizeSuggestTagEntries,
  normalizeUniqueStringArray,
  openSuggestTagsDialog,
  resolveTagRegulatorOutput,
};
