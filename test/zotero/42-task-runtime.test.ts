import { assert } from "chai";
import type { JobRecord, JobState } from "../../src/jobQueue/manager";
import {
  clearFinishedWorkflowTasks,
  listWorkflowTasks,
  recordWorkflowTaskUpdate,
  resetWorkflowTasks,
} from "../../src/modules/taskRuntime";

function makeJob(args: {
  id: string;
  state: JobState;
  createdAt: string;
  updatedAt: string;
  runId?: string;
  workflowLabel?: string;
  taskName?: string;
  error?: string;
}) {
  const job: JobRecord = {
    id: args.id,
    workflowId: "literature-digest",
    request: {},
    meta: {
      runId: args.runId || "run-1",
      workflowLabel: args.workflowLabel || "Literature Digest",
      taskName: args.taskName || "paper.md",
    },
    state: args.state,
    createdAt: args.createdAt,
    updatedAt: args.updatedAt,
  };
  if (args.error) {
    job.error = args.error;
  }
  return job;
}

describe("task runtime", function () {
  beforeEach(function () {
    resetWorkflowTasks();
  });

  afterEach(function () {
    resetWorkflowTasks();
  });

  it("updates task state using runId + jobId as stable key", function () {
    recordWorkflowTaskUpdate(
      makeJob({
        id: "job-1",
        state: "queued",
        createdAt: "2026-02-10T01:00:00.000Z",
        updatedAt: "2026-02-10T01:00:00.000Z",
        runId: "run-a",
        taskName: "attachment-a.md",
      }),
    );
    recordWorkflowTaskUpdate(
      makeJob({
        id: "job-1",
        state: "running",
        createdAt: "2026-02-10T01:00:00.000Z",
        updatedAt: "2026-02-10T01:00:01.000Z",
        runId: "run-a",
        taskName: "attachment-a.md",
      }),
    );
    recordWorkflowTaskUpdate(
      makeJob({
        id: "job-1",
        state: "succeeded",
        createdAt: "2026-02-10T01:00:00.000Z",
        updatedAt: "2026-02-10T01:00:02.000Z",
        runId: "run-a",
        taskName: "attachment-a.md",
      }),
    );

    const tasks = listWorkflowTasks();
    assert.lengthOf(tasks, 1);
    assert.equal(tasks[0].id, "run-a:job-1");
    assert.equal(tasks[0].taskName, "attachment-a.md");
    assert.equal(tasks[0].workflowLabel, "Literature Digest");
    assert.equal(tasks[0].state, "succeeded");
  });

  it("clears finished tasks and keeps active tasks", function () {
    recordWorkflowTaskUpdate(
      makeJob({
        id: "job-1",
        state: "running",
        createdAt: "2026-02-10T01:00:00.000Z",
        updatedAt: "2026-02-10T01:00:01.000Z",
        runId: "run-a",
        taskName: "running.md",
      }),
    );
    recordWorkflowTaskUpdate(
      makeJob({
        id: "job-2",
        state: "failed",
        createdAt: "2026-02-10T01:00:00.000Z",
        updatedAt: "2026-02-10T01:00:02.000Z",
        runId: "run-a",
        taskName: "failed.md",
        error: "failed",
      }),
    );
    recordWorkflowTaskUpdate(
      makeJob({
        id: "job-3",
        state: "succeeded",
        createdAt: "2026-02-10T01:00:00.000Z",
        updatedAt: "2026-02-10T01:00:03.000Z",
        runId: "run-a",
        taskName: "succeeded.md",
      }),
    );

    clearFinishedWorkflowTasks();
    const tasks = listWorkflowTasks();
    assert.lengthOf(tasks, 1);
    assert.equal(tasks[0].id, "run-a:job-1");
    assert.equal(tasks[0].state, "running");
  });
});
