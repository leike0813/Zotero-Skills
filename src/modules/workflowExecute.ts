import type { LoadedWorkflow } from "../workflows/types";
import { appendRuntimeLog } from "./runtimeLogManager";
import { runWorkflowPreparationSeam } from "./workflowExecution/preparationSeam";
import { runWorkflowDuplicateGuardSeam } from "./workflowExecution/duplicateGuardSeam";
import { runWorkflowExecutionSeam } from "./workflowExecution/runSeam";
import { runWorkflowApplySeam } from "./workflowExecution/applySeam";
import {
  emitWorkflowFinishSummary,
  emitWorkflowJobToasts,
  emitWorkflowStartToast,
} from "./workflowExecution/feedbackSeam";
import { createLocalizedMessageFormatter } from "./workflowExecution/messageFormatter";

export async function executeWorkflowFromCurrentSelection(args: {
  win: _ZoteroTypes.MainWindow;
  workflow: LoadedWorkflow;
}) {
  const messageFormatter = createLocalizedMessageFormatter();
  const preparation = await runWorkflowPreparationSeam({
    win: args.win,
    workflow: args.workflow,
    messageFormatter,
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
    emitWorkflowFinishSummary({
      win: args.win,
      workflowLabel: args.workflow.manifest.label,
      succeeded: 0,
      failed: 0,
      skipped: totalSkipped,
      failureReasons: [],
      messageFormatter,
    });
    return;
  }

  const runState = runWorkflowExecutionSeam({
    prepared: {
      ...preparation.prepared,
      requests: duplicateGuard.allowedRequests,
    },
  });
  emitWorkflowStartToast({
    workflowLabel: args.workflow.manifest.label,
    totalJobs: runState.totalJobs,
    messageFormatter,
  });

  await runState.idlePromise;

  const applySummary = await runWorkflowApplySeam({
    runState,
    messageFormatter,
  });

  emitWorkflowJobToasts({
    workflowLabel: args.workflow.manifest.label,
    totalJobs: runState.totalJobs,
    outcomes: applySummary.jobOutcomes,
    messageFormatter,
  });

  appendRuntimeLog({
    level: applySummary.failed > 0 ? "warn" : "info",
    scope: "workflow-trigger",
    workflowId: args.workflow.manifest.id,
    stage: "trigger-finished",
    message: "workflow trigger finished",
    details: {
      succeeded: applySummary.succeeded,
      failed: applySummary.failed,
      skipped: totalSkipped,
      failureCount: applySummary.failureReasons.length,
    },
  });

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
