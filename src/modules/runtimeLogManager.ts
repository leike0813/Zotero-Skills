import { getPref, setPref } from "../utils/prefs";

export type RuntimeLogLevel = "debug" | "info" | "warn" | "error";

export type RuntimeLogScope =
  | "workflow-trigger"
  | "job"
  | "provider"
  | "hook"
  | "system";

export type RuntimeLogEntry = {
  id: string;
  ts: string;
  level: RuntimeLogLevel;
  scope: RuntimeLogScope;
  workflowId?: string;
  requestId?: string;
  jobId?: string;
  stage: string;
  message: string;
  details?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
};

export type RuntimeLogInput = Omit<RuntimeLogEntry, "id" | "ts" | "error"> & {
  ts?: string;
  error?: unknown;
};

export type RuntimeLogListFilters = {
  levels?: RuntimeLogLevel[];
  scopes?: RuntimeLogScope[];
  workflowId?: string;
  requestId?: string;
  jobId?: string;
  order?: "asc" | "desc";
  limit?: number;
};

type RuntimeLogSnapshot = {
  entries: RuntimeLogEntry[];
  droppedEntries: number;
  maxEntries: number;
};

type RuntimeLogDocument = {
  entries?: unknown;
  droppedEntries?: unknown;
};

type RuntimeLogListener = (snapshot: RuntimeLogSnapshot) => void;

const MAX_ENTRIES = 2000;
const HISTORY_PREF_KEY = "runtimeLogsJson";
const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const MAX_STRING_LENGTH = 4000;
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_KEYS = 200;
const REDACTED = "<redacted>";
const DEFAULT_ALLOWED_LEVELS = new Set<RuntimeLogLevel>(["info", "warn", "error"]);
const SENSITIVE_KEY = /(authorization|token|secret|password|api[-_]?key|cookie|bearer)/i;

let sequence = 0;
let droppedEntries = 0;
const entries: RuntimeLogEntry[] = [];
const listeners = new Set<RuntimeLogListener>();
const allowedLevels = new Set<RuntimeLogLevel>(DEFAULT_ALLOWED_LEVELS);
let hydrated = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneEntry(entry: RuntimeLogEntry): RuntimeLogEntry {
  return {
    ...entry,
    details: typeof entry.details === "undefined"
      ? undefined
      : JSON.parse(JSON.stringify(entry.details)),
    error: entry.error ? { ...entry.error } : undefined,
  };
}

function sanitizeString(value: string) {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_LENGTH)}...<truncated>`;
}

function sanitizeValue(
  value: unknown,
  keyHint?: string,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (keyHint && SENSITIVE_KEY.test(keyHint)) {
    return REDACTED;
  }

  if (value === null || typeof value === "undefined") {
    return value;
  }

  if (depth >= MAX_DEPTH) {
    return "[max-depth]";
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "function") {
    return `[function ${value.name || "anonymous"}]`;
  }

  if (value instanceof Error) {
    return normalizeError(value);
  }
  if (value instanceof Uint8Array) {
    return `[binary:${value.byteLength}]`;
  }
  if (value instanceof ArrayBuffer) {
    return `[binary:${value.byteLength}]`;
  }

  if (typeof value === "object") {
    const typed = value as object;
    if (seen.has(typed)) {
      return "[circular]";
    }
    seen.add(typed);

    if (Array.isArray(value)) {
      const sliced = value.slice(0, MAX_ARRAY_ITEMS);
      const normalized = sliced.map((entry) =>
        sanitizeValue(entry, undefined, depth + 1, seen),
      );
      if (value.length > MAX_ARRAY_ITEMS) {
        normalized.push(`[... ${value.length - MAX_ARRAY_ITEMS} more items]`);
      }
      return normalized;
    }

    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    const keys = Object.keys(source);
    for (const key of keys.slice(0, MAX_OBJECT_KEYS)) {
      result[key] = sanitizeValue(source[key], key, depth + 1, seen);
    }
    if (keys.length > MAX_OBJECT_KEYS) {
      result.__truncated_keys__ = keys.length - MAX_OBJECT_KEYS;
    }
    return result;
  }

  return String(value);
}

function normalizeLevel(input: unknown): RuntimeLogLevel {
  const value = String(input || "").trim().toLowerCase();
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return "info";
}

function normalizeScope(input: unknown): RuntimeLogScope {
  const value = String(input || "").trim().toLowerCase();
  if (
    value === "workflow-trigger" ||
    value === "job" ||
    value === "provider" ||
    value === "hook" ||
    value === "system"
  ) {
    return value;
  }
  return "system";
}

function normalizeError(error: unknown) {
  if (!error) {
    return undefined;
  }
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || String(error),
      stack: error.stack || undefined,
    };
  }
  if (typeof error === "string") {
    return {
      name: "Error",
      message: sanitizeString(error),
    };
  }
  try {
    return {
      name: "Error",
      message: sanitizeString(JSON.stringify(error)),
    };
  } catch {
    return {
      name: "Error",
      message: sanitizeString(String(error)),
    };
  }
}

function normalizeId(input: unknown) {
  const value = String(input || "").trim();
  return value || undefined;
}

function parseSequenceFromLogId(id: string) {
  const matched = /^log-(\d+)$/.exec(String(id || "").trim());
  if (!matched) {
    return 0;
  }
  const parsed = Number(matched[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function parseRuntimeLogEntry(raw: unknown): RuntimeLogEntry | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = String(raw.id || "").trim();
  const ts = String(raw.ts || "").trim();
  const stage = String(raw.stage || "").trim();
  const message = String(raw.message || "").trim();
  if (!id || !ts || !stage || !message) {
    return null;
  }
  const entry: RuntimeLogEntry = {
    id,
    ts,
    level: normalizeLevel(raw.level),
    scope: normalizeScope(raw.scope),
    workflowId: normalizeId(raw.workflowId),
    requestId: normalizeId(raw.requestId),
    jobId: normalizeId(raw.jobId),
    stage,
    message: sanitizeString(message),
  };
  if (typeof raw.details !== "undefined") {
    entry.details = sanitizeValue(raw.details);
  }
  if (isRecord(raw.error)) {
    const name = String(raw.error.name || "").trim() || "Error";
    const errorMessage = String(raw.error.message || "").trim();
    if (errorMessage) {
      entry.error = {
        name,
        message: sanitizeString(errorMessage),
        stack: normalizeId(raw.error.stack),
      };
    }
  }
  return entry;
}

function persistRuntimeLogs() {
  try {
    setPref(
      HISTORY_PREF_KEY,
      JSON.stringify({
        entries,
        droppedEntries,
      }),
    );
  } catch {
    // Ignore prefs persistence failures in runtime logger.
  }
}

function pruneExpiredRuntimeLogs(nowMs = Date.now()) {
  const threshold = nowMs - RETENTION_MS;
  let removed = 0;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const ts = Date.parse(entries[i].ts || "");
    if (!Number.isFinite(ts) || ts >= threshold) {
      continue;
    }
    entries.splice(i, 1);
    removed += 1;
  }
  if (removed > 0) {
    droppedEntries += removed;
  }
  return removed;
}

function pruneOverflowRuntimeLogs() {
  if (entries.length <= MAX_ENTRIES) {
    return 0;
  }
  const overflow = entries.length - MAX_ENTRIES;
  entries.splice(0, overflow);
  droppedEntries += overflow;
  return overflow;
}

function hydrateRuntimeLogsIfNeeded() {
  if (hydrated) {
    return;
  }
  hydrated = true;
  let raw = "";
  try {
    raw = String(getPref(HISTORY_PREF_KEY) || "").trim();
  } catch {
    raw = "";
  }
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw) as RuntimeLogDocument | unknown[];
    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.entries)
        ? parsed.entries
        : [];
    entries.length = 0;
    droppedEntries = Math.max(
      0,
      Math.floor(Number(Array.isArray(parsed) ? 0 : parsed?.droppedEntries || 0) || 0),
    );
    let maxSeq = 0;
    for (const row of rows) {
      const parsedEntry = parseRuntimeLogEntry(row);
      if (!parsedEntry) {
        continue;
      }
      entries.push(parsedEntry);
      maxSeq = Math.max(maxSeq, parseSequenceFromLogId(parsedEntry.id));
    }
    sequence = Math.max(sequence, maxSeq);
    const expired = pruneExpiredRuntimeLogs();
    const overflow = pruneOverflowRuntimeLogs();
    if (expired > 0 || overflow > 0) {
      persistRuntimeLogs();
    }
  } catch {
    entries.length = 0;
    droppedEntries = 0;
    persistRuntimeLogs();
  }
}

function emitChanged() {
  if (listeners.size === 0) {
    return;
  }
  const snapshot = snapshotRuntimeLogs();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function setRuntimeLogAllowedLevels(levels: RuntimeLogLevel[]) {
  allowedLevels.clear();
  for (const level of levels) {
    allowedLevels.add(level);
  }
}

export function resetRuntimeLogAllowedLevels() {
  allowedLevels.clear();
  for (const level of DEFAULT_ALLOWED_LEVELS) {
    allowedLevels.add(level);
  }
}

export function appendRuntimeLog(input: RuntimeLogInput) {
  hydrateRuntimeLogsIfNeeded();
  const level = normalizeLevel(input.level);
  if (!allowedLevels.has(level)) {
    return null;
  }

  const entry: RuntimeLogEntry = {
    id: `log-${++sequence}`,
    ts: String(input.ts || new Date().toISOString()),
    level,
    scope: normalizeScope(input.scope),
    workflowId: normalizeId(input.workflowId),
    requestId: normalizeId(input.requestId),
    jobId: normalizeId(input.jobId),
    stage: String(input.stage || "unknown").trim() || "unknown",
    message: sanitizeString(String(input.message || "")),
  };

  if (typeof input.details !== "undefined") {
    entry.details = sanitizeValue(input.details);
  }
  const normalizedError = normalizeError(input.error);
  if (normalizedError) {
    entry.error = normalizedError;
  }

  entries.push(entry);
  pruneExpiredRuntimeLogs();
  pruneOverflowRuntimeLogs();
  persistRuntimeLogs();
  emitChanged();
  return cloneEntry(entry);
}

export function listRuntimeLogs(filters: RuntimeLogListFilters = {}) {
  hydrateRuntimeLogsIfNeeded();
  const levels = Array.isArray(filters.levels) ? new Set(filters.levels) : null;
  const scopes = Array.isArray(filters.scopes) ? new Set(filters.scopes) : null;
  const workflowId = normalizeId(filters.workflowId);
  const requestId = normalizeId(filters.requestId);
  const jobId = normalizeId(filters.jobId);

  let result = entries.filter((entry) => {
    if (levels && !levels.has(entry.level)) {
      return false;
    }
    if (scopes && !scopes.has(entry.scope)) {
      return false;
    }
    if (workflowId && entry.workflowId !== workflowId) {
      return false;
    }
    if (requestId && entry.requestId !== requestId) {
      return false;
    }
    if (jobId && entry.jobId !== jobId) {
      return false;
    }
    return true;
  });

  if (filters.order === "desc") {
    result = [...result].reverse();
  }

  const limit = Number(filters.limit);
  if (Number.isFinite(limit) && limit > 0) {
    result = result.slice(0, Math.floor(limit));
  }

  return result.map((entry) => cloneEntry(entry));
}

export function clearRuntimeLogs() {
  hydrateRuntimeLogsIfNeeded();
  entries.length = 0;
  droppedEntries = 0;
  persistRuntimeLogs();
  emitChanged();
}

export function snapshotRuntimeLogs(): RuntimeLogSnapshot {
  hydrateRuntimeLogsIfNeeded();
  return {
    entries: entries.map((entry) => cloneEntry(entry)),
    droppedEntries,
    maxEntries: MAX_ENTRIES,
  };
}

export function subscribeRuntimeLogs(listener: RuntimeLogListener) {
  hydrateRuntimeLogsIfNeeded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function formatRuntimeLogsAsPrettyJson(entriesToFormat: RuntimeLogEntry[]) {
  return JSON.stringify(entriesToFormat, null, 2);
}

export function formatRuntimeLogsAsNDJSON(entriesToFormat: RuntimeLogEntry[]) {
  return entriesToFormat.map((entry) => JSON.stringify(entry)).join("\n");
}

export function getRuntimeLogRetentionConfig() {
  return {
    maxEntries: MAX_ENTRIES,
    retentionDays: RETENTION_DAYS,
    retentionMs: RETENTION_MS,
  };
}
