import type { LoadedWorkflow } from "../workflows/types";
import { appendRuntimeLog } from "./runtimeLogManager";
import { runWorkflowPreparationSeam } from "./workflowExecution/preparationSeam";
import { runWorkflowDuplicateGuardSeam } from "./workflowExecution/duplicateGuardSeam";
import { runWorkflowExecutionSeam } from "./workflowExecution/runSeam";
import { runWorkflowApplySeam } from "./workflowExecution/applySeam";
import type { WorkflowExecutionOptions } from "./workflowSettingsDomain";
import {
  isWorkflowConfigurable,
  updateWorkflowSettings,
} from "./workflowSettings";
import { openWorkflowSettingsWebDialog } from "./workflowSettingsWebDialog";
import { loadBackendsRegistry } from "../backends/registry";
import { isSkillRunnerBackendReconcileFlagged } from "./skillRunnerBackendHealthRegistry";
import {
  alertWindow,
  emitWorkflowFinishSummary,
  emitWorkflowJobToasts,
  emitWorkflowStartToast,
} from "./workflowExecution/feedbackSeam";
import { createLocalizedMessageFormatter } from "./workflowExecution/messageFormatter";
import { shouldShowWorkflowNotifications } from "./workflowExecution/feedbackPolicy";
import { registerDeferredWorkflowCompletion } from "./workflowExecution/deferredCompletionTracker";
import { getLoadedWorkflowSourceById } from "./workflowRuntime";
import { getString } from "../utils/locale";

function buildWorkflowCannotRunMessage(args: {
  workflowLabel: string;
  reason: string;
}) {
  try {
    const localized = String(
      getString("workflow-execute-cannot-run" as any, {
        args: {
          workflowLabel: args.workflowLabel,
          reason: args.reason,
        },
      }),
    ).trim();
    if (localized && !localized.includes("workflow-execute-cannot-run")) {
      return localized;
    }
  } catch {
    // ignore localization failures
  }
  return `Workflow ${args.workflowLabel} cannot run: ${args.reason}`;
}

export async function executeWorkflowFromCurrentSelection(args: {
  win: _ZoteroTypes.MainWindow;
  workflow: LoadedWorkflow;
  requireSettingsGate?: boolean;
  executionOptionsOverride?: WorkflowExecutionOptions;
}) {
  const messageFormatter = createLocalizedMessageFormatter();
  const showWorkflowNotifications = shouldShowWorkflowNotifications(
    args.workflow.manifest,
  );
  const workflowSource = getLoadedWorkflowSourceById(args.workflow.manifest.id);
  let executionOptionsOverride = args.executionOptionsOverride;
  if (args.requireSettingsGate === true && !executionOptionsOverride) {
    const loadedBackends = await loadBackendsRegistry();
    const candidateBackends = loadedBackends.fatalError
      ? []
      : loadedBackends.backends;
    const submitVisibleBackends = candidateBackends.filter((backend) => {
      if (String(backend.type || "").trim() !== "skillrunner") {
        return true;
      }
      return !isSkillRunnerBackendReconcileFlagged(String(backend.id || "").trim());
    });
    const configurable = await isWorkflowConfigurable({
      workflow: args.workflow,
      candidateBackends: submitVisibleBackends,
    });
    if (configurable) {
      const dialogResult = await openWorkflowSettingsWebDialog({
        workflow: args.workflow,
        ownerWindow: args.win,
        candidateBackends: submitVisibleBackends,
      });
      if (dialogResult.status !== "confirmed") {
        const canceled = dialogResult.status === "canceled";
        appendRuntimeLog({
          level: canceled ? "info" : "error",
          scope: "workflow-trigger",
          workflowId: args.workflow.manifest.id,
          providerId: String(args.workflow.manifest.provider || "").trim(),
          stage: canceled ? "settings-gate-canceled" : "settings-gate-failed",
          message: canceled
            ? "workflow trigger canceled by settings gate"
            : "workflow trigger failed before execution at settings gate",
          details: {
            workflowSource,
            ...(canceled
              ? {}
              : {
                  gateStage: dialogResult.stage,
                  reason: dialogResult.reason,
                }),
          },
        });
        if (!canceled) {
          alertWindow(
            args.win,
            buildWorkflowCannotRunMessage({
              workflowLabel: args.workflow.manifest.label,
              reason: `settings gate failed: ${dialogResult.reason}`,
            }),
          );
        }
        return;
      }
      executionOptionsOverride = dialogResult.executionOptions;
      if (dialogResult.persist) {
        updateWorkflowSettings(
          args.workflow.manifest.id,
          dialogResult.executionOptions,
        );
      }
    }
  }
  const preparation = await runWorkflowPreparationSeam({
    win: args.win,
    workflow: args.workflow,
    messageFormatter,
    executionOptionsOverride,
  });
  if (preparation.status !== "ready") {
    return;
  }

  const duplicateGuard = await runWorkflowDuplicateGuardSeam({
    win: args.win,
    workflowId: args.workflow.manifest.id,
    workflowLabel: args.workflow.manifest.label,
    requests: preparation.prepared.requests,
  });
  const skippedByGuard = duplicateGuard.skippedByDuplicate;
  const totalSkipped = preparation.prepared.skippedByFilter + skippedByGuard;

  if (duplicateGuard.allowedRequests.length === 0) {
    appendRuntimeLog({
      level: "warn",
      scope: "workflow-trigger",
      workflowId: args.workflow.manifest.id,
      stage: "trigger-no-requests-after-duplicate-guard",
      message: "workflow trigger halted after duplicate guard",
      details: {
        skippedByFilter: preparation.prepared.skippedByFilter,
        skippedByDuplicate: skippedByGuard,
      },
    });
    if (showWorkflowNotifications) {
      emitWorkflowFinishSummary({
        win: args.win,
        workflowLabel: args.workflow.manifest.label,
        succeeded: 0,
        failed: 0,
        skipped: totalSkipped,
        failureReasons: [],
        messageFormatter,
      });
    }
    return;
  }

  const runState = runWorkflowExecutionSeam({
    prepared: {
      ...preparation.prepared,
      requests: duplicateGuard.allowedRequests,
    },
  });

  if (showWorkflowNotifications) {
    emitWorkflowStartToast({
      workflowLabel: args.workflow.manifest.label,
      totalJobs: runState.totalJobs,
      messageFormatter,
    });
  }

  await runState.idlePromise;

  const applySummary = await runWorkflowApplySeam({
    runState,
    messageFormatter,
  });

  if (applySummary.reconcileOwnedPendingJobs.length > 0) {
    registerDeferredWorkflowCompletion({
      runId: runState.runId,
      win: args.win,
      workflowId: args.workflow.manifest.id,
      workflowLabel: args.workflow.manifest.label,
      totalJobs: runState.totalJobs,
      skipped: totalSkipped,
      succeeded: applySummary.succeeded,
      failed: applySummary.failed,
      failureReasons: applySummary.failureReasons,
      pendingJobs: applySummary.reconcileOwnedPendingJobs,
      messageFormatter,
    });
  }

  if (showWorkflowNotifications) {
    if (applySummary.jobOutcomes.length > 0) {
      emitWorkflowJobToasts({
        workflowLabel: args.workflow.manifest.label,
        totalJobs: runState.totalJobs,
        outcomes: applySummary.jobOutcomes,
        messageFormatter,
      });
    }
  }

  appendRuntimeLog({
    level: applySummary.failed > 0 ? "warn" : "info",
    scope: "workflow-trigger",
    workflowId: args.workflow.manifest.id,
    providerId: String(args.workflow.manifest.provider || "").trim(),
    stage: "trigger-finished",
    message: "workflow trigger finished",
    details: {
      workflowSource,
      succeeded: applySummary.succeeded,
      failed: applySummary.failed,
      pending: applySummary.pending,
      skipped: totalSkipped,
      failureCount: applySummary.failureReasons.length,
      reconcileOwnedPending: applySummary.reconcileOwnedPendingJobs.length,
    },
  });

  if (showWorkflowNotifications) {
    if (applySummary.pending === 0) {
      emitWorkflowFinishSummary({
        win: args.win,
        workflowLabel: args.workflow.manifest.label,
        succeeded: applySummary.succeeded,
        failed: applySummary.failed,
        skipped: totalSkipped,
        failureReasons: applySummary.failureReasons,
        messageFormatter,
      });
    }
  }
}
