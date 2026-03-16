import {
  DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE,
} from "../config/defaults";
import { getPref, setPref } from "../utils/prefs";
import type { LoadedWorkflow } from "../workflows/types";
import {
  normalizeBackendDisplayName,
} from "./identity";
import type { BackendInstance, LoadedBackends } from "./types";

type BackendsDocument = {
  defaultBackendId?: unknown;
  schemaVersion?: unknown;
  backends?: unknown;
};

type BackendsDocShape = {
  schemaVersion: number;
  entries: unknown[];
};

const BACKENDS_CONFIG_PREF_KEY = "backendsConfigJson";
const WORKFLOW_SETTINGS_PREF_KEY = "workflowSettingsJson";
const TASK_DASHBOARD_HISTORY_PREF_KEY = "taskDashboardHistoryJson";
const BACKENDS_SCHEMA_VERSION = 2;
const LEGACY_REMOVED_BACKEND_IDS = new Set(["skillrunner-local"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeBackendsSchemaVersion(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }
  return 0;
}

function buildInitialBackendsDocument(): {
  schemaVersion: number;
  backends: BackendInstance[];
} {
  return {
    schemaVersion: BACKENDS_SCHEMA_VERSION,
    backends: [],
  };
}

function ensureBackendsPrefsDocument() {
  const raw = String(getPref(BACKENDS_CONFIG_PREF_KEY) || "").trim();
  if (raw) {
    return raw;
  }

  const serialized = JSON.stringify(buildInitialBackendsDocument());
  setPref(BACKENDS_CONFIG_PREF_KEY, serialized);
  return serialized;
}

function normalizeBackendsDocument(parsed: unknown): BackendsDocShape {
  if (Array.isArray(parsed)) {
    return {
      schemaVersion: 0,
      entries: parsed,
    };
  }
  if (!isObject(parsed)) {
    throw new Error(
      "Backends config must be an array or object with backends[]",
    );
  }
  const doc = parsed as BackendsDocument;
  if (!Array.isArray(doc.backends)) {
    throw new Error("Backends config object must contain backends[]");
  }
  return {
    schemaVersion: normalizeBackendsSchemaVersion(doc.schemaVersion),
    entries: doc.backends,
  };
}

function applyBackendIdMappingToWorkflowSettings(args: {
  idMapping: Map<string, string>;
  removedIds: Set<string>;
}) {
  const raw = String(getPref(WORKFLOW_SETTINGS_PREF_KEY) || "").trim();
  if (!raw) {
    return false;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!isObject(parsed)) {
    return false;
  }
  let changed = false;
  const next = { ...(parsed as Record<string, unknown>) };
  for (const [workflowId, value] of Object.entries(next)) {
    if (!isObject(value)) {
      continue;
    }
    const options = { ...(value as Record<string, unknown>) };
    const backendId = String(options.backendId || "").trim();
    if (!backendId) {
      continue;
    }
    const mappedId = args.idMapping.get(backendId);
    if (mappedId) {
      options.backendId = mappedId;
      next[workflowId] = options;
      changed = true;
      continue;
    }
    if (args.removedIds.has(backendId)) {
      delete options.backendId;
      next[workflowId] = options;
      changed = true;
    }
  }
  if (!changed) {
    return false;
  }
  setPref(WORKFLOW_SETTINGS_PREF_KEY, JSON.stringify(next));
  return true;
}

function rewriteHistoryRecordIdPrefix(recordId: string, from: string, to: string) {
  if (!recordId || !from || !to) {
    return recordId;
  }
  const prefix = `${from}:`;
  if (!recordId.startsWith(prefix)) {
    return recordId;
  }
  return `${to}:${recordId.slice(prefix.length)}`;
}

function applyBackendIdMappingToTaskHistory(args: {
  idMapping: Map<string, string>;
  removedIds: Set<string>;
}) {
  const raw = String(getPref(TASK_DASHBOARD_HISTORY_PREF_KEY) || "").trim();
  if (!raw) {
    return false;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : isObject(parsed) && Array.isArray(parsed.records)
      ? parsed.records
      : null;
  if (!rows) {
    return false;
  }
  let changed = false;
  const nextRows: unknown[] = [];
  for (const row of rows) {
    if (!isObject(row)) {
      nextRows.push(row);
      continue;
    }
    const nextRow = { ...row };
    const backendId = String(nextRow.backendId || "").trim();
    if (!backendId) {
      nextRows.push(nextRow);
      continue;
    }
    if (args.removedIds.has(backendId)) {
      changed = true;
      continue;
    }
    const mappedId = args.idMapping.get(backendId);
    if (!mappedId || mappedId === backendId) {
      nextRows.push(nextRow);
      continue;
    }
    nextRow.backendId = mappedId;
    nextRow.id = rewriteHistoryRecordIdPrefix(
      String(nextRow.id || ""),
      backendId,
      mappedId,
    );
    nextRows.push(nextRow);
    changed = true;
  }
  if (!changed) {
    return false;
  }
  setPref(
    TASK_DASHBOARD_HISTORY_PREF_KEY,
    JSON.stringify({
      records: nextRows,
    }),
  );
  return true;
}

function syncBackendReferences(args: {
  idMapping: Map<string, string>;
  removedIds?: Set<string>;
}) {
  const removedIds = args.removedIds || new Set<string>();
  applyBackendIdMappingToWorkflowSettings({
    idMapping: args.idMapping,
    removedIds,
  });
  applyBackendIdMappingToTaskHistory({
    idMapping: args.idMapping,
    removedIds,
  });
}

function normalizeBackendEntry(
  rawEntry: unknown,
  index: number,
): { backend?: BackendInstance; error?: string } {
  if (!isObject(rawEntry)) {
    return { error: `entry[${index}] must be an object` };
  }

  const idRaw = rawEntry.id;
  const typeRaw = rawEntry.type;
  const baseUrlRaw = rawEntry.baseUrl ?? rawEntry.base_url;
  if (!isNonEmptyString(idRaw)) {
    return { error: `entry[${index}] missing non-empty id` };
  }
  if (!isNonEmptyString(typeRaw)) {
    return { error: `entry[${index}] (${idRaw}) missing non-empty type` };
  }
  if (!isNonEmptyString(baseUrlRaw)) {
    return { error: `entry[${index}] (${idRaw}) missing non-empty baseUrl` };
  }
  const id = idRaw.trim();
  const displayName = normalizeBackendDisplayName(rawEntry.displayName, id);
  const type = typeRaw.trim();
  const baseUrl = baseUrlRaw.trim();

  try {
    const parsed = new URL(baseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        error: `entry[${index}] (${id}) baseUrl protocol must be http/https`,
      };
    }
  } catch {
    return { error: `entry[${index}] (${id}) baseUrl is not a valid URL` };
  }

  const authRaw = rawEntry.auth;
  let auth: BackendInstance["auth"] | undefined;
  if (typeof authRaw !== "undefined") {
    if (!isObject(authRaw)) {
      return { error: `entry[${index}] (${id}) auth must be an object` };
    }
    const kindRaw = authRaw.kind;
    const tokenRaw = authRaw.token;
    if (
      typeof kindRaw !== "undefined" &&
      kindRaw !== "none" &&
      kindRaw !== "bearer"
    ) {
      return {
        error: `entry[${index}] (${id}) auth.kind must be "none" or "bearer"`,
      };
    }
    if (kindRaw === "bearer") {
      if (!isNonEmptyString(tokenRaw)) {
        return {
          error: `entry[${index}] (${id}) auth.token is required for bearer auth`,
        };
      }
      auth = {
        kind: "bearer",
        token: tokenRaw.trim(),
      };
    } else {
      auth = {
        kind: "none",
      };
    }
  }

  const managementAuthRaw =
    rawEntry.management_auth ?? rawEntry.managementAuth;
  let managementAuth: BackendInstance["management_auth"] | undefined;
  if (typeof managementAuthRaw !== "undefined") {
    if (!isObject(managementAuthRaw)) {
      return {
        error: `entry[${index}] (${id}) management_auth must be an object`,
      };
    }
    const kindRaw = managementAuthRaw.kind;
    if (
      typeof kindRaw !== "undefined" &&
      kindRaw !== "none" &&
      kindRaw !== "basic"
    ) {
      return {
        error: `entry[${index}] (${id}) management_auth.kind must be "none" or "basic"`,
      };
    }
    if (kindRaw === "basic") {
      const usernameRaw = managementAuthRaw.username;
      const passwordRaw = managementAuthRaw.password;
      if (!isNonEmptyString(usernameRaw) || !isNonEmptyString(passwordRaw)) {
        return {
          error: `entry[${index}] (${id}) management_auth.username/password are required for basic auth`,
        };
      }
      managementAuth = {
        kind: "basic",
        username: usernameRaw.trim(),
        password: passwordRaw.trim(),
      };
    } else {
      managementAuth = {
        kind: "none",
      };
    }
  }

  const defaultsRaw = rawEntry.defaults;
  let defaults: BackendInstance["defaults"] | undefined;
  if (typeof defaultsRaw !== "undefined") {
    if (!isObject(defaultsRaw)) {
      return { error: `entry[${index}] (${id}) defaults must be an object` };
    }
    const headersRaw = defaultsRaw.headers;
    const timeoutRaw = defaultsRaw.timeout_ms;
    const headers: Record<string, string> = {};
    if (typeof headersRaw !== "undefined") {
      if (!isObject(headersRaw)) {
        return {
          error: `entry[${index}] (${id}) defaults.headers must be an object`,
        };
      }
      for (const [key, value] of Object.entries(headersRaw)) {
        if (typeof value !== "string") {
          return {
            error: `entry[${index}] (${id}) defaults.headers.${key} must be a string`,
          };
        }
        headers[key] = value;
      }
    }

    if (
      typeof timeoutRaw !== "undefined" &&
      (typeof timeoutRaw !== "number" ||
        !Number.isFinite(timeoutRaw) ||
        timeoutRaw <= 0)
    ) {
      return {
        error: `entry[${index}] (${id}) defaults.timeout_ms must be a positive number`,
      };
    }

    defaults = {
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      ...(typeof timeoutRaw === "number" ? { timeout_ms: timeoutRaw } : {}),
    };
  }

  return {
    backend: {
      id,
      displayName,
      type,
      baseUrl,
      ...(auth ? { auth } : {}),
      ...(defaults ? { defaults } : {}),
      ...(managementAuth ? { management_auth: managementAuth } : {}),
    },
  };
}

export function syncBackendReferenceState(args: {
  idMapping?: Map<string, string>;
  removedIds?: Iterable<string>;
}) {
  const mapping = args.idMapping || new Map<string, string>();
  const removedIds = new Set<string>(args.removedIds || []);
  if (mapping.size === 0 && removedIds.size === 0) {
    return false;
  }
  syncBackendReferences({
    idMapping: mapping,
    removedIds,
  });
  return true;
}

export function createBackendsPrefsDocument(backends: BackendInstance[]) {
  return {
    schemaVersion: BACKENDS_SCHEMA_VERSION,
    backends,
  };
}

export async function loadBackendsRegistry(): Promise<LoadedBackends> {
  const sourcePath = "prefs";
  const warnings: string[] = [];
  const errors: string[] = [];
  const invalidBackends: Record<string, string> = {};

  const rawText = ensureBackendsPrefsDocument();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    const fatalError = `Invalid backends JSON in prefs (${String(error)})`;
    return {
      sourcePath,
      backends: [],
      warnings,
      errors,
      invalidBackends,
      fatalError,
    };
  }

  let normalized: BackendsDocShape;
  try {
    normalized = normalizeBackendsDocument(parsed);
  } catch (error) {
    const fatalError = `Invalid backends config structure in prefs (${String(error)})`;
    return {
      sourcePath,
      backends: [],
      warnings,
      errors,
      invalidBackends,
      fatalError,
    };
  }

  const validBackends: BackendInstance[] = [];
  const seenBackendIds = new Set<string>();
  for (let i = 0; i < normalized.entries.length; i++) {
    const normalizedEntry = normalizeBackendEntry(normalized.entries[i], i);
    if (!normalizedEntry.backend) {
      errors.push(normalizedEntry.error || `entry[${i}] invalid`);
      continue;
    }
    const backend = normalizedEntry.backend;
    if (seenBackendIds.has(backend.id)) {
      const reason = `duplicated backend id "${backend.id}"`;
      errors.push(reason);
      invalidBackends[backend.id] = reason;
      continue;
    }
    seenBackendIds.add(backend.id);
    validBackends.push(backend);
  }

  for (const reason of errors) {
    const idMatch = reason.match(/(?:\(|id ")([^)"\s]+)(?:\)|")?/);
    if (idMatch?.[1]) {
      invalidBackends[idMatch[1]] = reason;
    }
  }

  const removedLegacyIds = new Set<string>();
  const finalBackends = validBackends.filter((backend) => {
    if (!LEGACY_REMOVED_BACKEND_IDS.has(backend.id)) {
      return true;
    }
    removedLegacyIds.add(backend.id);
    return false;
  });
  if (removedLegacyIds.size > 0) {
    setPref(
      BACKENDS_CONFIG_PREF_KEY,
      JSON.stringify(createBackendsPrefsDocument(finalBackends)),
    );
    syncBackendReferences({
      idMapping: new Map<string, string>(),
      removedIds: removedLegacyIds,
    });
    warnings.push(
      `Removed legacy backend ids: ${Array.from(removedLegacyIds.values()).join(", ")}`,
    );
  }

  return {
    sourcePath,
    backends: finalBackends,
    warnings,
    errors,
    invalidBackends,
  };
}

export async function listBackendInstances() {
  const loaded = await loadBackendsRegistry();
  if (loaded.fatalError) {
    throw new Error(loaded.fatalError);
  }
  return loaded.backends;
}

function resolveProviderTypeFromWorkflow(workflow: LoadedWorkflow) {
  const declaredProvider = String(workflow.manifest.provider || "").trim();
  if (declaredProvider) {
    return declaredProvider;
  }
  const requestKind = String(workflow.manifest.request?.kind || "").trim();
  if (requestKind) {
    for (const [backendType, knownRequestKind] of Object.entries(
      DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE,
    )) {
      if (knownRequestKind === requestKind) {
        return backendType;
      }
    }
  }
  return "";
}

export async function listBackendsForProvider(providerType: string) {
  const loaded = await loadBackendsRegistry();
  if (loaded.fatalError) {
    throw new Error(loaded.fatalError);
  }
  const normalizedType = String(providerType || "").trim();
  if (!normalizedType) {
    return [];
  }
  return loaded.backends.filter((backend) => backend.type === normalizedType);
}

export async function resolveBackendForWorkflow(
  workflow: LoadedWorkflow,
  options?: {
    preferredBackendId?: string;
  },
) {
  const loaded = await loadBackendsRegistry();
  if (loaded.fatalError) {
    throw new Error(loaded.fatalError);
  }

  const byId = new Map(loaded.backends.map((backend) => [backend.id, backend]));
  const providerType = resolveProviderTypeFromWorkflow(workflow);
  if (!providerType) {
    throw new Error(
      `Workflow ${workflow.manifest.id} does not declare provider and request kind cannot infer provider type`,
    );
  }
  const backendsByType = loaded.backends.filter(
    (backend) => backend.type === providerType,
  );
  if (backendsByType.length === 0) {
    throw new Error(
      `No backend profiles found for provider "${providerType}" (workflow=${workflow.manifest.id})`,
    );
  }

  const preferredBackendId = String(options?.preferredBackendId || "").trim();
  if (preferredBackendId) {
    const preferredMatched = byId.get(preferredBackendId);
    if (preferredMatched) {
      if (preferredMatched.type !== providerType) {
        throw new Error(
          `Unknown or incompatible backendId "${preferredBackendId}" for workflow ${workflow.manifest.id} (provider=${providerType})`,
        );
      }
      return preferredMatched;
    }
    const preferredInvalidReason = loaded.invalidBackends[preferredBackendId];
    if (preferredInvalidReason) {
      throw new Error(
        `Backend "${preferredBackendId}" is invalid for workflow ${workflow.manifest.id}: ${preferredInvalidReason}`,
      );
    }
    throw new Error(
      `Unknown or incompatible backendId "${preferredBackendId}" for workflow ${workflow.manifest.id} (provider=${providerType})`,
    );
  }

  return backendsByType[0];
}
