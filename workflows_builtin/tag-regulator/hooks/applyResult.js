const GLOBAL_HOST_OPEN_KEY = "__zsWorkflowEditorHostOpen";
const GLOBAL_HOST_REGISTER_KEY = "__zsWorkflowEditorHostRegisterRenderer";
const GLOBAL_WORKFLOW_RUNTIME_BRIDGE_KEY = "__zsWorkflowRuntimeBridge";
const SUGGEST_TAGS_RENDERER_ID = "tag-regulator.suggest-tags.v1";
const TAG_MANAGER_WORKFLOW_ID = "tag-manager";
const SUGGEST_TAGS_SOURCE = "agent-suggest";
const TAG_VOCAB_STAGED_PREF_SUFFIX = "tagVocabularyStagedJson";
const STAGED_SOURCE_FLOW = "tag-regulator-suggest";
const SUGGEST_DIALOG_TIMEOUT_SECONDS = 10;
const DEFAULT_PREFS_PREFIX = "extensions.zotero.zotero-skills";
const TAG_VOCAB_PREF_SUFFIX = "tagVocabularyJson";
const TAG_VOCAB_LOCAL_COMMITTED_PREF_SUFFIX = "tagVocabularyLocalCommittedJson";
const TAG_VOCAB_REMOTE_COMMITTED_PREF_SUFFIX = "tagVocabularyRemoteCommittedJson";
const WORKFLOW_SETTINGS_PREF_SUFFIX = "workflowSettingsJson";
const TAG_PATTERN = /^[a-z_]+:[a-zA-Z0-9/_.-]+$/;
const DEFAULT_GITHUB_REPO = "Zotero_TagVocab";
const DEFAULT_GITHUB_FILE_PATH = "tags/tags.json";
const GITHUB_API_VERSION = "2022-11-28";
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

function normalizeParentBindings(value) {
  const seen = new Set();
  const normalized = [];
  for (const entry of Array.isArray(value) ? value : []) {
    const numeric = Number(entry);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      continue;
    }
    const id = Math.trunc(numeric);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    normalized.push(id);
  }
  normalized.sort((left, right) => left - right);
  return normalized;
}

function normalizeStagedPublishState(value) {
  const text = String(value || "").trim().toLowerCase();
  if (
    text === "pending-batch" ||
    text === "publishing" ||
    text === "publish-failed"
  ) {
    return text;
  }
  return "";
}

function normalizeStagedEntryWithBindings(entry, options = {}) {
  const defaultSourceFlow =
    String(options.defaultSourceFlow || "manual-staged").trim() || "manual-staged";
  const source = entry && typeof entry === "object" ? entry : {};
  const tag = String(source.tag || "").trim();
  const facetFromField = String(source.facet || "").trim().toLowerCase();
  const facetFromTag = tag.includes(":")
    ? String(tag.split(":")[0] || "").trim().toLowerCase()
    : "";
  const facet = facetFromField || facetFromTag || "topic";
  const createdAt = String(source.createdAt || "").trim();
  const updatedAt = String(source.updatedAt || "").trim();
  return {
    tag,
    facet,
    source: String(source.source || "manual").trim() || "manual",
    note: String(source.note || ""),
    deprecated: Boolean(source.deprecated),
    createdAt,
    updatedAt: updatedAt || createdAt,
    sourceFlow:
      String(source.sourceFlow || defaultSourceFlow).trim() || defaultSourceFlow,
    parentBindings: normalizeParentBindings(source.parentBindings),
    publishState: normalizeStagedPublishState(source.publishState),
  };
}

function mergeParentBindingsIntoStagedEntries(args) {
  const entries = Array.isArray(args?.entries) ? args.entries : [];
  const nextEntry = args?.entry || null;
  const parentBindings = normalizeParentBindings(args?.parentBindings);
  const defaultSourceFlow = args?.defaultSourceFlow;
  const normalizedEntries = entries.map((entry) =>
    normalizeStagedEntryWithBindings(entry, { defaultSourceFlow }),
  );
  const candidate = normalizeStagedEntryWithBindings(nextEntry, { defaultSourceFlow });
  const lowered = String(candidate.tag || "").trim().toLowerCase();
  if (!lowered) {
    return normalizedEntries;
  }
  const index = normalizedEntries.findIndex(
    (entry) => String(entry.tag || "").trim().toLowerCase() === lowered,
  );
  if (index < 0) {
    normalizedEntries.push({
      ...candidate,
      parentBindings: normalizeParentBindings([
        ...candidate.parentBindings,
        ...parentBindings,
      ]),
    });
    return normalizedEntries;
  }
  const existing = normalizedEntries[index];
  normalizedEntries[index] = {
    ...existing,
    ...candidate,
    parentBindings: normalizeParentBindings([
      ...existing.parentBindings,
      ...candidate.parentBindings,
      ...parentBindings,
    ]),
    publishState:
      normalizeStagedPublishState(candidate.publishState) ||
      normalizeStagedPublishState(existing.publishState),
  };
  return normalizedEntries;
}

function collectParentBindingsByTag(entries, tags) {
  const requested = new Set(
    (Array.isArray(tags) ? tags : [])
      .map((entry) => String(entry || "").trim().toLowerCase())
      .filter(Boolean),
  );
  const bindings = new Map();
  for (const rawEntry of Array.isArray(entries) ? entries : []) {
    const entry = normalizeStagedEntryWithBindings(rawEntry);
    const lowered = String(entry.tag || "").trim().toLowerCase();
    if (!lowered || (requested.size > 0 && !requested.has(lowered))) {
      continue;
    }
    bindings.set(
      lowered,
      normalizeParentBindings([
        ...(bindings.get(lowered) || []),
        ...entry.parentBindings,
      ]),
    );
  }
  return bindings;
}

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
      parentCount:
        Number.isFinite(Number(entry.parentCount)) && Number(entry.parentCount) > 0
          ? Math.trunc(Number(entry.parentCount))
          : 0,
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
  if (doc && typeof doc.createElementNS === "function") {
    return doc.createElementNS("http://www.w3.org/1999/xhtml", tag);
  }
  if (doc && typeof doc.createElement === "function") {
    return doc.createElement(tag);
  }
  throw new Error("document cannot create html element");
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

function resolveLocalCommittedPrefsKey() {
  return `${resolvePrefsPrefix()}.${TAG_VOCAB_LOCAL_COMMITTED_PREF_SUFFIX}`;
}

function resolveRemoteCommittedPrefsKey() {
  return `${resolvePrefsPrefix()}.${TAG_VOCAB_REMOTE_COMMITTED_PREF_SUFFIX}`;
}

function resolveStagedPrefsKey() {
  return `${resolvePrefsPrefix()}.${TAG_VOCAB_STAGED_PREF_SUFFIX}`;
}

function resolveWorkflowSettingsPrefsKey() {
  return `${resolvePrefsPrefix()}.${WORKFLOW_SETTINGS_PREF_SUFFIX}`;
}

function readWorkflowSettingsParams(workflowId) {
  const raw = Zotero.Prefs.get(resolveWorkflowSettingsPrefsKey(), true);
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    if (!isObject(parsed)) {
      return {};
    }
    const workflowEntry = parsed[String(workflowId || "").trim()];
    if (!isObject(workflowEntry)) {
      return {};
    }
    return isObject(workflowEntry.workflowParams) ? workflowEntry.workflowParams : {};
  } catch {
    return {};
  }
}

function resolveGitHubSyncConfig(workflowId) {
  const params = readWorkflowSettingsParams(workflowId);
  const githubOwner = String(params.github_owner || "").trim();
  const githubRepo = String(params.github_repo || DEFAULT_GITHUB_REPO).trim();
  const filePath = String(params.file_path || DEFAULT_GITHUB_FILE_PATH)
    .trim()
    .replace(/^\/+/, "");
  const githubToken = String(params.github_token || "").trim();
  const configured = Boolean(githubOwner && githubRepo && filePath && githubToken);
  return {
    githubOwner,
    githubRepo,
    filePath,
    githubToken,
    configured,
  };
}

function resolveTagVocabularyMode(syncConfig) {
  return (syncConfig || resolveGitHubSyncConfig(TAG_MANAGER_WORKFLOW_ID)).configured
    ? "subscription"
    : "local";
}

function resolveActiveCommittedPrefsKey() {
  const params = readWorkflowSettingsParams("tag-manager");
  const githubOwner = asString(params.github_owner);
  const githubRepo = asString(params.github_repo);
  const filePath = asString(params.file_path);
  const githubToken = asString(params.github_token);
  return githubOwner && githubRepo && filePath && githubToken
    ? resolveRemoteCommittedPrefsKey()
    : resolveLocalCommittedPrefsKey();
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

function loadValidatedEntriesStateFromRaw(raw) {
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

function buildCommittedPayload(entries) {
  const normalized = normalizePersistedEntries(entries);
  const issues = collectValidationIssuesFallback(normalized);
  if (issues.length > 0) {
    throw new Error(asString(issues[0]?.message || "tag vocabulary validation failed"));
  }
  return {
    version: 1,
    entries: normalized,
  };
}

function buildProjectionPayload(entries) {
  return {
    version: 1,
    entries: normalizePersistedEntries(entries),
  };
}

function seedCommittedPrefFromLegacyIfMissing(targetKey) {
  const normalizedTargetKey = asString(targetKey);
  if (!normalizedTargetKey) {
    return;
  }
  const existing = Zotero.Prefs.get(normalizedTargetKey, true);
  if (typeof existing === "string" && existing.trim()) {
    return;
  }
  const legacyLoaded = loadValidatedEntriesStateFromRaw(
    Zotero.Prefs.get(resolvePrefsKey(), true),
  );
  if (legacyLoaded.corrupted || legacyLoaded.entries.length === 0) {
    return;
  }
  Zotero.Prefs.set(
    normalizedTargetKey,
    JSON.stringify({
      version: 1,
      entries: legacyLoaded.entries,
    }),
    true,
  );
}

function syncActiveCommittedProjection(entries) {
  const payload = buildProjectionPayload(entries);
  Zotero.Prefs.set(resolvePrefsKey(), JSON.stringify(payload), true);
  return payload;
}

function persistLocalCommittedEntries(entries) {
  const payload = buildCommittedPayload(entries);
  Zotero.Prefs.set(resolveLocalCommittedPrefsKey(), JSON.stringify(payload), true);
  return payload;
}

function persistRemoteCommittedEntries(entries) {
  const payload = buildCommittedPayload(entries);
  Zotero.Prefs.set(resolveRemoteCommittedPrefsKey(), JSON.stringify(payload), true);
  return payload;
}

function loadLocalCommittedState() {
  seedCommittedPrefFromLegacyIfMissing(resolveLocalCommittedPrefsKey());
  return loadValidatedEntriesStateFromRaw(
    Zotero.Prefs.get(resolveLocalCommittedPrefsKey(), true),
  );
}

function loadRemoteCommittedState() {
  seedCommittedPrefFromLegacyIfMissing(resolveRemoteCommittedPrefsKey());
  return loadValidatedEntriesStateFromRaw(
    Zotero.Prefs.get(resolveRemoteCommittedPrefsKey(), true),
  );
}

function fallbackLoadPersistedState() {
  const syncConfig = resolveGitHubSyncConfig(TAG_MANAGER_WORKFLOW_ID);
  const mode = resolveTagVocabularyMode(syncConfig);
  const loaded =
    mode === "subscription" ? loadRemoteCommittedState() : loadLocalCommittedState();
  return {
    ...loaded,
    mode,
  };
}

function fallbackPersistEntries(entries) {
  const syncConfig = resolveGitHubSyncConfig(TAG_MANAGER_WORKFLOW_ID);
  const mode = resolveTagVocabularyMode(syncConfig);
  const payload =
    mode === "subscription"
      ? persistRemoteCommittedEntries(entries)
      : persistLocalCommittedEntries(entries);
  syncActiveCommittedProjection(payload.entries);
  return payload;
}

function normalizePersistedStagedEntries(entries) {
  return sortEntries(
    (Array.isArray(entries) ? entries : []).map((entry) => {
      const normalized = normalizeStagedEntryWithBindings(entry, {
        defaultSourceFlow: STAGED_SOURCE_FLOW,
      });
      const tag = asString(normalized.tag);
      const facet =
        asString(normalized.facet).toLowerCase() || getTagPrefix(tag) || "topic";
      const createdAt = toIsoTimestamp(normalized.createdAt) || nowIsoTimestamp();
      const updatedAt = toIsoTimestamp(normalized.updatedAt) || createdAt;
      return {
        tag,
        facet,
        source:
          asString(normalized.source || SUGGEST_TAGS_SOURCE) || SUGGEST_TAGS_SOURCE,
        note: asString(normalized.note),
        deprecated: Boolean(normalized.deprecated),
        createdAt,
        updatedAt,
        sourceFlow:
          asString(normalized.sourceFlow || STAGED_SOURCE_FLOW) || STAGED_SOURCE_FLOW,
        parentBindings: Array.isArray(normalized.parentBindings)
          ? [...normalized.parentBindings]
          : [],
        publishState: asString(normalized.publishState),
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

function removeStagedEntriesByTags(tags) {
  const lowered = new Set(
    (Array.isArray(tags) ? tags : [])
      .map((entry) => asString(entry).toLowerCase())
      .filter(Boolean),
  );
  const loaded = fallbackLoadPersistedStagedState();
  const kept = normalizePersistedStagedEntries(loaded.entries).filter(
    (entry) => !lowered.has(asString(entry.tag).toLowerCase()),
  );
  return fallbackPersistStagedEntries(kept);
}

function buildGitHubContentsApiUrl(config) {
  return `https://api.github.com/repos/${encodeURIComponent(
    config.githubOwner,
  )}/${encodeURIComponent(config.githubRepo)}/contents/${config.filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function buildGitHubHeaders(config, extraHeaders) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${asString(config.githubToken)}`,
    ...extraHeaders,
  };
  if (asString(config.githubToken)) {
    headers["X-GitHub-Api-Version"] = GITHUB_API_VERSION;
  }
  return headers;
}

function encodeBase64Utf8(text) {
  const input = String(text || "");
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "utf8").toString("base64");
  }
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(input)));
  }
  throw new Error("base64 encoding is unavailable in current runtime");
}

function decodeBase64Utf8(text) {
  const normalized = String(text || "").replace(/\s+/g, "");
  if (typeof Buffer !== "undefined") {
    return Buffer.from(normalized, "base64").toString("utf8");
  }
  if (typeof atob === "function") {
    return decodeURIComponent(escape(atob(normalized)));
  }
  throw new Error("base64 decoding is unavailable in current runtime");
}

function sanitizeRemoteTags(tags) {
  const normalized = normalizePersistedEntries(Array.isArray(tags) ? tags : []);
  const issues = collectValidationIssuesFallback(normalized);
  if (issues.length > 0) {
    throw new Error(
      `remote vocabulary validation failed: ${issues
        .slice(0, 3)
        .map((issue) => `${issue.code}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return normalized;
}

function normalizeRemoteAbbrevs(input) {
  if (!isObject(input)) {
    return {};
  }
  const next = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = asString(key);
    const normalizedValue = asString(value);
    if (!normalizedKey || !normalizedValue) {
      continue;
    }
    next[normalizedKey] = normalizedValue;
  }
  return next;
}

function normalizeRemoteVocabularyPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("remote vocabulary payload is not an object");
  }
  const tags = sanitizeRemoteTags(payload.tags);
  const remoteFacets = Array.isArray(payload.facets)
    ? payload.facets.map((entry) => asString(entry)).filter(Boolean)
    : [];
  const tagFacetSet = new Set(tags.map((entry) => asString(entry.facet)));
  const facets = [];
  for (const facet of FACETS) {
    if (remoteFacets.includes(facet) || tagFacetSet.has(facet)) {
      facets.push(facet);
    }
  }
  for (const facet of remoteFacets) {
    if (!facets.includes(facet)) {
      facets.push(facet);
    }
  }
  for (const facet of tagFacetSet) {
    if (!facets.includes(facet)) {
      facets.push(facet);
    }
  }
  return {
    version: asString(payload.version || "1.0.0") || "1.0.0",
    updated_at: asString(payload.updated_at),
    facets,
    tags,
    abbrevs: normalizeRemoteAbbrevs(payload.abbrevs),
    tag_count: tags.length,
  };
}

async function fetchJsonOrThrow(url, options) {
  if (typeof fetch !== "function") {
    throw new Error("fetch is unavailable in current runtime");
  }
  const response = await fetch(url, options);
  if (!response || response.ok !== true) {
    const status = Number(response?.status || 0);
    throw new Error(`HTTP ${status || "request-failed"} while requesting ${url}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`invalid JSON response from ${url}`);
  }
}

async function fetchPublishBaseline(config) {
  const contentsUrl = buildGitHubContentsApiUrl(config);
  const payload = await fetchJsonOrThrow(contentsUrl, {
    method: "GET",
    headers: buildGitHubHeaders(config, {
      Accept: "application/vnd.github+json",
    }),
  });
  const sha = asString(payload?.sha);
  const encodedContent = asString(payload?.content);
  if (!sha || !encodedContent) {
    throw new Error("GitHub contents payload missing sha/content");
  }
  let remoteJson = null;
  try {
    remoteJson = JSON.parse(decodeBase64Utf8(encodedContent));
  } catch {
    throw new Error("GitHub contents payload is not valid vocabulary JSON");
  }
  return {
    sha,
    contentsUrl,
    remotePayload: normalizeRemoteVocabularyPayload(remoteJson),
  };
}

function buildPublishedVocabularyPayload(args) {
  const remotePayload = normalizeRemoteVocabularyPayload(args?.remotePayload || {});
  const localTags = sanitizeRemoteTags(args?.localTags);
  const tagFacetSet = new Set(localTags.map((entry) => asString(entry.facet)));
  const facets = [];
  for (const facet of FACETS) {
    if (remotePayload.facets.includes(facet) || tagFacetSet.has(facet)) {
      facets.push(facet);
    }
  }
  for (const facet of remotePayload.facets) {
    if (!facets.includes(facet)) {
      facets.push(facet);
    }
  }
  for (const facet of tagFacetSet) {
    if (!facets.includes(facet)) {
      facets.push(facet);
    }
  }
  return {
    version: asString(remotePayload.version || "1.0.0") || "1.0.0",
    updated_at: new Date().toISOString(),
    facets,
    tags: localTags,
    abbrevs: normalizeRemoteAbbrevs(remotePayload.abbrevs),
    tag_count: localTags.length,
  };
}

async function putPublishedVocabulary(args) {
  const config = args?.config || {};
  const contentsUrl = asString(args?.contentsUrl);
  const sha = asString(args?.sha);
  const payload = args?.payload;
  if (!contentsUrl || !sha || !payload) {
    throw new Error("publish request is missing contentsUrl, sha, or payload");
  }
  if (typeof fetch !== "function") {
    throw new Error("fetch is unavailable in current runtime");
  }
  return fetch(contentsUrl, {
    method: "PUT",
    headers: buildGitHubHeaders(config, {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      message: `Update ${config.filePath} via Zotero Skills Tag Regulator`,
      content: encodeBase64Utf8(JSON.stringify(payload, null, 2)),
      sha,
    }),
  });
}

async function publishRemoteVocabulary(args) {
  const config = args?.config || {};
  const localTags = sanitizeRemoteTags(args?.entries);
  appendTagRegulatorSuggestLog({
    stage: "publish-start",
    message: "tag-regulator remote vocabulary publish started",
    details: {
      owner: config.githubOwner,
      repo: config.githubRepo,
      file_path: config.filePath,
      tag_count: localTags.length,
    },
  });
  try {
    let baseline = await fetchPublishBaseline(config);
    let payload = buildPublishedVocabularyPayload({
      remotePayload: baseline.remotePayload,
      localTags,
    });
    let response = await putPublishedVocabulary({
      config,
      contentsUrl: baseline.contentsUrl,
      sha: baseline.sha,
      payload,
    });
    if (response && response.status === 409) {
      appendTagRegulatorSuggestLog({
        stage: "publish-conflict",
        level: "warn",
        message: "tag-regulator remote vocabulary publish conflict detected",
        details: {
          owner: config.githubOwner,
          repo: config.githubRepo,
          file_path: config.filePath,
        },
      });
      baseline = await fetchPublishBaseline(config);
      payload = buildPublishedVocabularyPayload({
        remotePayload: baseline.remotePayload,
        localTags,
      });
      response = await putPublishedVocabulary({
        config,
        contentsUrl: baseline.contentsUrl,
        sha: baseline.sha,
        payload,
      });
    }
    if (!response || response.ok !== true) {
      const status = Number(response?.status || 0);
      const statusText = asString(response?.statusText);
      throw new Error(
        `GitHub publish failed with HTTP ${status || "request-failed"}${
          statusText ? ` ${statusText}` : ""
        }`,
      );
    }
    appendTagRegulatorSuggestLog({
      stage: "publish-succeeded",
      message: "tag-regulator remote vocabulary publish succeeded",
      details: {
        owner: config.githubOwner,
        repo: config.githubRepo,
        file_path: config.filePath,
        tag_count: payload.tag_count,
      },
    });
    return payload;
  } catch (error) {
    appendTagRegulatorSuggestLog({
      stage: "publish-failed",
      level: "error",
      message: "tag-regulator remote vocabulary publish failed",
      details: {
        owner: config.githubOwner,
        repo: config.githubRepo,
        file_path: config.filePath,
      },
      error,
    });
    throw error;
  }
}

async function commitControlledEntries(args) {
  const syncConfig = args?.config || resolveGitHubSyncConfig(TAG_MANAGER_WORKFLOW_ID);
  const mode = args?.mode || resolveTagVocabularyMode(syncConfig);
  const nextEntries = normalizePersistedEntries(args?.entries);
  if (mode !== "subscription") {
    const committed = persistLocalCommittedEntries(nextEntries);
    syncActiveCommittedProjection(committed.entries);
    return {
      mode,
      entries: committed.entries,
    };
  }
  const published = await publishRemoteVocabulary({
    workflowId: asString(args?.workflowId || "tag-regulator"),
    config: syncConfig,
    entries: nextEntries,
  });
  const committed = persistRemoteCommittedEntries(published.tags);
  syncActiveCommittedProjection(committed.entries);
  return {
    mode,
    entries: committed.entries,
  };
}

function resolveTagVocabularyBridge() {
  return {
    loadPersistedState: fallbackLoadPersistedState,
    persistEntries: fallbackPersistEntries,
    collectValidationIssues: collectValidationIssuesFallback,
    loadPersistedStagedState: fallbackLoadPersistedStagedState,
    persistStagedEntries: fallbackPersistStagedEntries,
    commitControlledEntries,
    removeStagedEntriesByTags,
  };
}

function resolveWorkflowRuntimeBridge() {
  const runtime = globalThis;
  const fromGlobal = isObject(runtime?.[GLOBAL_WORKFLOW_RUNTIME_BRIDGE_KEY])
    ? runtime[GLOBAL_WORKFLOW_RUNTIME_BRIDGE_KEY]
    : null;
  const fromAddon =
    typeof addon !== "undefined" && isObject(addon?.data?.workflowRuntimeBridge)
      ? addon.data.workflowRuntimeBridge
      : null;
  return fromAddon || fromGlobal || null;
}

function appendTagRegulatorRuntimeLog(args) {
  const bridge = resolveWorkflowRuntimeBridge();
  if (!bridge || typeof bridge.appendRuntimeLog !== "function") {
    return;
  }
  try {
    bridge.appendRuntimeLog({
      level: "info",
      scope: "hook",
      workflowId: "tag-regulator",
      component: "tag-regulator-apply-result",
      operation: "suggest-live-reconcile",
      stage: "suggest-live-reconcile",
      message: "tag-regulator suggest tags reconciled against current local state",
      details: {
        parentItemID: Number(args?.parentItemID || 0) || undefined,
        parentItemKey: asString(args?.parentItemKey),
        reclassified_add_count: Number(args?.reclassifiedAddCount || 0),
        reclassified_staged_count: Number(args?.reclassifiedStagedCount || 0),
        remaining_suggest_count: Number(args?.remainingSuggestCount || 0),
      },
    });
  } catch {
    // keep runtime logging best-effort
  }
}

function showTagRegulatorToast(args) {
  const bridge = resolveWorkflowRuntimeBridge();
  if (!bridge || typeof bridge.showToast !== "function") {
    return;
  }
  bridge.showToast(args);
}

function appendTagRegulatorSuggestLog(args) {
  const bridge = resolveWorkflowRuntimeBridge();
  if (!bridge || typeof bridge.appendRuntimeLog !== "function") {
    return;
  }
  bridge.appendRuntimeLog({
    level: String(args?.level || "info").trim() || "info",
    scope: "hook",
    workflowId: "tag-regulator",
    component: "tag-regulator-suggest-intake",
    operation: String(args?.stage || "suggest-intake").trim() || "suggest-intake",
    stage: String(args?.stage || "suggest-intake").trim() || "suggest-intake",
    message: String(args?.message || "").trim() || "tag-regulator suggest intake",
    details: args?.details || {},
    error: args?.error,
  });
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

function loadControlledVocabularySnapshot(tagVocabularyBridge) {
  const bridge = tagVocabularyBridge || resolveTagVocabularyBridge();
  const loaded = bridge.loadPersistedState();
  const entries = Array.isArray(loaded.entries) ? [...loaded.entries] : [];
  return {
    entries,
    lowerSet: new Set(
      entries
        .map((entry) => asString(entry?.tag).toLowerCase())
        .filter(Boolean),
    ),
  };
}

function loadStagedVocabularySnapshot(tagVocabularyBridge) {
  const bridge = tagVocabularyBridge || resolveTagVocabularyBridge();
  const loaded = bridge.loadPersistedStagedState();
  const entries = Array.isArray(loaded.entries) ? [...loaded.entries] : [];
  return {
    entries,
    lowerSet: new Set(
      entries
        .map((entry) => asString(entry?.tag).toLowerCase())
        .filter(Boolean),
    ),
  };
}

function buildStagedEntryFromSuggestTag(suggestEntry, parentBindingsInput = []) {
  const parentBindings = normalizeParentBindings(parentBindingsInput);
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
      parentBindings,
      publishState: "",
    },
    reason: "",
  };
}

async function appendTagsToCurrentParentItem(parentItem, tags) {
  if (!parentItem) {
    return [];
  }
  const mutation = await applyTagMutations(parentItem, [], normalizeAdvisoryStringArray(tags));
  return mutation.added;
}

async function appendTagToBoundParentItem(parentItemId, tag) {
  const numericParentId = Number(parentItemId);
  const normalizedTag = asString(tag);
  if (!Number.isFinite(numericParentId) || numericParentId <= 0 || !normalizedTag) {
    return false;
  }
  const item = Zotero.Items.get(Math.trunc(numericParentId));
  if (!item) {
    return false;
  }
  const tags = Array.isArray(item.getTags?.()) ? item.getTags() : [];
  if (
    tags.some(
      (entry) => asString(entry?.tag).toLowerCase() === normalizedTag.toLowerCase(),
    )
  ) {
    return false;
  }
  item.addTag(normalizedTag);
  await item.saveTx();
  return true;
}

async function appendTagsToBoundParents(bindingsByTag) {
  const applied = [];
  for (const [tag, parentBindings] of bindingsByTag.entries()) {
    for (const parentItemId of Array.isArray(parentBindings) ? parentBindings : []) {
      await appendTagToBoundParentItem(parentItemId, tag);
    }
    applied.push(tag);
  }
  return applied;
}

function buildBindingsMapForSelectedTags(stagedEntries, selectedTags, currentParentItemId) {
  const bindingsByLower = collectParentBindingsByTag(stagedEntries, selectedTags);
  const map = new Map();
  for (const tag of normalizeAdvisoryStringArray(selectedTags)) {
    const lowered = tag.toLowerCase();
    const existing = bindingsByLower.get(lowered) || [];
    const nextBindings = normalizeParentBindings([
      ...existing,
      currentParentItemId,
    ]);
    map.set(tag, nextBindings);
  }
  return map;
}

async function intakeSuggestTagsToStaged(args) {
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
    appliedToCurrentParent: [],
  };
  if (summary.selected.length === 0) {
    return summary;
  }

  const controlledSnapshot = loadControlledVocabularySnapshot(tagVocabularyBridge);
  const controlledLower = controlledSnapshot.lowerSet;

  const stagedSnapshot = loadStagedVocabularySnapshot(tagVocabularyBridge);
  let nextStaged = [...stagedSnapshot.entries];
  const currentParentItemId =
    typeof args?.parentItem?.id === "number" && Number.isFinite(args.parentItem.id)
      ? args.parentItem.id
      : 0;

  for (const tag of summary.selected) {
    const lowered = tag.toLowerCase();
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
    if (controlledLower.has(lowered)) {
      summary.skipped.push(tag);
      continue;
    }
    nextStaged = mergeParentBindingsIntoStagedEntries({
      entries: nextStaged,
      entry: built.entry,
      parentBindings: [currentParentItemId],
      defaultSourceFlow: STAGED_SOURCE_FLOW,
    });
    summary.staged.push(tag);
  }

  if (summary.staged.length > 0) {
    try {
      tagVocabularyBridge.persistStagedEntries(nextStaged);
      appendTagRegulatorSuggestLog({
        stage: "staged-parent-bindings-merged",
        message: "tag-regulator merged staged parent bindings",
        details: {
          parent_item_id: currentParentItemId || undefined,
          tag_count: summary.staged.length,
        },
      });
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
  addUniqueStrings(state.addedDirect, [entry.tag]);
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
  addUniqueStrings(
    state.addedDirect,
    (Array.isArray(state.suggestTagEntries) ? state.suggestTagEntries : []).map((entry) =>
      asString(entry?.tag),
    ),
  );
  state.suggestTagEntries = [];
  state.rowErrors = {};
  return {
    closeable: true,
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
  addUniqueStrings(state.staged, remaining);
  state.suggestTagEntries = [];
  return {
    closeable: true,
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
      panel.style.width = "100%";
      panel.style.minWidth = "0";
      panel.style.boxSizing = "border-box";
      const suggestGridTemplateColumns =
        "minmax(120px,1.1fr) minmax(0,2.3fr) 56px 72px 72px";

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
      list.style.gap = "0";
      list.style.width = "100%";
      list.style.minWidth = "0";
      list.style.overflowY = "auto";
      list.style.border = "1px solid #ddd";
      list.style.borderRadius = "4px";
      list.style.maxHeight = "380px";

      const headerRow = createHtmlElement(doc, "div");
      headerRow.style.display = "grid";
      headerRow.style.gridTemplateColumns = suggestGridTemplateColumns;
      headerRow.style.gap = "8px";
      headerRow.style.padding = "8px";
      headerRow.style.position = "sticky";
      headerRow.style.top = "0";
      headerRow.style.zIndex = "2";
      headerRow.style.background = "#f6f6f6";
      headerRow.style.borderBottom = "1px solid #e1e1e1";
      if (typeof headerRow.setAttribute === "function") {
        headerRow.setAttribute("data-zs-role", "suggest-table-header");
      }
      for (const labelText of ["Tag", "Note", "Parents", "Join", "Reject"]) {
        const headerCell = createHtmlElement(doc, "div");
        headerCell.textContent = labelText;
        headerCell.style.fontWeight = "600";
        headerCell.style.fontSize = "12px";
        headerCell.style.color = "#333";
        headerRow.appendChild(headerCell);
      }
      list.appendChild(headerRow);

      const rowsContainer = createHtmlElement(doc, "div");
      rowsContainer.style.display = "flex";
      rowsContainer.style.flexDirection = "column";
      rowsContainer.style.gap = "6px";
      rowsContainer.style.width = "100%";
      rowsContainer.style.minWidth = "0";
      rowsContainer.style.padding = "8px";

      const rowErrors = isObject(state.rowErrors) ? state.rowErrors : {};
      for (let rowIndex = 0; rowIndex < suggestTagEntries.length; rowIndex++) {
        const suggestEntry = suggestTagEntries[rowIndex];
        const tag = asString(suggestEntry.tag);
        const lowered = tag.toLowerCase();
        const note = asString(suggestEntry.note);
        const parentCount =
          Number.isFinite(Number(suggestEntry.parentCount)) &&
          Number(suggestEntry.parentCount) > 0
            ? Math.trunc(Number(suggestEntry.parentCount))
            : 0;
        const option = createHtmlElement(doc, "div");
        option.style.display = "grid";
        option.style.gridTemplateColumns = suggestGridTemplateColumns;
        option.style.alignItems = "start";
        option.style.gap = "8px";
        option.style.width = "100%";
        option.style.minWidth = "0";
        if (typeof option.setAttribute === "function") {
          option.setAttribute("data-zs-role", "suggest-row");
          option.setAttribute("data-zs-row-index", String(rowIndex));
        }

        const tagText = createHtmlElement(doc, "div");
        tagText.textContent = tag;
        tagText.style.fontFamily = "Consolas, Monaco, monospace";
        tagText.style.minWidth = "0";
        tagText.style.overflowWrap = "anywhere";
        option.appendChild(tagText);

        const noteText = createHtmlElement(doc, "div");
        noteText.textContent = note || "";
        noteText.style.fontSize = "11px";
        noteText.style.color = "#555";
        noteText.style.minWidth = "0";
        noteText.style.whiteSpace = "normal";
        noteText.style.overflowWrap = "anywhere";
        option.appendChild(noteText);

        const parentCountText = createHtmlElement(doc, "div");
        parentCountText.textContent = String(parentCount);
        parentCountText.style.display = "flex";
        parentCountText.style.alignItems = "center";
        parentCountText.style.justifyContent = "center";
        parentCountText.style.fontSize = "12px";
        if (typeof parentCountText.setAttribute === "function") {
          parentCountText.setAttribute("data-zs-role", "suggest-parent-count");
          parentCountText.setAttribute("data-zs-row-index", String(rowIndex));
        }
        option.appendChild(parentCountText);
        const rowError = asString(rowErrors[lowered]);
        if (rowError) {
          const errorText = createHtmlElement(doc, "div");
          errorText.textContent = rowError;
          errorText.style.fontSize = "11px";
          errorText.style.color = "#b3261e";
          noteText.appendChild(errorText);
        }

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
        rowsContainer.appendChild(option);
      }
      if (suggestTagEntries.length === 0) {
        const empty = createHtmlElement(doc, "div");
        empty.textContent = "没有剩余待处理标签。";
        empty.style.color = "#666";
        empty.style.fontSize = "12px";
        empty.style.padding = "8px";
        rowsContainer.appendChild(empty);
      }
      list.appendChild(rowsContainer);
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
      width: 860,
      height: 560,
      minWidth: 680,
      minHeight: 420,
      maxWidth: 1200,
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

async function intakeSuggestTagsToVocabulary(args) {
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
    staged: [],
    skipped: [],
    invalid: [],
    appliedToCurrentParent: [],
  };
  if (summary.selected.length === 0) {
    return summary;
  }

  const controlledSnapshot = loadControlledVocabularySnapshot(tagVocabularyBridge);
  const existing = controlledSnapshot.entries;
  const existingLower = controlledSnapshot.lowerSet;
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
    const currentParentItemId =
      typeof args?.parentItem?.id === "number" && Number.isFinite(args.parentItem.id)
        ? args.parentItem.id
        : 0;
    const stagedSnapshot = loadStagedVocabularySnapshot(tagVocabularyBridge);
    const bindingsByTag = buildBindingsMapForSelectedTags(
      stagedSnapshot.entries,
      summary.added,
      currentParentItemId,
    );
    try {
      appendTagRegulatorSuggestLog({
        stage: "tag-regulator-join-publish-start",
        message: "tag-regulator started join publish transaction",
        details: {
          parent_item_id: currentParentItemId || undefined,
          tag_count: summary.added.length,
        },
      });
      const mode = asString(tagVocabularyBridge.loadPersistedState?.().mode) || "local";
      if (
        mode === "subscription" &&
        typeof tagVocabularyBridge.commitControlledEntries !== "function"
      ) {
        throw new Error("subscription commit bridge is unavailable");
      }
      const committed =
        typeof tagVocabularyBridge.commitControlledEntries === "function"
          ? await tagVocabularyBridge.commitControlledEntries({
              workflowId: "tag-regulator",
              entries: nextEntries,
            })
          : {
              entries: tagVocabularyBridge.persistEntries(nextEntries).entries,
              mode,
            };
      if (typeof tagVocabularyBridge.removeStagedEntriesByTags === "function") {
        tagVocabularyBridge.removeStagedEntriesByTags(summary.added);
      }
      await appendTagsToBoundParents(bindingsByTag);
      summary.appliedToCurrentParent = await appendTagsToCurrentParentItem(
        args?.parentItem,
        summary.added,
      );
      if (String(committed?.mode || "") === "subscription") {
        appendTagRegulatorSuggestLog({
          stage: "tag-regulator-join-publish-succeeded",
          message: "tag-regulator join publish transaction succeeded",
          details: {
            parent_item_id: currentParentItemId || undefined,
            tag_count: summary.added.length,
          },
        });
        showTagRegulatorToast({
          text: `Tag Regulator publish succeeded (${summary.added.length} tag${summary.added.length === 1 ? "" : "s"})`,
          type: "success",
        });
      }
    } catch (error) {
      const reason = `publish failed: ${asString(error?.message || error)}`;
      let fallbackStaged = loadStagedVocabularySnapshot(tagVocabularyBridge).entries;
      for (const tag of summary.added) {
        const lowered = tag.toLowerCase();
        const suggestEntry = suggestTagEntries.find(
          (entry) => asString(entry?.tag).toLowerCase() === lowered,
        );
        const built = buildStagedEntryFromSuggestTag(suggestEntry, bindingsByTag.get(tag) || []);
        if (built.ok && built.entry) {
          fallbackStaged = mergeParentBindingsIntoStagedEntries({
            entries: fallbackStaged,
            entry: built.entry,
            parentBindings: bindingsByTag.get(tag) || [],
            defaultSourceFlow: STAGED_SOURCE_FLOW,
          });
          summary.staged.push(tag);
        }
        summary.invalid.push({
          tag,
          reason,
        });
      }
      try {
        tagVocabularyBridge.persistStagedEntries(fallbackStaged);
        appendTagRegulatorSuggestLog({
          stage: "tag-regulator-join-fallback-to-staged",
          message: "tag-regulator join publish fell back to staged entries",
          details: {
            parent_item_id: currentParentItemId || undefined,
            tag_count: summary.staged.length,
          },
        });
      } catch (persistError) {
        const persistReason = `staged fallback failed: ${asString(
          persistError?.message || persistError,
        )}`;
        summary.invalid = summary.invalid.map((entry) => ({
          ...entry,
          reason: persistReason,
        }));
        summary.staged = [];
      }
      showTagRegulatorToast({
        text: `Tag Regulator publish failed: ${asString(error?.message || error)}`,
        type: "error",
      });
      appendTagRegulatorSuggestLog({
        stage: "tag-regulator-join-publish-failed",
        level: "warn",
        message: "tag-regulator join publish transaction failed",
        details: {
          parent_item_id: currentParentItemId || undefined,
          tag_count: summary.selected.length,
        },
        error,
      });
      summary.added = [];
    }
  }

  return summary;
}

function reconcileSuggestTagsAgainstCurrentState(args) {
  const suggestTagEntries = Array.isArray(args?.suggestTagEntries)
    ? args.suggestTagEntries
    : [];
  if (suggestTagEntries.length === 0) {
    return {
      nowControlled: [],
      nowStaged: [],
      remainingSuggest: [],
    };
  }
  const tagVocabularyBridge = resolveTagVocabularyBridge();
  const controlledSnapshot = loadControlledVocabularySnapshot(tagVocabularyBridge);
  const nowControlled = [];
  const unresolvedSuggest = [];

  for (const entry of suggestTagEntries) {
    const tag = asString(entry?.tag);
    if (!tag) {
      continue;
    }
    const lowered = tag.toLowerCase();
    if (controlledSnapshot.lowerSet.has(lowered)) {
      nowControlled.push({
        tag,
        note: asString(entry?.note),
      });
      continue;
    }
    unresolvedSuggest.push({
      tag,
      note: asString(entry?.note),
    });
  }

  const stagedReconciled = mergeCurrentParentIntoStagedSuggestEntries({
    suggestTagEntries: unresolvedSuggest,
    parentItem: args?.parentItem,
  });

  return {
    nowControlled,
    nowStaged: stagedReconciled.nowStaged,
    remainingSuggest: stagedReconciled.remainingSuggest,
  };
}

function collectUniqueSuggestTagNames(entries) {
  return normalizeAdvisoryStringArray(
    Array.isArray(entries) ? entries.map((entry) => entry?.tag) : [],
  );
}

function mergeUniqueStringArrays(...arrays) {
  const seen = new Set();
  const values = [];
  for (const array of arrays) {
    for (const entry of Array.isArray(array) ? array : []) {
      const text = asString(entry);
      if (!text || seen.has(text)) {
        continue;
      }
      seen.add(text);
      values.push(text);
    }
  }
  return values;
}

function sameNormalizedNumberArray(left, right) {
  const a = normalizeParentBindings(left);
  const b = normalizeParentBindings(right);
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function stripSuggestDialogMetadata(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry) => ({
    tag: asString(entry?.tag),
    note: asString(entry?.note),
  }));
}

function mergeCurrentParentIntoStagedSuggestEntries(args) {
  const tagVocabularyBridge = resolveTagVocabularyBridge();
  const suggestTagEntries = Array.isArray(args?.suggestTagEntries)
    ? args.suggestTagEntries
    : [];
  const currentParentItemId =
    typeof args?.parentItem?.id === "number" && Number.isFinite(args.parentItem.id)
      ? Math.trunc(args.parentItem.id)
      : 0;
  const stagedSnapshot = loadStagedVocabularySnapshot(tagVocabularyBridge);
  const mergedEntries = normalizePersistedStagedEntries(stagedSnapshot.entries);
  const indexByTag = new Map();
  for (let i = 0; i < mergedEntries.length; i++) {
    indexByTag.set(asString(mergedEntries[i]?.tag).toLowerCase(), i);
  }

  let changedCount = 0;
  const nowStaged = [];
  const remainingSuggest = [];

  for (const suggestEntry of suggestTagEntries) {
    const tag = asString(suggestEntry?.tag);
    if (!tag) {
      continue;
    }
    const lowered = tag.toLowerCase();
    const stagedIndex = indexByTag.get(lowered);
    const currentParentBindings = currentParentItemId > 0 ? [currentParentItemId] : [];
    let parentBindings = currentParentBindings;

    if (typeof stagedIndex === "number") {
      const existing = normalizeStagedEntryWithBindings(mergedEntries[stagedIndex], {
        defaultSourceFlow: STAGED_SOURCE_FLOW,
      });
      parentBindings = normalizeParentBindings([
        ...existing.parentBindings,
        ...currentParentBindings,
      ]);
      if (!sameNormalizedNumberArray(existing.parentBindings, parentBindings)) {
        mergedEntries[stagedIndex] = {
          ...existing,
          parentBindings,
        };
        changedCount += 1;
      }
      nowStaged.push({
        tag,
        note: asString(suggestEntry?.note),
        parentCount: parentBindings.length,
      });
    }

    remainingSuggest.push({
      tag,
      note: asString(suggestEntry?.note),
      parentCount: parentBindings.length,
    });
  }

  if (changedCount > 0) {
    try {
      tagVocabularyBridge.persistStagedEntries(mergedEntries);
      appendTagRegulatorSuggestLog({
        stage: "suggest-parent-bindings-merged-on-result",
        message: "tag-regulator merged current parent into existing staged suggest bindings",
        details: {
          parent_item_id: currentParentItemId || undefined,
          tag_count: changedCount,
        },
      });
    } catch (error) {
      appendTagRegulatorSuggestLog({
        stage: "suggest-parent-bindings-merge-failed",
        level: "warn",
        message: "tag-regulator failed to persist merged staged suggest bindings",
        details: {
          parent_item_id: currentParentItemId || undefined,
          tag_count: changedCount,
        },
        error,
      });
    }
  }

  return {
    nowStaged,
    remainingSuggest,
  };
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
  const joinSummary = await intakeSuggestTagsToVocabulary({
    selectedTags: Array.isArray(state.addedDirect) ? state.addedDirect : [],
    suggestTagEntries: suggestTags.entries,
    parentItem: args?.parentItem,
  });
  const stageSummary = await intakeSuggestTagsToStaged({
    selectedTags: Array.isArray(state.staged) ? state.staged : [],
    suggestTagEntries: suggestTags.entries,
    parentItem: args?.parentItem,
  });
  return {
    opened: true,
    canceled: false,
    reason: asString(dialog.reason || ""),
    selected,
    added: Array.isArray(joinSummary.added) ? joinSummary.added : [],
    skipped: mergeUniqueStringArrays(
      Array.isArray(joinSummary.skipped) ? joinSummary.skipped : [],
      Array.isArray(stageSummary.skipped) ? stageSummary.skipped : [],
    ),
    invalid: [
      ...(Array.isArray(joinSummary.invalid) ? joinSummary.invalid : []),
      ...(Array.isArray(stageSummary.invalid) ? stageSummary.invalid : []),
    ],
    addedDirect: Array.isArray(joinSummary.added) ? joinSummary.added : [],
    staged: mergeUniqueStringArrays(
      Array.isArray(stageSummary.staged) ? stageSummary.staged : [],
      Array.isArray(joinSummary.staged) ? joinSummary.staged : [],
    ),
    rejected: Array.isArray(state.rejected) ? state.rejected : [],
    timedOut: state.timedOut === true,
    closePolicyApplied: state.closePolicyApplied === true,
    appliedToCurrentParent: mergeUniqueStringArrays(
      Array.isArray(joinSummary.appliedToCurrentParent)
        ? joinSummary.appliedToCurrentParent
        : [],
      Array.isArray(stageSummary.appliedToCurrentParent)
        ? stageSummary.appliedToCurrentParent
        : [],
    ),
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

  const reconciledSuggest = reconcileSuggestTagsAgainstCurrentState({
    suggestTagEntries,
    parentItem,
  });
  const reclassifiedAddTags = collectUniqueSuggestTagNames(
    reconciledSuggest.nowControlled,
  );
  const reclassifiedStaged = collectUniqueSuggestTagNames(
    reconciledSuggest.nowStaged,
  );
  const remainingSuggest = reconciledSuggest.remainingSuggest;
  const effectiveAddTags = mergeUniqueStringArrays(
    addTags.values,
    reclassifiedAddTags,
  );
  appendTagRegulatorRuntimeLog({
    parentItemID:
      typeof parentItem?.id === "number" && Number.isFinite(parentItem.id)
        ? parentItem.id
        : 0,
    parentItemKey: asString(parentItem?.key),
    reclassifiedAddCount: reclassifiedAddTags.length,
    reclassifiedStagedCount: reclassifiedStaged.length,
    remainingSuggestCount: remainingSuggest.length,
  });

  const mutation = await applyTagMutations(
    parentItem,
    removeTags.values,
    effectiveAddTags,
  );

  const suggestIntake = await collectSuggestTagsIntake({
    suggestTagEntries: remainingSuggest,
    title: `Tag Regulator Suggest Tags - ${asString(parentItem?.getField?.("title") || "") || "Parent Item"}`,
    parentItem,
  });
  const finalAfterTags = collectCurrentTags(parentItem);
  const finalAdded = mergeUniqueStringArrays(
    mutation.added,
    Array.isArray(suggestIntake.appliedToCurrentParent)
      ? suggestIntake.appliedToCurrentParent
      : [],
  );

  return {
    applied:
      mutation.changed ||
      (Array.isArray(suggestIntake.appliedToCurrentParent) &&
        suggestIntake.appliedToCurrentParent.length > 0),
    skipped: false,
    removed: mutation.removed,
    added: finalAdded,
    suggest_tags: stripSuggestDialogMetadata(remainingSuggest),
    reclassified_add_tags: reclassifiedAddTags,
    reclassified_staged: reclassifiedStaged,
    suggest_intake: suggestIntake,
    warnings,
    before_tags: mutation.current,
    after_tags: finalAfterTags,
  };
}

export const __tagRegulatorApplyResultTestOnly = {
  createSuggestTagsRenderer,
  buildVocabularyEntryFromSuggestTag,
  intakeSuggestTagsToStaged,
  intakeSuggestTagsToVocabulary,
  reconcileSuggestTagsAgainstCurrentState,
  normalizeDialogSelectedTags,
  normalizeSuggestTagEntries,
  normalizeUniqueStringArray,
  openSuggestTagsDialog,
  resolveTagRegulatorOutput,
};
