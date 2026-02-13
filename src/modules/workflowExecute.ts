import type { LoadedWorkflow } from "../workflows/types";
import { appendRuntimeLog } from "./runtimeLogManager";
import { runWorkflowPreparationSeam } from "./workflowExecution/preparationSeam";
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

  const runState = runWorkflowExecutionSeam({
    prepared: preparation.prepared,
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
      skipped: preparation.prepared.skippedByFilter,
      failureCount: applySummary.failureReasons.length,
    },
  });

  emitWorkflowFinishSummary({
    win: args.win,
    workflowLabel: args.workflow.manifest.label,
    succeeded: applySummary.succeeded,
    failed: applySummary.failed,
    skipped: preparation.prepared.skippedByFilter,
    failureReasons: applySummary.failureReasons,
    messageFormatter,
  });
}
