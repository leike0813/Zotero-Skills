import { assert } from "chai";
import { runWorkflowApplySeam } from "../../src/modules/workflowExecution/applySeam";

function createMessageFormatter() {
  return {
    summary: () => "",
    failureReasonsTitle: "Failure reasons:",
    overflow: (count: number) => `...and ${count} more`,
    unknownError: "unknown error",
    startToast: () => "",
    jobToastSuccess: () => "",
    jobToastFailed: () => "",
  };
}

function createRunState(args: {
  requests: unknown[];
  jobIds: string[];
  jobsById: Record<string, unknown>;
}) {
  const queue = {
    getJob: (jobId: string) => {
      const job = args.jobsById[jobId];
      return job ? { ...(job as Record<string, unknown>) } : null;
    },
  };

  return {
    workflow: {
      manifest: {
        id: "hr-02-apply-seam",
        label: "HR-02 Apply Seam",
      },
    },
    requests: args.requests,
    queue,
    jobIds: args.jobIds,
    runId: "run-hr-02",
    totalJobs: args.jobIds.length,
    idlePromise: Promise.resolve(),
  } as any;
}

describe("workflow apply seam risk regression", function () {
  it("Risk: HR-02 marks missing queue record as failed with job-missing diagnostic", async function () {
    const runtimeStages: string[] = [];

    const summary = await runWorkflowApplySeam(
      {
        runState: createRunState({
          requests: [{ taskName: "missing-record.md", targetParentID: 1 }],
          jobIds: ["job-1"],
          jobsById: {},
        }),
        messageFormatter: createMessageFormatter(),
      },
      {
        appendRuntimeLog: (entry) => {
          runtimeStages.push(entry.stage);
        },
      },
    );

    assert.equal(summary.succeeded, 0);
    assert.equal(summary.failed, 1);
    assert.include(summary.failureReasons[0], "record missing");
    assert.equal(summary.jobOutcomes[0].reason, "record missing");
    assert.include(runtimeStages, "job-missing");
  });

  it("Risk: HR-02 marks unresolved target parent as failed before apply", async function () {
    const runtimeStages: string[] = [];
    let applyCalls = 0;

    const summary = await runWorkflowApplySeam(
      {
        runState: createRunState({
          requests: [{ taskName: "parent-unresolved.md" }],
          jobIds: ["job-2"],
          jobsById: {
            "job-2": {
              id: "job-2",
              state: "succeeded",
              meta: {},
              result: { requestId: "req-2" },
            },
          },
        }),
        messageFormatter: createMessageFormatter(),
      },
      {
        appendRuntimeLog: (entry) => {
          runtimeStages.push(entry.stage);
        },
        executeApplyResult: async () => {
          applyCalls += 1;
          return { ok: true };
        },
      },
    );

    assert.equal(summary.succeeded, 0);
    assert.equal(summary.failed, 1);
    assert.include(summary.failureReasons[0], "cannot resolve target parent");
    assert.equal(summary.jobOutcomes[0].reason, "cannot resolve target parent");
    assert.equal(applyCalls, 0);
    assert.include(runtimeStages, "apply-parent-missing");
  });

  it("Risk: HR-02 marks provider result without requestId as failed", async function () {
    const runtimeStages: string[] = [];
    let applyCalls = 0;

    const summary = await runWorkflowApplySeam(
      {
        runState: createRunState({
          requests: [{ taskName: "missing-request-id.md", targetParentID: 9 }],
          jobIds: ["job-3"],
          jobsById: {
            "job-3": {
              id: "job-3",
              state: "succeeded",
              meta: {
                targetParentID: 9,
              },
              result: {},
            },
          },
        }),
        messageFormatter: createMessageFormatter(),
      },
      {
        appendRuntimeLog: (entry) => {
          runtimeStages.push(entry.stage);
        },
        executeApplyResult: async () => {
          applyCalls += 1;
          return { ok: true };
        },
      },
    );

    assert.equal(summary.succeeded, 0);
    assert.equal(summary.failed, 1);
    assert.include(
      summary.failureReasons[0],
      "missing requestId in execution result",
    );
    assert.equal(
      summary.jobOutcomes[0].reason,
      "missing requestId in execution result",
    );
    assert.equal(applyCalls, 0);
    assert.include(runtimeStages, "provider-result-missing-request-id");
  });
});
