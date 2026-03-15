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
import {
  emitWorkflowFinishSummary,
  emitWorkflowJobToasts,
  emitWorkflowStartToast,
} from "./workflowExecution/feedbackSeam";
import { createLocalizedMessageFormatter } from "./workflowExecution/messageFormatter";
import { shouldShowWorkflowNotifications } from "./workflowExecution/feedbackPolicy";

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
  let executionOptionsOverride = args.executionOptionsOverride;
  if (args.requireSettingsGate === true && !executionOptionsOverride) {
    const loadedBackends = await loadBackendsRegistry();
    const candidateBackends = loadedBackends.fatalError
      ? []
      : loadedBackends.backends;
    const configurable = await isWorkflowConfigurable({
      workflow: args.workflow,
      candidateBackends,
    });
    if (configurable) {
      const dialogResult = await openWorkflowSettingsWebDialog({
        workflow: args.workflow,
        ownerWindow: args.win,
        candidateBackends,
      });
      if (dialogResult.status !== "confirmed") {
        appendRuntimeLog({
          level: "info",
          scope: "workflow-trigger",
          workflowId: args.workflow.manifest.id,
          stage: "settings-gate-canceled",
          message: "workflow trigger canceled by settings gate",
        });
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
    stage: "trigger-finished",
    message: "workflow trigger finished",
    details: {
      succeeded: applySummary.succeeded,
      failed: applySummary.failed,
      pending: applySummary.pending,
      skipped: totalSkipped,
      failureCount: applySummary.failureReasons.length,
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
