import { assert } from "chai";
import {
  registerDeferredWorkflowCompletion,
  resetDeferredWorkflowCompletionTrackerForTests,
  settleDeferredWorkflowCompletion,
  setDeferredWorkflowCompletionTrackerDepsForTests,
} from "../../src/modules/workflowExecution/deferredCompletionTracker";

function createFormatter() {
  return {
    summary: ({ workflowLabel, succeeded, failed, skipped }: any) =>
      `Workflow ${workflowLabel} finished. succeeded=${succeeded}, failed=${failed}, skipped=${skipped}`,
    failureReasonsTitle: "Failure reasons:",
    overflow: (count: number) => `...and ${count} more`,
    unknownError: "unknown error",
    startToast: () => "",
    waitingToast: () => "",
    jobToastSuccess: ({ taskLabel, index, total }: any) =>
      `job ${index}/${total} succeeded: ${taskLabel}`,
    jobToastFailed: ({ taskLabel, index, total, reason }: any) =>
      `job ${index}/${total} failed: ${taskLabel} (${reason})`,
    jobToastCanceled: ({ taskLabel, index, total }: any) =>
      `job ${index}/${total} canceled: ${taskLabel}`,
  };
}

describe("deferred workflow completion tracker", function () {
  beforeEach(function () {
    resetDeferredWorkflowCompletionTrackerForTests();
    setDeferredWorkflowCompletionTrackerDepsForTests({
      emitWorkflowJobToasts: () => undefined,
      emitWorkflowFinishSummary: () => undefined,
      appendRuntimeLog: () => undefined,
    });
  });

  afterEach(function () {
    resetDeferredWorkflowCompletionTrackerForTests();
    setDeferredWorkflowCompletionTrackerDepsForTests();
  });

  it("emits deferred job toasts and final summary exactly once when tracked run completes", function () {
    const deferredJobToasts: any[] = [];
    const summaries: string[] = [];
    const runtimeStages: string[] = [];
    setDeferredWorkflowCompletionTrackerDepsForTests({
      emitWorkflowJobToasts: (payload) => {
        deferredJobToasts.push(payload);
      },
      emitWorkflowFinishSummary: (payload) => {
        summaries.push(
          `succeeded=${payload.succeeded};failed=${payload.failed};skipped=${payload.skipped};reasons=${payload.failureReasons.length}`,
        );
      },
      appendRuntimeLog: (entry) => {
        runtimeStages.push(String(entry.stage || ""));
      },
    });

    const registered = registerDeferredWorkflowCompletion({
      runId: "run-auto-1",
      win: {} as _ZoteroTypes.MainWindow,
      workflowId: "literature-digest",
      workflowLabel: "Literature Digest",
      totalJobs: 2,
      skipped: 0,
      succeeded: 0,
      failed: 0,
      failureReasons: [],
      pendingJobs: [
        {
          index: 0,
          taskLabel: "paper-a.md",
          succeeded: true,
          terminalState: "succeeded",
          jobId: "job-1",
          requestId: "req-1",
        },
        {
          index: 1,
          taskLabel: "paper-b.md",
          succeeded: true,
          terminalState: "succeeded",
          jobId: "job-2",
          requestId: "req-2",
        },
      ],
      messageFormatter: createFormatter() as any,
    });

    assert.isTrue(registered);

    const first = settleDeferredWorkflowCompletion({
      runId: "run-auto-1",
      requestId: "req-1",
      succeeded: true,
      terminalState: "succeeded",
    });
    assert.deepEqual(first, {
      handled: true,
      completed: false,
    });
    assert.lengthOf(deferredJobToasts, 0);
    assert.lengthOf(summaries, 0);

    const second = settleDeferredWorkflowCompletion({
      runId: "run-auto-1",
      requestId: "req-2",
      succeeded: false,
      terminalState: "failed",
      reason: "apply failed",
    });
    assert.deepEqual(second, {
      handled: true,
      completed: true,
    });
    assert.lengthOf(deferredJobToasts, 1);
    assert.lengthOf(deferredJobToasts[0].outcomes, 2);
    assert.equal(deferredJobToasts[0].outcomes[0].requestId, "req-1");
    assert.equal(deferredJobToasts[0].outcomes[1].requestId, "req-2");
    assert.lengthOf(summaries, 1);
    assert.include(summaries[0], "succeeded=1");
    assert.include(summaries[0], "failed=1");
    assert.include(runtimeStages, "deferred-run-summary-emitted");

    const after = settleDeferredWorkflowCompletion({
      runId: "run-auto-1",
      requestId: "req-2",
      succeeded: true,
      terminalState: "succeeded",
    });
    assert.deepEqual(after, {
      handled: false,
      completed: false,
    });
    assert.lengthOf(deferredJobToasts, 1);
    assert.lengthOf(summaries, 1);
  });
});
