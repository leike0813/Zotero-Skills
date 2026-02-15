import { assert } from "chai";
import type { JobRecord, JobState } from "../../src/jobQueue/manager";
import {
  clearFinishedWorkflowTasks,
  listActiveWorkflowTasks,
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
  inputUnitIdentity?: string;
  inputUnitLabel?: string;
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
      inputUnitIdentity: args.inputUnitIdentity || "",
      inputUnitLabel: args.inputUnitLabel || "",
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

  it("lists active tasks with input identity metadata", function () {
    recordWorkflowTaskUpdate(
      makeJob({
        id: "job-1",
        state: "queued",
        createdAt: "2026-02-10T01:00:00.000Z",
        updatedAt: "2026-02-10T01:00:00.000Z",
        runId: "run-a",
        taskName: "paper-a.pdf",
        inputUnitIdentity: "attachment-key:ABC123",
        inputUnitLabel: "paper-a.pdf",
      }),
    );
    recordWorkflowTaskUpdate(
      makeJob({
        id: "job-2",
        state: "running",
        createdAt: "2026-02-10T01:01:00.000Z",
        updatedAt: "2026-02-10T01:01:01.000Z",
        runId: "run-a",
        taskName: "paper-b.pdf",
        inputUnitIdentity: "attachment-key:DEF456",
        inputUnitLabel: "paper-b.pdf",
      }),
    );
    recordWorkflowTaskUpdate(
      makeJob({
        id: "job-3",
        state: "succeeded",
        createdAt: "2026-02-10T01:02:00.000Z",
        updatedAt: "2026-02-10T01:02:02.000Z",
        runId: "run-a",
        taskName: "paper-c.pdf",
        inputUnitIdentity: "attachment-key:GHI789",
      }),
    );

    const active = listActiveWorkflowTasks();
    assert.lengthOf(active, 2);
    assert.sameMembers(
      active.map((entry) => entry.inputUnitIdentity),
      ["attachment-key:ABC123", "attachment-key:DEF456"],
    );
    assert.sameMembers(
      active.map((entry) => entry.inputUnitLabel),
      ["paper-a.pdf", "paper-b.pdf"],
    );
  });
});
