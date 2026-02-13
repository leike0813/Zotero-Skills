import { resolveBackendForWorkflow, listBackendsForProvider } from "../backends/registry";
import type { BackendInstance } from "../backends/types";
import { resolveProviderById, normalizeProviderRuntimeOptions } from "../providers/registry";
import type { LoadedWorkflow } from "../workflows/types";
import { getPref, setPref } from "../utils/prefs";
import { resolveWorkflowRequestKind } from "./workflowRequestKind";
import {
  DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE,
  PASS_THROUGH_BACKEND_TYPE,
} from "../config/defaults";
import {
  type WorkflowExecutionOptions,
  type WorkflowSettingsDialogInitialState,
  type WorkflowSettingsRecord,
  buildWorkflowSettingsDialogInitialState,
  mergeExecutionOptions,
  normalizeWorkflowParamsBySchema,
  parseSettingsRecord,
} from "./workflowSettingsDomain";
import {
  applyExecutionWorkflowParamsNormalizer,
  applyPersistedWorkflowSettingsNormalizer,
} from "./workflowSettingsNormalizer";

const WORKFLOW_SETTINGS_PREF_KEY = "workflowSettingsJson";

type WorkflowExecutionContext = {
  backend: BackendInstance;
  requestKind: string;
  workflowParams: Record<string, unknown>;
  providerOptions: Record<string, unknown>;
  providerId: string;
};

const runOnceOverrides = new Map<string, WorkflowExecutionOptions>();

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

function buildLocalBackendForProvider(providerId: string): BackendInstance {
  const normalizedProvider = String(providerId || "").trim();
  const backendType = normalizedProvider || PASS_THROUGH_BACKEND_TYPE;
  return {
    id: `${backendType}-local`,
    type: backendType,
    baseUrl: `local://${backendType}`,
    auth: {
      kind: "none",
    },
  };
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

export type { WorkflowExecutionOptions, WorkflowSettingsRecord, WorkflowSettingsDialogInitialState };

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
  const previous = record[normalizedWorkflowId];
  const merged = mergeExecutionOptions(record[normalizedWorkflowId], next);
  record[normalizedWorkflowId] = applyPersistedWorkflowSettingsNormalizer({
    workflowId: normalizedWorkflowId,
    previous,
    merged,
    incoming: next,
  });
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

export function resetRunOnceOverridesForSettingsOpen(
  workflowId: string,
): WorkflowExecutionOptions {
  const normalizedWorkflowId = String(workflowId || "").trim();
  if (!normalizedWorkflowId) {
    throw new Error("workflowId is required");
  }
  clearRunOnceWorkflowOverrides(normalizedWorkflowId);
  return getWorkflowSettings(normalizedWorkflowId);
}

export function getWorkflowSettingsDialogInitialState(
  workflowId: string,
): WorkflowSettingsDialogInitialState {
  const saved = resetRunOnceOverridesForSettingsOpen(workflowId);
  return buildWorkflowSettingsDialogInitialState(saved);
}

export function savePersistentWorkflowSettingsDraft(args: {
  workflowId: string;
  draft: WorkflowExecutionOptions;
}) {
  updateWorkflowSettings(args.workflowId, args.draft);
}

export function applyRunOnceWorkflowSettingsDraft(args: {
  workflowId: string;
  draft: WorkflowExecutionOptions;
}) {
  setRunOnceWorkflowOverrides(args.workflowId, args.draft);
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

  const backend =
    provider.requiresBackendProfile === false
      ? buildLocalBackendForProvider(provider.id)
      : await resolveBackendForWorkflow(args.workflow, {
          preferredBackendId: merged.backendId,
        });
  const requestKind = resolveWorkflowRequestKind(args.workflow, backend.type);
  const schemaNormalizedWorkflowParams = normalizeWorkflowParamsBySchema(
    args.workflow.manifest,
    merged.workflowParams,
  );
  const workflowParams = applyExecutionWorkflowParamsNormalizer({
    workflow: args.workflow,
    rawWorkflowParams:
      (merged.workflowParams as Record<string, unknown> | undefined) || {},
    normalizedWorkflowParams: schemaNormalizedWorkflowParams,
  });
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
