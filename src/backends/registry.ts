import {
  DEFAULT_BACKEND_ID,
  DEFAULT_BACKEND_TYPE,
  DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE,
  DEFAULT_SKILLRUNNER_ENDPOINT,
} from "../config/defaults";
import { getPref, setPref } from "../utils/prefs";
import type { LoadedWorkflow } from "../workflows/types";
import type { BackendInstance, LoadedBackends } from "./types";

type BackendsDocument = {
  defaultBackendId?: unknown;
  backends?: unknown;
};

const BACKENDS_CONFIG_PREF_KEY = "backendsConfigJson";
const LEGACY_SKILLRUNNER_ENDPOINT_PREF_KEY = "skillRunnerEndpoint";
const DEFAULT_BACKEND_TIMEOUT_MS = 600000;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildMigratedDocument(skillRunnerEndpoint: string): {
  backends: BackendInstance[];
} {
  return {
    backends: [
      {
        id: DEFAULT_BACKEND_ID,
        type: DEFAULT_BACKEND_TYPE,
        baseUrl: skillRunnerEndpoint,
        auth: {
          kind: "none",
        },
        defaults: {
          headers: {},
          timeout_ms: DEFAULT_BACKEND_TIMEOUT_MS,
        },
      },
    ],
  };
}

function ensureBackendsPrefsDocument() {
  const raw = String(getPref(BACKENDS_CONFIG_PREF_KEY) || "").trim();
  if (raw) {
    return raw;
  }

  const legacySkillRunnerEndpoint = String(
    getPref(LEGACY_SKILLRUNNER_ENDPOINT_PREF_KEY) ||
      DEFAULT_SKILLRUNNER_ENDPOINT,
  ).trim();
  const migrated = buildMigratedDocument(
    legacySkillRunnerEndpoint || DEFAULT_SKILLRUNNER_ENDPOINT,
  );
  const serialized = JSON.stringify(migrated);
  setPref(BACKENDS_CONFIG_PREF_KEY, serialized);
  return serialized;
}

function normalizeBackendsDocument(parsed: unknown): {
  entries: unknown[];
} {
  if (Array.isArray(parsed)) {
    return {
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
    entries: doc.backends,
  };
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
      type,
      baseUrl,
      ...(auth ? { auth } : {}),
      ...(defaults ? { defaults } : {}),
    },
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

  let normalized: { entries: unknown[] };
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

  return {
    sourcePath,
    backends: validBackends,
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

  const candidateIds = [backendsByType[0].id, DEFAULT_BACKEND_ID].filter(
    Boolean,
  );

  for (const candidateId of candidateIds) {
    const matched = byId.get(candidateId);
    if (!matched) {
      continue;
    }
    if (matched.type !== providerType) {
      continue;
    }
    return matched;
  }

  throw new Error(
    `No compatible backend profile resolved for workflow ${workflow.manifest.id} (provider=${providerType}, source=${loaded.sourcePath})`,
  );
}
