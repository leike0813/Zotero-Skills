import { resolveBackendForWorkflow, listBackendsForProvider } from "../backends/registry";
import type { BackendInstance } from "../backends/types";
import { resolveProviderById, normalizeProviderRuntimeOptions } from "../providers/registry";
import type { WorkflowManifest, LoadedWorkflow } from "../workflows/types";
import { getPref, setPref } from "../utils/prefs";
import { resolveWorkflowRequestKind } from "./workflowRequestKind";
import { DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE } from "../config/defaults";

const WORKFLOW_SETTINGS_PREF_KEY = "workflowSettingsJson";

export type WorkflowExecutionOptions = {
  backendId?: string;
  workflowParams?: Record<string, unknown>;
  providerOptions?: Record<string, unknown>;
};

export type WorkflowSettingsRecord = Record<string, WorkflowExecutionOptions>;

type WorkflowExecutionContext = {
  backend: BackendInstance;
  requestKind: string;
  workflowParams: Record<string, unknown>;
  providerOptions: Record<string, unknown>;
  providerId: string;
};

const runOnceOverrides = new Map<string, WorkflowExecutionOptions>();

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseSettingsRecord(raw: unknown): WorkflowSettingsRecord {
  if (!isObject(raw)) {
    return {};
  }
  const normalized: WorkflowSettingsRecord = {};
  for (const [workflowId, value] of Object.entries(raw)) {
    if (!isObject(value)) {
      continue;
    }
    normalized[workflowId] = {
      backendId:
        typeof value.backendId === "string" ? value.backendId.trim() : undefined,
      workflowParams: isObject(value.workflowParams)
        ? { ...value.workflowParams }
        : {},
      providerOptions: isObject(value.providerOptions)
        ? { ...value.providerOptions }
        : {},
    };
  }
  return normalized;
}

function readSettingsRecord(): WorkflowSettingsRecord {
  const rawText = String(getPref(WORKFLOW_SETTINGS_PREF_KEY) || "").trim();
  if (!rawText) {
    return {};
  }
  try {
    return parseSettingsRecord(JSON.parse(rawText));
  } catch {
    return {};
  }
}

function writeSettingsRecord(record: WorkflowSettingsRecord) {
  setPref(WORKFLOW_SETTINGS_PREF_KEY, JSON.stringify(record));
}

function coerceBySchemaType(type: string, value: unknown) {
  if (type === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return ["1", "true", "yes", "on"].includes(value.toLowerCase());
    }
    return undefined;
  }
  if (type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }
  if (type === "string") {
    if (typeof value === "string") {
      return value;
    }
    return undefined;
  }
  return undefined;
}

function normalizeWorkflowParamsBySchema(
  manifest: WorkflowManifest,
  source: unknown,
) {
  const schemas = manifest.parameters || {};
  const schemaEntries = Object.entries(schemas);
  const input = isObject(source) ? source : {};
  if (schemaEntries.length === 0) {
    return { ...input };
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, schema] of schemaEntries) {
    const raw =
      typeof input[key] === "undefined" ? schema.default : input[key];
    const coerced = coerceBySchemaType(schema.type, raw);
    if (typeof coerced === "undefined") {
      continue;
    }
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      if (!schema.enum.some((candidate) => candidate === coerced)) {
        continue;
      }
    }
    if (
      schema.type === "number" &&
      typeof coerced === "number" &&
      typeof schema.min === "number" &&
      coerced < schema.min
    ) {
      continue;
    }
    if (
      schema.type === "number" &&
      typeof coerced === "number" &&
      typeof schema.max === "number" &&
      coerced > schema.max
    ) {
      continue;
    }
    normalized[key] = coerced;
  }
  return normalized;
}

function resolveProviderId(workflow: LoadedWorkflow) {
  const providerId = String(workflow.manifest.provider || "").trim();
  if (!providerId) {
    const requestKind = String(workflow.manifest.request?.kind || "").trim();
    for (const [backendType, knownRequestKind] of Object.entries(
      DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE,
    )) {
      if (knownRequestKind === requestKind) {
        return backendType;
      }
    }
    throw new Error(
      `Workflow ${workflow.manifest.id} does not declare provider`,
    );
  }
  return providerId;
}

function mergeExecutionOptions(
  base: WorkflowExecutionOptions | undefined,
  override: WorkflowExecutionOptions | undefined,
): WorkflowExecutionOptions {
  return {
    backendId: String(override?.backendId || base?.backendId || "").trim() || undefined,
    workflowParams: {
      ...(base?.workflowParams || {}),
      ...(override?.workflowParams || {}),
    },
    providerOptions: {
      ...(base?.providerOptions || {}),
      ...(override?.providerOptions || {}),
    },
  };
}

export function getWorkflowSettings(workflowId: string): WorkflowExecutionOptions {
  const record = readSettingsRecord();
  return record[String(workflowId || "").trim()] || {};
}

export function updateWorkflowSettings(
  workflowId: string,
  next: WorkflowExecutionOptions,
) {
  const normalizedWorkflowId = String(workflowId || "").trim();
  if (!normalizedWorkflowId) {
    throw new Error("workflowId is required");
  }
  const record = readSettingsRecord();
  record[normalizedWorkflowId] = mergeExecutionOptions(
    record[normalizedWorkflowId],
    next,
  );
  writeSettingsRecord(record);
}

export function clearWorkflowSettings(workflowId: string) {
  const normalizedWorkflowId = String(workflowId || "").trim();
  if (!normalizedWorkflowId) {
    return;
  }
  const record = readSettingsRecord();
  delete record[normalizedWorkflowId];
  writeSettingsRecord(record);
}

export function listWorkflowSettingsRecord() {
  return readSettingsRecord();
}

export function setRunOnceWorkflowOverrides(
  workflowId: string,
  overrides: WorkflowExecutionOptions,
) {
  const normalizedWorkflowId = String(workflowId || "").trim();
  if (!normalizedWorkflowId) {
    throw new Error("workflowId is required");
  }
  runOnceOverrides.set(
    normalizedWorkflowId,
    mergeExecutionOptions(runOnceOverrides.get(normalizedWorkflowId), overrides),
  );
}

export function clearRunOnceWorkflowOverrides(workflowId: string) {
  runOnceOverrides.delete(String(workflowId || "").trim());
}

function getRunOnceWorkflowOverrides(args: {
  workflowId: string;
  consume: boolean;
}) {
  const key = String(args.workflowId || "").trim();
  if (!key) {
    return {};
  }
  const found = runOnceOverrides.get(key) || {};
  if (args.consume) {
    runOnceOverrides.delete(key);
  }
  return found;
}

export async function listProviderProfilesForWorkflow(workflow: LoadedWorkflow) {
  const providerId = resolveProviderId(workflow);
  return listBackendsForProvider(providerId);
}

export async function resolveWorkflowExecutionContext(args: {
  workflow: LoadedWorkflow;
  consumeRunOnce?: boolean;
}): Promise<WorkflowExecutionContext> {
  const providerId = resolveProviderId(args.workflow);
  const provider = resolveProviderById(providerId);
  const saved = getWorkflowSettings(args.workflow.manifest.id);
  const runOnce = getRunOnceWorkflowOverrides({
    workflowId: args.workflow.manifest.id,
    consume: args.consumeRunOnce === true,
  });
  const merged = mergeExecutionOptions(saved, runOnce);

  const backend = await resolveBackendForWorkflow(args.workflow, {
    preferredBackendId: merged.backendId,
  });
  const requestKind = resolveWorkflowRequestKind(args.workflow, backend.type);
  const workflowParams = normalizeWorkflowParamsBySchema(
    args.workflow.manifest,
    merged.workflowParams,
  );
  const providerOptions = normalizeProviderRuntimeOptions({
    providerId: provider.id,
    options: merged.providerOptions,
  });

  return {
    backend,
    requestKind,
    workflowParams,
    providerOptions,
    providerId,
  };
}
