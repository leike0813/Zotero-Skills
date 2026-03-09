import { assert } from "chai";
import { JobQueueManager } from "../../src/jobQueue/manager";

describe("job queue progress", function () {
  it("writes requestId into running job meta through progress callback", async function () {
    const updates: Array<{
      state: string;
      requestId?: string;
    }> = [];
    const queue = new JobQueueManager({
      concurrency: 1,
      executeJob: async (job, runtime) => {
        runtime.reportProgress({
          type: "request-created",
          requestId: "req-progress-job-1",
        });
        return {
          status: "succeeded",
          requestId: "req-progress-job-1",
          fetchType: "result",
          resultJson: {
            ok: true,
          },
        };
      },
      onJobProgress: (job, event) => {
        if (event.type === "request-created") {
          const requestId = String(event.requestId || "").trim();
          if (requestId) {
            job.meta.requestId = requestId;
          }
        }
      },
      onJobUpdated: (job) => {
        updates.push({
          state: job.state,
          requestId: String(job.meta.requestId || "").trim() || undefined,
        });
      },
    });

    const jobId = queue.enqueue({
      workflowId: "test-workflow",
      request: { ok: true },
      meta: {
        runId: "run-1",
      },
    });
    await queue.waitForIdle();

    const job = queue.getJob(jobId);
    assert.isOk(job);
    assert.equal(job!.state, "succeeded");
    assert.equal(String(job!.meta.requestId || ""), "req-progress-job-1");
    assert.deepEqual(updates.map((entry) => entry.state), [
      "queued",
      "running",
      "running",
      "succeeded",
    ]);
    assert.equal(updates[2].requestId, "req-progress-job-1");
  });
});

