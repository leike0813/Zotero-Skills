import { appendRuntimeLog } from "../runtimeLogManager";
import {
  emitWorkflowFinishSummary,
  emitWorkflowJobToasts,
} from "./feedbackSeam";
import type { WorkflowJobOutcome } from "./contracts";
import type { WorkflowMessageFormatter } from "../workflowExecuteMessage";

type DeferredTrackedJob = WorkflowJobOutcome & {
  requestId: string;
};

type DeferredWorkflowRun = {
  runId: string;
  win: _ZoteroTypes.MainWindow;
  workflowId: string;
  workflowLabel: string;
  totalJobs: number;
  skipped: number;
  succeeded: number;
  failed: number;
  failureReasons: string[];
  pendingByRequestId: Map<string, DeferredTrackedJob>;
  deferredOutcomes: WorkflowJobOutcome[];
  messageFormatter: WorkflowMessageFormatter;
};

type DeferredWorkflowCompletionDeps = {
  emitWorkflowJobToasts: typeof emitWorkflowJobToasts;
  emitWorkflowFinishSummary: typeof emitWorkflowFinishSummary;
  appendRuntimeLog: typeof appendRuntimeLog;
};

const defaultDeps: DeferredWorkflowCompletionDeps = {
  emitWorkflowJobToasts,
  emitWorkflowFinishSummary,
  appendRuntimeLog,
};

let deps: DeferredWorkflowCompletionDeps = { ...defaultDeps };

const pendingRuns = new Map<string, DeferredWorkflowRun>();

function normalizeString(value: unknown) {
  return String(value || "").trim();
}

function cloneFailureReasons(reasons: string[]) {
  return Array.isArray(reasons) ? [...reasons] : [];
}

export function registerDeferredWorkflowCompletion(args: {
  runId: string;
  win: _ZoteroTypes.MainWindow;
  workflowId: string;
  workflowLabel: string;
  totalJobs: number;
  skipped: number;
  succeeded: number;
  failed: number;
  failureReasons: string[];
  pendingJobs: DeferredTrackedJob[];
  messageFormatter: WorkflowMessageFormatter;
}) {
  const runId = normalizeString(args.runId);
  if (!runId || !Array.isArray(args.pendingJobs) || args.pendingJobs.length === 0) {
    return false;
  }
  const pendingByRequestId = new Map<string, DeferredTrackedJob>();
  for (const job of args.pendingJobs) {
    const requestId = normalizeString(job.requestId);
    if (!requestId) {
      continue;
    }
    pendingByRequestId.set(requestId, {
      ...job,
      requestId,
    });
  }
  if (pendingByRequestId.size === 0) {
    return false;
  }
  pendingRuns.set(runId, {
    runId,
    win: args.win,
    workflowId: normalizeString(args.workflowId),
    workflowLabel: normalizeString(args.workflowLabel),
    totalJobs: Math.max(0, Math.floor(Number(args.totalJobs || 0))),
    skipped: Math.max(0, Math.floor(Number(args.skipped || 0))),
    succeeded: Math.max(0, Math.floor(Number(args.succeeded || 0))),
    failed: Math.max(0, Math.floor(Number(args.failed || 0))),
    failureReasons: cloneFailureReasons(args.failureReasons),
    pendingByRequestId,
    deferredOutcomes: [],
    messageFormatter: args.messageFormatter,
  });
  return true;
}

export function settleDeferredWorkflowCompletion(args: {
  runId: string;
  requestId: string;
  succeeded: boolean;
  terminalState?: "succeeded" | "failed" | "canceled";
  reason?: string;
}) {
  const runId = normalizeString(args.runId);
  const requestId = normalizeString(args.requestId);
  if (!runId || !requestId) {
    return { handled: false, completed: false };
  }
  const tracked = pendingRuns.get(runId);
  if (!tracked) {
    return { handled: false, completed: false };
  }
  const pending = tracked.pendingByRequestId.get(requestId);
  if (!pending) {
    return { handled: false, completed: false };
  }

  tracked.pendingByRequestId.delete(requestId);
  const normalizedReason = normalizeString(args.reason) || undefined;
  const outcome: WorkflowJobOutcome = {
    index: pending.index,
    taskLabel: pending.taskLabel,
    succeeded: args.succeeded,
    terminalState: args.terminalState || (args.succeeded ? "succeeded" : "failed"),
    reason: args.succeeded ? undefined : normalizedReason,
    jobId: pending.jobId,
    requestId,
  };
  tracked.deferredOutcomes.push(outcome);
  if (args.succeeded) {
    tracked.succeeded += 1;
  } else {
    tracked.failed += 1;
    tracked.failureReasons.push(
      `job-${pending.index}${requestId ? ` (request_id=${requestId})` : ""}: ${
        normalizedReason || "unknown error"
      }`,
    );
  }

  if (tracked.pendingByRequestId.size > 0) {
    return { handled: true, completed: false };
  }

  const orderedDeferredOutcomes = [...tracked.deferredOutcomes].sort(
    (left, right) => left.index - right.index,
  );
  deps.emitWorkflowJobToasts({
    workflowLabel: tracked.workflowLabel,
    totalJobs: tracked.totalJobs,
    outcomes: orderedDeferredOutcomes,
    messageFormatter: tracked.messageFormatter,
  });
  deps.emitWorkflowFinishSummary({
    win: tracked.win,
    workflowLabel: tracked.workflowLabel,
    succeeded: tracked.succeeded,
    failed: tracked.failed,
    skipped: tracked.skipped,
    failureReasons: tracked.failureReasons,
    messageFormatter: tracked.messageFormatter,
  });
  deps.appendRuntimeLog({
    level: tracked.failed > 0 ? "warn" : "info",
    scope: "workflow-trigger",
    workflowId: tracked.workflowId,
    stage: "deferred-run-summary-emitted",
    message: "deferred run summary emitted after reconciler convergence",
    details: {
      runId: tracked.runId,
      succeeded: tracked.succeeded,
      failed: tracked.failed,
      skipped: tracked.skipped,
      deferredCount: orderedDeferredOutcomes.length,
    },
  });
  pendingRuns.delete(runId);
  return { handled: true, completed: true };
}

export function resetDeferredWorkflowCompletionTrackerForTests() {
  pendingRuns.clear();
}

export function setDeferredWorkflowCompletionTrackerDepsForTests(
  overrides: Partial<DeferredWorkflowCompletionDeps> = {},
) {
  deps = {
    ...defaultDeps,
    ...overrides,
  };
}
