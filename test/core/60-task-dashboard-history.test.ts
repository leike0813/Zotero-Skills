import { assert } from "chai";
import { config } from "../../package.json";
import type { JobRecord } from "../../src/jobQueue/manager";
import {
  cleanupTaskDashboardHistory,
  getTaskDashboardHistoryRetentionConfig,
  listTaskDashboardHistory,
  recordTaskDashboardHistoryFromJob,
  resetTaskDashboardHistory,
} from "../../src/modules/taskDashboardHistory";

function makeJob(args: {
  id: string;
  state: JobRecord["state"];
  backendType?: string;
  backendId?: string;
  engine?: string;
  requestId?: string;
  updatedAt: string;
}) {
  const job: JobRecord = {
    id: args.id,
    workflowId: "tag-regulator",
    request: {},
    meta: {
      runId: "run-1",
      workflowLabel: "Tag Regulator",
      taskName: "paper-a",
      providerId: args.backendType || "skillrunner",
      backendId: args.backendId || "skillrunner-local",
      backendType: args.backendType || "skillrunner",
      backendBaseUrl: "http://127.0.0.1:8030",
      engine: args.engine || "",
    },
    state: args.state,
    createdAt: "2026-03-08T00:00:00.000Z",
    updatedAt: args.updatedAt,
    result: args.requestId ? { requestId: args.requestId } : undefined,
  };
  return job;
}

describe("task dashboard history", function () {
  const prefKey = `${config.prefsPrefix}.taskDashboardHistoryJson`;
  let previousPref: unknown;

  beforeEach(function () {
    previousPref = Zotero.Prefs.get(prefKey, true);
    resetTaskDashboardHistory();
  });

  afterEach(function () {
    if (typeof previousPref === "undefined") {
      Zotero.Prefs.clear(prefKey, true);
    } else {
      Zotero.Prefs.set(prefKey, previousPref, true);
    }
  });

  it("records and updates task history by stable id", function () {
    recordTaskDashboardHistoryFromJob(
      makeJob({
        id: "job-1",
        state: "queued",
        engine: "gemini",
        updatedAt: "2026-03-08T00:00:00.000Z",
      }),
    );
    recordTaskDashboardHistoryFromJob(
      makeJob({
        id: "job-1",
        state: "succeeded",
        engine: "gemini",
        requestId: "req-1",
        updatedAt: "2026-03-08T00:00:02.000Z",
      }),
    );

    const history = listTaskDashboardHistory();
    assert.lengthOf(history, 1);
    assert.equal(history[0].id, "run-1:job-1");
    assert.equal(history[0].state, "succeeded");
    assert.equal(history[0].requestId, "req-1");
    assert.equal(history[0].backendId, "skillrunner-local");
    assert.equal(history[0].engine, "gemini");
  });

  it("accepts waiting_user state in persisted history records", function () {
    recordTaskDashboardHistoryFromJob(
      makeJob({
        id: "job-waiting",
        state: "waiting_user",
        engine: "gemini",
        requestId: "req-waiting",
        updatedAt: "2026-03-08T00:00:05.000Z",
      }),
    );

    const history = listTaskDashboardHistory();
    assert.lengthOf(history, 1);
    assert.equal(history[0].state, "waiting_user");
    assert.equal(history[0].requestId, "req-waiting");
  });

  it("skips pass-through provider records", function () {
    recordTaskDashboardHistoryFromJob(
      makeJob({
        id: "job-1",
        state: "succeeded",
        backendType: "pass-through",
        backendId: "pass-through-local",
        updatedAt: "2026-03-08T00:00:00.000Z",
      }),
    );
    assert.lengthOf(listTaskDashboardHistory(), 0);
  });

  it("drops expired entries older than 30 days", function () {
    const retentionMs = getTaskDashboardHistoryRetentionConfig().retentionMs;
    const oldDate = new Date(Date.now() - retentionMs - 24 * 60 * 60 * 1000).toISOString();
    Zotero.Prefs.set(
      prefKey,
      JSON.stringify({
        records: [
          {
            id: "run-old:job-1",
            runId: "run-old",
            jobId: "job-1",
            workflowId: "tag-regulator",
            workflowLabel: "Tag Regulator",
            taskName: "old-task",
            state: "failed",
            createdAt: oldDate,
            updatedAt: oldDate,
            archivedAt: oldDate,
          },
        ],
      }),
      true,
    );

    const cleaned = cleanupTaskDashboardHistory();
    assert.equal(cleaned.before, 1);
    assert.equal(cleaned.after, 0);
    assert.lengthOf(listTaskDashboardHistory(), 0);
  });
});
