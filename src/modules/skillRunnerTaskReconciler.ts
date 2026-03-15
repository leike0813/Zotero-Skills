import type { BackendInstance } from "../backends/types";
import { resolveBackendDisplayName } from "../backends/displayName";
import type { JobRecord, JobState } from "../jobQueue/manager";
import { SkillRunnerClient } from "../providers/skillrunner/client";
import { resolveSkillRunnerBackendCommunicationFailedToastText } from "../utils/localizationGovernance";
import { executeApplyResult } from "../workflows/runtime";
import { ZipBundleReader } from "../workflows/zipBundleReader";
import {
  buildTempBundlePath,
  createUnavailableBundleReader,
  removeFileIfExists,
  writeBytes,
} from "./workflowExecution/bundleIO";
import { appendRuntimeLog } from "./runtimeLogManager";
import { getLoadedWorkflowEntries, rescanWorkflowRegistry } from "./workflowRuntime";
import {
  listTaskDashboardHistory,
  recordTaskDashboardHistoryFromJob,
  removeTaskDashboardHistoryByBackendAndRequestIds,
} from "./taskDashboardHistory";
import {
  listActiveWorkflowTasks,
  recordWorkflowTaskUpdate,
  removeWorkflowTasksByBackendAndRequestIds,
} from "./taskRuntime";
import { showWorkflowToast } from "./workflowExecution/feedbackSeam";
import { localizeWorkflowText } from "./workflowExecution/messageFormatter";
import { resolveTargetParentIDFromRequest } from "./workflowExecution/requestMeta";
import { getPref, setPref } from "../utils/prefs";
import {
  isTerminal,
  isWaiting,
  normalizeStatus,
  normalizeStatusWithGuard,
  validateEventOrder,
  validateTransition,
  type SkillRunnerStateEvent,
  type SkillRunnerStateMachineViolation,
} from "./skillRunnerProviderStateMachine";

type DeferredResultLike = {
  status?: unknown;
  requestId?: unknown;
  fetchType?: unknown;
  backendStatus?: unknown;
};

type ReconcileContext = {
  id: string;
  workflowId: string;
  workflowLabel: string;
  requestKind: string;
  request: unknown;
  backendId: string;
  backendType: string;
  backendBaseUrl: string;
  providerId: string;
  providerOptions: Record<string, unknown>;
  runId: string;
  jobId: string;
  taskName: string;
  inputUnitIdentity?: string;
  inputUnitLabel?: string;
  targetParentID?: number;
  requestId: string;
  fetchType: "bundle" | "result";
  state: JobState;
  events: SkillRunnerStateEvent[];
  applyAttempt: number;
  applyMaxAttempt: number;
  nextApplyRetryAt?: string;
  lastApplyError?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type ReconcileDocument = {
  records?: unknown;
};

const PREF_KEY = "skillRunnerDeferredTasksJson";
const POLL_INTERVAL_MS = 1600;
const BACKEND_RECONCILE_FAILURE_LOG_THROTTLE_MS = 60000;
const APPLY_MAX_ATTEMPTS = 5;
const APPLY_RETRY_BASE_MS = 1000;
const APPLY_RETRY_MAX_MS = 30000;

export type SkillRunnerBackendTaskLedgerReconcileSource =
  | "startup"
  | "local-runtime-up";

export type SkillRunnerBackendTaskLedgerReconcileResult = {
  ok: boolean;
  source: SkillRunnerBackendTaskLedgerReconcileSource;
  backendId: string;
  stage: string;
  message: string;
  checkedRequestIds: string[];
  missingRequestIds: string[];
  removedActiveCount: number;
  removedHistoryCount: number;
};

type BackendReconcileFailureToastPayload = {
  backendId: string;
  displayName: string;
  source: SkillRunnerBackendTaskLedgerReconcileSource;
  text: string;
};

type SkillRunnerTaskLifecycleToastPayload = {
  state: "waiting_user" | "waiting_auth" | "succeeded" | "failed" | "canceled";
  text: string;
  type: "default" | "success" | "error";
};

let backendReconcileFailureToastEmitter: (
  payload: BackendReconcileFailureToastPayload,
) => void = (payload) => {
  showWorkflowToast({
    text: payload.text,
    type: "error",
  });
};

let skillRunnerTaskLifecycleToastEmitter: (
  payload: SkillRunnerTaskLifecycleToastPayload,
) => void = (payload) => {
  showWorkflowToast({
    text: payload.text,
    type: payload.type,
  });
};

export function setSkillRunnerBackendReconcileFailureToastEmitterForTests(
  emitter?: (payload: BackendReconcileFailureToastPayload) => void,
) {
  backendReconcileFailureToastEmitter = emitter || ((payload) => {
    showWorkflowToast({
      text: payload.text,
      type: "error",
    });
  });
}

export function setSkillRunnerTaskLifecycleToastEmitterForTests(
  emitter?: (payload: SkillRunnerTaskLifecycleToastPayload) => void,
) {
  skillRunnerTaskLifecycleToastEmitter = emitter || ((payload) => {
    showWorkflowToast({
      text: payload.text,
      type: payload.type,
    });
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown) {
  return String(value || "").trim();
}

function normalizeInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function computeApplyRetryDelayMs(attempt: number) {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const delay = APPLY_RETRY_BASE_MS * 2 ** (safeAttempt - 1);
  return Math.min(APPLY_RETRY_MAX_MS, delay);
}

function extractHttpStatusFromError(error: unknown) {
  const message = normalizeString(
    error && typeof error === "object" && "message" in error
      ? (error as { message?: unknown }).message
      : error,
  );
  if (!message) {
    return 0;
  }
  const matched = message.match(/HTTP\s+(\d{3})\b/i);
  if (!matched) {
    return 0;
  }
  const parsed = Number(matched[1]);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.floor(parsed);
}

function collectRequestIdsForBackend(backendId: string) {
  const normalizedBackendId = normalizeString(backendId);
  if (!normalizedBackendId) {
    return [] as string[];
  }
  const requestIds = new Set<string>();
  for (const row of listActiveWorkflowTasks()) {
    if (normalizeString(row.backendId) !== normalizedBackendId) {
      continue;
    }
    const requestId = normalizeString(row.requestId);
    if (!requestId) {
      continue;
    }
    requestIds.add(requestId);
  }
  for (const row of listTaskDashboardHistory({ backendId: normalizedBackendId })) {
    const requestId = normalizeString(row.requestId);
    if (!requestId) {
      continue;
    }
    requestIds.add(requestId);
  }
  return Array.from(requestIds.values());
}

function appendStateMachineWarning(args: {
  workflowId?: string;
  jobId?: string;
  requestId?: string;
  violation?: SkillRunnerStateMachineViolation;
}) {
  if (!args.violation) {
    return;
  }
  appendRuntimeLog({
    level: "warn",
    scope: "state-machine",
    workflowId: args.workflowId,
    backendId: undefined,
    backendType: undefined,
    providerId: undefined,
    runId: undefined,
    jobId: args.jobId,
    requestId: args.requestId,
    component: "skillrunner-reconciler",
    operation: "state-machine-guard",
    phase: "reconcile",
    stage: "state-machine-guard",
    message: "state machine guard degraded runtime state",
    details: args.violation,
  });
}

export function mapSkillRunnerBackendStatusToJobState(
  status: unknown,
  fallback: JobState = "running",
): JobState {
  return normalizeStatus(status, fallback);
}

function isTerminalState(state: JobState) {
  return isTerminal(state);
}

function parseContext(raw: unknown): ReconcileContext | null {
  if (!isObject(raw)) {
    return null;
  }
  const id = normalizeString(raw.id);
  const workflowId = normalizeString(raw.workflowId);
  const workflowLabel = normalizeString(raw.workflowLabel);
  const requestKind = normalizeString(raw.requestKind);
  const backendId = normalizeString(raw.backendId);
  const backendType = normalizeString(raw.backendType);
  const backendBaseUrl = normalizeString(raw.backendBaseUrl);
  const providerId = normalizeString(raw.providerId);
  const runId = normalizeString(raw.runId);
  const jobId = normalizeString(raw.jobId);
  const taskName = normalizeString(raw.taskName);
  const requestId = normalizeString(raw.requestId);
  const createdAt = normalizeString(raw.createdAt);
  const updatedAt = normalizeString(raw.updatedAt);
  const fetchType = normalizeString(raw.fetchType) === "result" ? "result" : "bundle";
  const state = normalizeStatusWithGuard({
    value: raw.state,
    fallback: "running",
    requestId,
  }).status;
  const applyAttempt = normalizeInteger(raw.applyAttempt, 0);
  const applyMaxAttempt = Math.max(
    1,
    normalizeInteger(raw.applyMaxAttempt, APPLY_MAX_ATTEMPTS),
  );
  const nextApplyRetryAt = normalizeString(raw.nextApplyRetryAt) || undefined;
  const lastApplyError = normalizeString(raw.lastApplyError) || undefined;
  const events = Array.isArray(raw.events)
    ? raw.events
        .filter((entry) => isObject(entry))
        .map((entry) => ({
          kind: normalizeString(entry.kind),
          status: normalizeString(entry.status) || undefined,
        }))
    : [];
  if (
    !id ||
    !workflowId ||
    !requestKind ||
    !backendId ||
    !backendType ||
    !backendBaseUrl ||
    !providerId ||
    !runId ||
    !jobId ||
    !taskName ||
    !requestId ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }
  return {
    id,
    workflowId,
    workflowLabel: workflowLabel || workflowId,
    requestKind,
    request: raw.request,
    backendId,
    backendType,
    backendBaseUrl,
    providerId,
    providerOptions: isObject(raw.providerOptions)
      ? { ...raw.providerOptions }
      : {},
    runId,
    jobId,
    taskName,
    inputUnitIdentity: normalizeString(raw.inputUnitIdentity) || undefined,
    inputUnitLabel: normalizeString(raw.inputUnitLabel) || undefined,
    targetParentID:
      typeof raw.targetParentID === "number" && Number.isFinite(raw.targetParentID)
        ? Math.floor(raw.targetParentID)
        : undefined,
    requestId,
    fetchType,
    state,
    events,
    applyAttempt,
    applyMaxAttempt,
    nextApplyRetryAt,
    lastApplyError,
    error: normalizeString(raw.error) || undefined,
    createdAt,
    updatedAt,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function contextToJobRecord(context: ReconcileContext): JobRecord {
  const resultPayload: Record<string, unknown> = {
    requestId: context.requestId,
  };
  if (!isTerminalState(context.state)) {
    resultPayload.status = "deferred";
    resultPayload.fetchType = context.fetchType;
    resultPayload.backendStatus = context.state;
  } else {
    resultPayload.status = "succeeded";
    resultPayload.fetchType = context.fetchType;
  }
  return {
    id: context.jobId,
    workflowId: context.workflowId,
    request: context.request,
    meta: {
      runId: context.runId,
      workflowLabel: context.workflowLabel,
      taskName: context.taskName,
      inputUnitIdentity: context.inputUnitIdentity,
      inputUnitLabel: context.inputUnitLabel,
      targetParentID: context.targetParentID,
      providerId: context.providerId,
      backendId: context.backendId,
      backendType: context.backendType,
      backendBaseUrl: context.backendBaseUrl,
      requestId: context.requestId,
      index: 0,
    },
    state: context.state,
    error: context.error,
    result: resultPayload,
    createdAt: context.createdAt,
    updatedAt: context.updatedAt,
  };
}

function readPersistedContexts() {
  const raw = normalizeString(getPref(PREF_KEY));
  if (!raw) {
    return [] as ReconcileContext[];
  }
  try {
    const parsed = JSON.parse(raw) as ReconcileDocument | unknown[];
    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.records)
        ? parsed.records
        : [];
    const normalized: ReconcileContext[] = [];
    for (const row of rows) {
      const context = parseContext(row);
      if (!context) {
        continue;
      }
      normalized.push(context);
    }
    return normalized;
  } catch {
    return [] as ReconcileContext[];
  }
}

function writePersistedContexts(records: ReconcileContext[]) {
  setPref(
    PREF_KEY,
    JSON.stringify({
      records,
    }),
  );
}

async function resolveWorkflow(workflowId: string) {
  let workflow = getLoadedWorkflowEntries().find(
    (entry) => entry.manifest.id === workflowId,
  );
  if (workflow) {
    return workflow;
  }
  await rescanWorkflowRegistry();
  workflow = getLoadedWorkflowEntries().find(
    (entry) => entry.manifest.id === workflowId,
  );
  return workflow || null;
}

export async function reconcileSkillRunnerBackendTaskLedgerOnce(args: {
  backend: BackendInstance;
  source: SkillRunnerBackendTaskLedgerReconcileSource;
  emitFailureToast?: boolean;
}): Promise<SkillRunnerBackendTaskLedgerReconcileResult> {
  const backendId = normalizeString(args.backend.id);
  const source = args.source;
  const baseUrl = normalizeString(args.backend.baseUrl);
  const backendType = normalizeString(args.backend.type);
  if (!backendId || backendType !== "skillrunner") {
    return {
      ok: true,
      source,
      backendId,
      stage: "backend-task-ledger-reconcile-skip",
      message: "backend task ledger reconcile skipped",
      checkedRequestIds: [],
      missingRequestIds: [],
      removedActiveCount: 0,
      removedHistoryCount: 0,
    };
  }
  const requestIds = collectRequestIdsForBackend(backendId);
  if (requestIds.length === 0) {
    return {
      ok: true,
      source,
      backendId,
      stage: "backend-task-ledger-reconcile-empty",
      message: "no task ledger entries to reconcile",
      checkedRequestIds: [],
      missingRequestIds: [],
      removedActiveCount: 0,
      removedHistoryCount: 0,
    };
  }
  const missingRequestIds: string[] = [];
  try {
    const client = new SkillRunnerClient({
      baseUrl,
    });
    for (const requestId of requestIds) {
      try {
        await client.getRunState({
          requestId,
        });
      } catch (error) {
        const status = extractHttpStatusFromError(error);
        if (status === 404) {
          missingRequestIds.push(requestId);
          continue;
        }
        throw error;
      }
    }
    const removedActiveCount = removeWorkflowTasksByBackendAndRequestIds({
      backendId,
      requestIds: missingRequestIds,
    });
    const removedHistoryCount = removeTaskDashboardHistoryByBackendAndRequestIds({
      backendId,
      requestIds: missingRequestIds,
    });
    appendRuntimeLog({
      level: "info",
      scope: "provider",
      backendId,
      backendType,
      providerId: "skillrunner",
      component: "skillrunner-reconciler",
      operation: "backend-task-ledger-reconcile",
      phase: source,
      stage: "backend-task-ledger-reconcile-finished",
      message: "backend task ledger reconcile finished",
      details: {
        source,
        checkedRequestIds: requestIds,
        missingRequestIds,
        removedActiveCount,
        removedHistoryCount,
      },
    });
    return {
      ok: true,
      source,
      backendId,
      stage: "backend-task-ledger-reconcile-finished",
      message: "backend task ledger reconcile finished",
      checkedRequestIds: requestIds,
      missingRequestIds,
      removedActiveCount,
      removedHistoryCount,
    };
  } catch (error) {
    const displayName = resolveBackendDisplayName(backendId, args.backend.displayName);
    const toastText = resolveSkillRunnerBackendCommunicationFailedToastText(
      displayName || backendId,
    );
    appendRuntimeLog({
      level: "error",
      scope: "provider",
      backendId,
      backendType,
      providerId: "skillrunner",
      component: "skillrunner-reconciler",
      operation: "backend-task-ledger-reconcile",
      phase: source,
      stage: "backend-task-ledger-reconcile-failed",
      message: "backend task ledger reconcile failed",
      error,
      details: {
        source,
        checkedRequestIds: requestIds,
      },
    });
    if (args.emitFailureToast !== false) {
      try {
        backendReconcileFailureToastEmitter({
          backendId,
          displayName: displayName || backendId,
          source,
          text: toastText,
        });
      } catch {
        // keep toast reporting best-effort
      }
    }
    return {
      ok: false,
      source,
      backendId,
      stage: "backend-task-ledger-reconcile-failed",
      message: normalizeString(
        error && typeof error === "object" && "message" in error
          ? (error as { message?: unknown }).message
          : error,
      ) || "backend task ledger reconcile failed",
      checkedRequestIds: requestIds,
      missingRequestIds: [],
      removedActiveCount: 0,
      removedHistoryCount: 0,
    };
  }
}

export class SkillRunnerTaskReconciler {
  private readonly contexts = new Map<string, ReconcileContext>();

  private readonly reportedViolationKeysByContext = new Map<string, Set<string>>();

  private readonly backendReconcileFailureLogUntilByBackend = new Map<string, number>();

  private timer: ReturnType<typeof setInterval> | undefined;

  private isReconciling = false;

  private logTransitionViolation(context: ReconcileContext, violation?: SkillRunnerStateMachineViolation) {
    appendStateMachineWarning({
      workflowId: context.workflowId,
      jobId: context.jobId,
      requestId: context.requestId,
      violation,
    });
  }

  private trackEvent(context: ReconcileContext, event: SkillRunnerStateEvent) {
    context.events.push(event);
    if (context.events.length > 40) {
      context.events = context.events.slice(-40);
    }
    const violations = validateEventOrder({
      events: context.events,
      requestId: context.requestId,
    });
    if (violations.length === 0) {
      return;
    }
    const reported =
      this.reportedViolationKeysByContext.get(context.id) || new Set<string>();
    for (const violation of violations) {
      const key = `${violation.ruleId}:${violation.eventKind || ""}:${violation.prevState || ""}:${violation.nextState || ""}`;
      if (reported.has(key)) {
        continue;
      }
      reported.add(key);
      this.logTransitionViolation(context, violation);
    }
    this.reportedViolationKeysByContext.set(context.id, reported);
  }

  start() {
    if (this.timer) {
      return;
    }
    const persisted = readPersistedContexts();
    for (const context of persisted) {
      this.contexts.set(context.id, context);
      recordWorkflowTaskUpdate(contextToJobRecord(context));
      recordTaskDashboardHistoryFromJob(contextToJobRecord(context));
    }
    this.timer = setInterval(() => {
      void this.reconcilePending();
    }, POLL_INTERVAL_MS);
    const timerLike = this.timer as unknown as { unref?: () => void };
    if (typeof timerLike.unref === "function") {
      timerLike.unref();
    }
    void this.reconcilePending();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  registerFromJob(args: {
    workflowId: string;
    workflowLabel: string;
    requestKind: string;
    request: unknown;
    backend: BackendInstance;
    providerId: string;
    providerOptions?: Record<string, unknown>;
    job: JobRecord;
  }) {
    if (normalizeString(args.backend.type) !== "skillrunner") {
      return;
    }
    const deferred = (args.job.result || {}) as DeferredResultLike;
    if (normalizeString(deferred.status) !== "deferred") {
      return;
    }
    const requestId =
      normalizeString(deferred.requestId) ||
      normalizeString(args.job.meta.requestId);
    if (!requestId) {
      return;
    }
    const normalized = normalizeStatusWithGuard({
      value: deferred.backendStatus,
      fallback: args.job.state,
      requestId,
    });
    appendStateMachineWarning({
      workflowId: args.workflowId,
      jobId: args.job.id,
      requestId,
      violation: normalized.violation,
    });
    const transition = validateTransition({
      prev: args.job.state,
      next: normalized.status,
      requestId,
    });
    appendStateMachineWarning({
      workflowId: args.workflowId,
      jobId: args.job.id,
      requestId,
      violation: transition.violation,
    });
    const state = transition.ok ? transition.nextState : transition.prevState;
    const contextId = `${args.backend.id}:${requestId}`;
    const context: ReconcileContext = {
      id: contextId,
      workflowId: args.workflowId,
      workflowLabel: args.workflowLabel || args.workflowId,
      requestKind: args.requestKind,
      request: args.request,
      backendId: args.backend.id,
      backendType: args.backend.type,
      backendBaseUrl: args.backend.baseUrl,
      providerId: args.providerId,
      providerOptions: args.providerOptions || {},
      runId: normalizeString(args.job.meta.runId) || `${args.workflowId}:${args.job.createdAt}`,
      jobId: args.job.id,
      taskName: normalizeString(args.job.meta.taskName) || args.job.id,
      inputUnitIdentity: normalizeString(args.job.meta.inputUnitIdentity) || undefined,
      inputUnitLabel: normalizeString(args.job.meta.inputUnitLabel) || undefined,
      targetParentID:
        typeof args.job.meta.targetParentID === "number"
          ? Math.floor(args.job.meta.targetParentID)
          : undefined,
      requestId,
      fetchType: normalizeString(deferred.fetchType) === "result" ? "result" : "bundle",
      state,
      events: [],
      applyAttempt: 0,
      applyMaxAttempt: APPLY_MAX_ATTEMPTS,
      createdAt: args.job.createdAt,
      updatedAt: nowIso(),
    };
    this.trackEvent(context, {
      kind: "request-created",
    });
    this.trackEvent(context, {
      kind: "deferred",
    });
    if (isWaiting(state)) {
      this.trackEvent(context, {
        kind: "waiting",
        status: state,
      });
    }
    this.contexts.set(context.id, context);
    writePersistedContexts(Array.from(this.contexts.values()));
    if (isWaiting(state)) {
      this.showWaitingToast(context, state);
    }
  }

  private showWaitingToast(context: ReconcileContext, state: "waiting_user" | "waiting_auth") {
    skillRunnerTaskLifecycleToastEmitter({
      state,
      text: localizeWorkflowText(
        "workflow-execute-toast-waiting",
        `Workflow ${context.workflowLabel} is waiting for backend input. pending=1`,
        {
          workflowLabel: context.workflowLabel,
          pendingJobs: 1,
        },
      ),
      type: "default",
    });
    appendRuntimeLog({
      level: "info",
      scope: "job",
      workflowId: context.workflowId,
      backendId: context.backendId,
      backendType: context.backendType,
      providerId: context.providerId,
      runId: context.runId,
      jobId: context.jobId,
      requestId: context.requestId,
      component: "skillrunner-reconciler",
      operation: "backend-waiting",
      phase: "waiting",
      stage: "backend-waiting",
      message: `backend entered ${state}`,
    });
  }

  private showTerminalToast(
    context: ReconcileContext,
    state: "succeeded" | "failed" | "canceled",
  ) {
    const taskLabel = normalizeString(context.taskName) || context.requestId;
    if (state === "succeeded") {
      skillRunnerTaskLifecycleToastEmitter({
        state,
        text: localizeWorkflowText(
          "workflow-execute-toast-job-success",
          `Workflow ${context.workflowLabel} job 1/1 succeeded: ${taskLabel}`,
          {
            workflowLabel: context.workflowLabel,
            taskLabel,
            index: 1,
            total: 1,
          },
        ),
        type: "success",
      });
      return;
    }
    if (state === "failed") {
      const reason =
        normalizeString(context.error) ||
        localizeWorkflowText("workflow-execute-unknown-error", "unknown error");
      skillRunnerTaskLifecycleToastEmitter({
        state,
        text: localizeWorkflowText(
          "workflow-execute-toast-job-failed",
          `Workflow ${context.workflowLabel} job 1/1 failed: ${taskLabel} (${reason})`,
          {
            workflowLabel: context.workflowLabel,
            taskLabel,
            index: 1,
            total: 1,
            reason,
          },
        ),
        type: "error",
      });
      return;
    }
    skillRunnerTaskLifecycleToastEmitter({
      state,
      text: localizeWorkflowText(
        "workflow-execute-toast-job-canceled",
        `Workflow ${context.workflowLabel} job 1/1 canceled: ${taskLabel}`,
        {
          workflowLabel: context.workflowLabel,
          taskLabel,
          index: 1,
          total: 1,
        },
      ),
      type: "default",
    });
  }

  private async applyTerminalSuccessContext(
    context: ReconcileContext,
    client: SkillRunnerClient,
  ) {
    const workflow = await resolveWorkflow(context.workflowId);
    if (!workflow) {
      throw new Error(`workflow not found for apply: ${context.workflowId}`);
    }
    const targetParentID =
      context.targetParentID || resolveTargetParentIDFromRequest(context.request);
    if (!targetParentID) {
      throw new Error("cannot resolve target parent for deferred apply");
    }
    let bundlePath = "";
    try {
      const runResult: Record<string, unknown> = {
        status: "succeeded",
        requestId: context.requestId,
        fetchType: context.fetchType,
      };
      let bundleReader = createUnavailableBundleReader(context.requestId);
      if (context.fetchType === "bundle") {
        const bundleBytes = await client.fetchRunBundle({
          requestId: context.requestId,
        });
        runResult.bundleBytes = bundleBytes;
        bundlePath = buildTempBundlePath(context.requestId);
        await writeBytes(bundlePath, bundleBytes);
        bundleReader = new ZipBundleReader(bundlePath);
      } else {
        runResult.resultJson = await client.fetchRunResult({
          requestId: context.requestId,
        });
      }
      await executeApplyResult({
        workflow,
        parent: targetParentID,
        bundleReader,
        request: context.request,
        runResult,
      });
      appendRuntimeLog({
        level: "info",
        scope: "job",
        workflowId: context.workflowId,
        backendId: context.backendId,
        backendType: context.backendType,
        providerId: context.providerId,
        runId: context.runId,
        jobId: context.jobId,
        requestId: context.requestId,
        component: "skillrunner-reconciler",
        operation: "deferred-apply-succeeded",
        phase: "terminal",
        stage: "deferred-apply-succeeded",
        message: "deferred applyResult succeeded",
      });
    } finally {
      if (bundlePath) {
        await removeFileIfExists(bundlePath);
      }
    }
  }

  private async reconcileOneContext(context: ReconcileContext) {
    const client = new SkillRunnerClient({
      baseUrl: context.backendBaseUrl,
    });
    const previousState = context.state;
    const backendFailureKey = normalizeString(context.backendId) || "__unknown_backend__";
    let reconcileFailed = false;
    try {
      const runState = await client.getRunState({
        requestId: context.requestId,
      });
      const normalized = normalizeStatusWithGuard({
        value: runState.status,
        fallback: context.state,
        requestId: context.requestId,
      });
      this.logTransitionViolation(context, normalized.violation);
      const transition = validateTransition({
        prev: previousState,
        next: normalized.status,
        requestId: context.requestId,
      });
      this.logTransitionViolation(context, transition.violation);
      const nextState = transition.ok ? transition.nextState : transition.prevState;
      const nextError = normalizeString(runState.error) || undefined;
      const changed = nextState !== previousState || nextError !== context.error;
      context.state = nextState;
      context.error = nextError;
      context.updatedAt = nowIso();
      if (changed) {
        recordWorkflowTaskUpdate(contextToJobRecord(context));
        recordTaskDashboardHistoryFromJob(contextToJobRecord(context));
        if (isWaiting(nextState) && nextState !== previousState) {
          this.trackEvent(context, {
            kind: "waiting",
            status: nextState,
          });
          this.showWaitingToast(context, nextState);
        } else if (isWaiting(previousState) && !isWaiting(nextState)) {
          this.trackEvent(context, {
            kind: "waiting-resumed",
            status: nextState,
          });
        }
        writePersistedContexts(Array.from(this.contexts.values()));
      }
      if (!isTerminalState(nextState)) {
        return;
      }
      this.trackEvent(context, {
        kind: "terminal",
        status: nextState,
      });
      if (nextState === "succeeded") {
        if (context.nextApplyRetryAt) {
          const retryTs = Date.parse(context.nextApplyRetryAt);
          if (Number.isFinite(retryTs) && retryTs > Date.now()) {
            writePersistedContexts(Array.from(this.contexts.values()));
            return;
          }
        }
        try {
          await this.applyTerminalSuccessContext(context, client);
          context.applyAttempt = 0;
          context.nextApplyRetryAt = undefined;
          context.lastApplyError = undefined;
          this.trackEvent(context, {
            kind: "apply-succeeded",
            status: nextState,
          });
          this.showTerminalToast(context, "succeeded");
        } catch (error) {
          context.applyAttempt += 1;
          context.lastApplyError = normalizeString(
            error && typeof error === "object" && "message" in error
              ? (error as { message?: unknown }).message
              : error,
          );
          context.updatedAt = nowIso();
          const delayMs = computeApplyRetryDelayMs(context.applyAttempt);
          context.nextApplyRetryAt = new Date(Date.now() + delayMs).toISOString();
          appendRuntimeLog({
            level: "error",
            scope: "job",
            workflowId: context.workflowId,
            backendId: context.backendId,
            backendType: context.backendType,
            providerId: context.providerId,
            runId: context.runId,
            jobId: context.jobId,
            requestId: context.requestId,
            component: "skillrunner-reconciler",
            operation: "deferred-apply-failed",
            phase: "retry",
            attempt: context.applyAttempt,
            stage: "deferred-apply-failed",
            message: "deferred applyResult failed",
            error,
            details: {
              attempt: context.applyAttempt,
              maxAttempt: context.applyMaxAttempt,
              nextRetryAt: context.nextApplyRetryAt,
            },
          });
          if (context.applyAttempt >= context.applyMaxAttempt) {
            this.trackEvent(context, {
              kind: "apply-exhausted",
              status: nextState,
            });
            appendRuntimeLog({
              level: "error",
              scope: "job",
              workflowId: context.workflowId,
              backendId: context.backendId,
              backendType: context.backendType,
              providerId: context.providerId,
              runId: context.runId,
              jobId: context.jobId,
              requestId: context.requestId,
              component: "skillrunner-reconciler",
              operation: "deferred-apply-exhausted",
              phase: "terminal",
              attempt: context.applyAttempt,
              stage: "deferred-apply-exhausted",
              message: "deferred apply retries exhausted",
              details: {
                attempt: context.applyAttempt,
                maxAttempt: context.applyMaxAttempt,
              },
            });
            this.contexts.delete(context.id);
            this.reportedViolationKeysByContext.delete(context.id);
            writePersistedContexts(Array.from(this.contexts.values()));
            return;
          }
          writePersistedContexts(Array.from(this.contexts.values()));
          return;
        }
      } else if (nextState === "failed" || nextState === "canceled") {
        this.showTerminalToast(context, nextState);
      }
      this.contexts.delete(context.id);
      this.reportedViolationKeysByContext.delete(context.id);
      writePersistedContexts(Array.from(this.contexts.values()));
    } catch (error) {
      reconcileFailed = true;
      const now = Date.now();
      const throttleUntil =
        this.backendReconcileFailureLogUntilByBackend.get(backendFailureKey) || 0;
      if (now < throttleUntil) {
        return;
      }
      this.backendReconcileFailureLogUntilByBackend.set(
        backendFailureKey,
        now + BACKEND_RECONCILE_FAILURE_LOG_THROTTLE_MS,
      );
      appendRuntimeLog({
        level: "warn",
        scope: "job",
        workflowId: context.workflowId,
        backendId: context.backendId,
        backendType: context.backendType,
        providerId: context.providerId,
        runId: context.runId,
        jobId: context.jobId,
        requestId: context.requestId,
        component: "skillrunner-reconciler",
        operation: "backend-reconcile-failed",
        phase: "reconcile",
        stage: "backend-reconcile-failed",
        message: "backend reconcile step failed; will retry",
        error,
      });
    } finally {
      if (!reconcileFailed) {
        this.backendReconcileFailureLogUntilByBackend.delete(backendFailureKey);
      }
    }
  }

  async reconcilePending() {
    if (this.isReconciling || this.contexts.size === 0) {
      return;
    }
    this.isReconciling = true;
    try {
      const entries = Array.from(this.contexts.values());
      for (const context of entries) {
        await this.reconcileOneContext(context);
      }
    } finally {
      this.isReconciling = false;
    }
  }
}

const defaultReconciler = new SkillRunnerTaskReconciler();

export function startSkillRunnerTaskReconciler() {
  defaultReconciler.start();
}

export function stopSkillRunnerTaskReconciler() {
  defaultReconciler.stop();
}

export function registerSkillRunnerDeferredTask(args: {
  workflowId: string;
  workflowLabel: string;
  requestKind: string;
  request: unknown;
  backend: BackendInstance;
  providerId: string;
  providerOptions?: Record<string, unknown>;
  job: JobRecord;
}) {
  defaultReconciler.registerFromJob(args);
}
