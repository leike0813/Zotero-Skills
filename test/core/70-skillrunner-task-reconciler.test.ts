import { assert } from "chai";
import { handlers } from "../../src/handlers";
import type { JobRecord } from "../../src/jobQueue/manager";
import {
  reconcileSkillRunnerBackendTaskLedgerOnce,
  setSkillRunnerBackendReconcileFailureToastEmitterForTests,
  mapSkillRunnerBackendStatusToJobState,
  SkillRunnerTaskReconciler,
} from "../../src/modules/skillRunnerTaskReconciler";
import {
  resetWorkflowTasks,
  listWorkflowTasks,
  recordWorkflowTaskUpdate,
} from "../../src/modules/taskRuntime";
import {
  listTaskDashboardHistory,
  recordTaskDashboardHistoryFromJob,
} from "../../src/modules/taskDashboardHistory";
import { getPref, setPref } from "../../src/utils/prefs";

function createJsonResponse(payload: unknown, status = 200): Response {
  const text = JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "ERROR",
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer,
  } as unknown as Response;
}

function makeDeferredJob(args?: {
  id?: string;
  requestId?: string;
  state?: JobRecord["state"];
  fetchType?: "bundle" | "result";
  targetParentID?: number;
}): JobRecord {
  const jobId = args?.id || "job-1";
  const requestId = args?.requestId || "req-1";
  const state = args?.state || "waiting_user";
  const fetchType = args?.fetchType || "bundle";
  const targetParentID = args?.targetParentID ?? 123;
  return {
    id: jobId,
    workflowId: "literature-explainer",
    request: { targetParentID },
    meta: {
      runId: "run-1",
      taskName: "paper.md",
      workflowLabel: "Literature Explainer",
      requestId,
      backendId: "skillrunner-local",
      backendType: "skillrunner",
      backendBaseUrl: "http://127.0.0.1:8030",
      providerId: "skillrunner",
      targetParentID,
    },
    state,
    createdAt: "2026-03-12T00:00:00.000Z",
    updatedAt: "2026-03-12T00:00:01.000Z",
    result: {
      status: "deferred",
      requestId,
      fetchType,
      backendStatus: state,
    },
  };
}

function makeDashboardJob(args: {
  id: string;
  runId: string;
  requestId: string;
  state: JobRecord["state"];
  backendId: string;
  backendBaseUrl: string;
  workflowId?: string;
}) {
  return {
    id: args.id,
    workflowId: args.workflowId || "literature-explainer",
    request: { targetParentID: 123 },
    meta: {
      runId: args.runId,
      taskName: args.id,
      workflowLabel: "Literature Explainer",
      requestId: args.requestId,
      backendId: args.backendId,
      backendType: "skillrunner",
      backendBaseUrl: args.backendBaseUrl,
      providerId: "skillrunner",
      targetParentID: 123,
    },
    state: args.state,
    createdAt: "2026-03-12T00:00:00.000Z",
    updatedAt: "2026-03-12T00:00:01.000Z",
    result: {
      requestId: args.requestId,
    },
  } as JobRecord;
}

function forceApplyRetryDueNow(reconciler: SkillRunnerTaskReconciler) {
  const runtime = reconciler as unknown as {
    contexts?: Map<string, Record<string, unknown>>;
  };
  for (const context of runtime.contexts?.values?.() || []) {
    context.nextApplyRetryAt = "1970-01-01T00:00:00.000Z";
  }
  const raw = String(getPref("skillRunnerDeferredTasksJson") || "");
  const parsed = JSON.parse(raw || "{\"records\":[]}") as {
    records?: Array<Record<string, unknown>>;
  };
  const records = Array.isArray(parsed.records) ? parsed.records : [];
  for (const record of records) {
    record.nextApplyRetryAt = "1970-01-01T00:00:00.000Z";
  }
  setPref(
    "skillRunnerDeferredTasksJson",
    JSON.stringify({
      records,
    }),
  );
}

describe("skillrunner task reconciler", function () {
  const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch;

  beforeEach(function () {
    setPref("skillRunnerDeferredTasksJson", "");
    setPref("taskDashboardHistoryJson", "");
    resetWorkflowTasks();
  });

  afterEach(function () {
    (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
    setPref("skillRunnerDeferredTasksJson", "");
    setPref("taskDashboardHistoryJson", "");
    resetWorkflowTasks();
    setSkillRunnerBackendReconcileFailureToastEmitterForTests();
  });

  it("maps backend status to local job state one-to-one", function () {
    assert.equal(mapSkillRunnerBackendStatusToJobState("queued"), "queued");
    assert.equal(mapSkillRunnerBackendStatusToJobState("running"), "running");
    assert.equal(
      mapSkillRunnerBackendStatusToJobState("waiting_user"),
      "waiting_user",
    );
    assert.equal(
      mapSkillRunnerBackendStatusToJobState("waiting_auth"),
      "waiting_auth",
    );
    assert.equal(mapSkillRunnerBackendStatusToJobState("succeeded"), "succeeded");
    assert.equal(mapSkillRunnerBackendStatusToJobState("failed"), "failed");
    assert.equal(mapSkillRunnerBackendStatusToJobState("canceled"), "canceled");
    assert.equal(
      mapSkillRunnerBackendStatusToJobState("unknown-status", "running"),
      "running",
    );
  });

  it("registers deferred task and clears persisted record after terminal reconcile", async function () {
    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (url.endsWith("/v1/jobs/req-1")) {
        return createJsonResponse({
          request_id: "req-1",
          status: "failed",
          error: "mock terminal failure",
        });
      }
      return createJsonResponse({ error: "unexpected route" }, 404);
    };

    const reconciler = new SkillRunnerTaskReconciler();
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Deferred Apply Retry Success Parent" },
    });
    reconciler.registerFromJob({
      workflowId: "literature-explainer",
      workflowLabel: "Literature Explainer",
      requestKind: "skillrunner.job.v1",
      request: {
        kind: "skillrunner.job.v1",
        targetParentID: parent.id,
      },
      backend: {
        id: "skillrunner-local",
        type: "skillrunner",
        baseUrl: "http://127.0.0.1:8030",
        auth: { kind: "none" },
      },
      providerId: "skillrunner",
      providerOptions: { engine: "gemini" },
      job: makeDeferredJob(),
    });

    const persistedBefore = String(getPref("skillRunnerDeferredTasksJson") || "");
    assert.include(persistedBefore, "req-1");

    await reconciler.reconcilePending();

    const persistedAfter = String(getPref("skillRunnerDeferredTasksJson") || "");
    const parsedAfter = JSON.parse(persistedAfter || "{\"records\":[]}") as {
      records?: unknown[];
    };
    assert.lengthOf(Array.isArray(parsedAfter.records) ? parsedAfter.records : [], 0);
    const tasks = listWorkflowTasks();
    assert.lengthOf(tasks, 1);
    assert.equal(tasks[0].state, "failed");
    assert.equal(tasks[0].requestId, "req-1");
  });

  it("restores pending contexts from prefs on start", async function () {
    const record = {
      id: "skillrunner-local:req-restore-1",
      workflowId: "literature-explainer",
      workflowLabel: "Literature Explainer",
      requestKind: "skillrunner.job.v1",
      request: { kind: "skillrunner.job.v1", targetParentID: 123 },
      backendId: "skillrunner-local",
      backendType: "skillrunner",
      backendBaseUrl: "http://127.0.0.1:8030",
      providerId: "skillrunner",
      providerOptions: { engine: "gemini" },
      runId: "run-restore-1",
      jobId: "job-restore-1",
      taskName: "paper.md",
      targetParentID: 123,
      requestId: "req-restore-1",
      fetchType: "bundle",
      state: "waiting_user",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z",
    };
    setPref(
      "skillRunnerDeferredTasksJson",
      JSON.stringify({
        records: [record],
      }),
    );

    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (url.endsWith("/v1/jobs/req-restore-1")) {
        return createJsonResponse({
          request_id: "req-restore-1",
          status: "waiting_user",
        });
      }
      return createJsonResponse({ error: "unexpected route" }, 404);
    };

    const reconciler = new SkillRunnerTaskReconciler();
    reconciler.start();
    await reconciler.reconcilePending();
    reconciler.stop();

    const tasks = listWorkflowTasks();
    assert.lengthOf(tasks, 1);
    assert.equal(tasks[0].jobId, "job-restore-1");
    assert.equal(tasks[0].state, "waiting_user");
    assert.equal(tasks[0].requestId, "req-restore-1");
  });

  it("degrades persisted unknown state to running on restore", async function () {
    setPref(
      "skillRunnerDeferredTasksJson",
      JSON.stringify({
        records: [
          {
            id: "skillrunner-local:req-restore-unknown",
            workflowId: "literature-explainer",
            workflowLabel: "Literature Explainer",
            requestKind: "skillrunner.job.v1",
            request: { kind: "skillrunner.job.v1", targetParentID: 123 },
            backendId: "skillrunner-local",
            backendType: "skillrunner",
            backendBaseUrl: "http://127.0.0.1:8030",
            providerId: "skillrunner",
            providerOptions: { engine: "gemini" },
            runId: "run-restore-unknown",
            jobId: "job-restore-unknown",
            taskName: "paper.md",
            targetParentID: 123,
            requestId: "req-restore-unknown",
            fetchType: "bundle",
            state: "unknown_status",
            createdAt: "2026-03-12T00:00:00.000Z",
            updatedAt: "2026-03-12T00:00:00.000Z",
          },
        ],
      }),
    );

    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (url.endsWith("/v1/jobs/req-restore-unknown")) {
        return createJsonResponse({
          request_id: "req-restore-unknown",
          status: "running",
        });
      }
      return createJsonResponse({ error: "unexpected route" }, 404);
    };

    const reconciler = new SkillRunnerTaskReconciler();
    reconciler.start();
    await reconciler.reconcilePending();
    reconciler.stop();

    const tasks = listWorkflowTasks();
    assert.lengthOf(tasks, 1);
    assert.equal(tasks[0].state, "running");
    assert.equal(tasks[0].requestId, "req-restore-unknown");
  });

  it("retries deferred apply after transient result fetch failure and then clears context", async function () {
    let resultAttempts = 0;
    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (url.endsWith("/v1/jobs/req-retry-success")) {
        return createJsonResponse({
          request_id: "req-retry-success",
          status: "succeeded",
        });
      }
      if (url.endsWith("/v1/jobs/req-retry-success/result")) {
        resultAttempts += 1;
        if (resultAttempts === 1) {
          return createJsonResponse({ detail: "transient fetch failure" }, 500);
        }
        return createJsonResponse({
          note_path: "",
        });
      }
      return createJsonResponse({ error: "unexpected route" }, 404);
    };

    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Deferred Apply Retry Success Parent" },
    });
    const reconciler = new SkillRunnerTaskReconciler();
    reconciler.registerFromJob({
      workflowId: "literature-explainer",
      workflowLabel: "Literature Explainer",
      requestKind: "skillrunner.job.v1",
      request: {
        kind: "skillrunner.job.v1",
        targetParentID: parent.id,
      },
      backend: {
        id: "skillrunner-local",
        type: "skillrunner",
        baseUrl: "http://127.0.0.1:8030",
        auth: { kind: "none" },
      },
      providerId: "skillrunner",
      providerOptions: { engine: "gemini" },
      job: makeDeferredJob({
        id: "job-retry-success",
        requestId: "req-retry-success",
        fetchType: "result",
        targetParentID: parent.id,
      }),
    });

    await reconciler.reconcilePending();
    let persisted = String(getPref("skillRunnerDeferredTasksJson") || "");
    let parsed = JSON.parse(persisted || "{\"records\":[]}") as {
      records?: Array<{ applyAttempt?: number }>;
    };
    assert.lengthOf(Array.isArray(parsed.records) ? parsed.records : [], 1);
    assert.equal(parsed.records?.[0]?.applyAttempt, 1);

    forceApplyRetryDueNow(reconciler);
    await reconciler.reconcilePending();
    persisted = String(getPref("skillRunnerDeferredTasksJson") || "");
    parsed = JSON.parse(persisted || "{\"records\":[]}") as {
      records?: unknown[];
    };
    assert.lengthOf(Array.isArray(parsed.records) ? parsed.records : [], 0);
    assert.isAtLeast(resultAttempts, 2);
  });

  it("stops apply retries after limit and drops deferred context", async function () {
    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (url.endsWith("/v1/jobs/req-retry-exhausted")) {
        return createJsonResponse({
          request_id: "req-retry-exhausted",
          status: "succeeded",
        });
      }
      if (url.endsWith("/v1/jobs/req-retry-exhausted/result")) {
        return createJsonResponse({ detail: "always fail" }, 500);
      }
      return createJsonResponse({ error: "unexpected route" }, 404);
    };

    const reconciler = new SkillRunnerTaskReconciler();
    reconciler.registerFromJob({
      workflowId: "literature-explainer",
      workflowLabel: "Literature Explainer",
      requestKind: "skillrunner.job.v1",
      request: {
        kind: "skillrunner.job.v1",
        targetParentID: 123,
      },
      backend: {
        id: "skillrunner-local",
        type: "skillrunner",
        baseUrl: "http://127.0.0.1:8030",
        auth: { kind: "none" },
      },
      providerId: "skillrunner",
      providerOptions: { engine: "gemini" },
      job: makeDeferredJob({
        id: "job-retry-exhausted",
        requestId: "req-retry-exhausted",
        fetchType: "result",
      }),
    });

    for (let i = 0; i < 6; i += 1) {
      await reconciler.reconcilePending();
      forceApplyRetryDueNow(reconciler);
    }

    const persisted = String(getPref("skillRunnerDeferredTasksJson") || "");
    const parsed = JSON.parse(persisted || "{\"records\":[]}") as {
      records?: unknown[];
    };
    assert.lengthOf(Array.isArray(parsed.records) ? parsed.records : [], 0);
    const tasks = listWorkflowTasks();
    assert.equal(tasks[0]?.state, "succeeded");
  });

  it("reconciles backend task ledger and removes request ids missing on backend", async function () {
    recordWorkflowTaskUpdate(
      makeDashboardJob({
        id: "active-missing",
        runId: "run-active-missing",
        requestId: "req-missing",
        state: "running",
        backendId: "remote-skillrunner",
        backendBaseUrl: "http://127.0.0.1:8031",
      }),
    );
    recordWorkflowTaskUpdate(
      makeDashboardJob({
        id: "active-live",
        runId: "run-active-live",
        requestId: "req-live",
        state: "running",
        backendId: "remote-skillrunner",
        backendBaseUrl: "http://127.0.0.1:8031",
      }),
    );
    recordTaskDashboardHistoryFromJob(
      makeDashboardJob({
        id: "history-missing",
        runId: "run-history-missing",
        requestId: "req-missing",
        state: "failed",
        backendId: "remote-skillrunner",
        backendBaseUrl: "http://127.0.0.1:8031",
      }),
    );
    recordTaskDashboardHistoryFromJob(
      makeDashboardJob({
        id: "history-live",
        runId: "run-history-live",
        requestId: "req-live",
        state: "succeeded",
        backendId: "remote-skillrunner",
        backendBaseUrl: "http://127.0.0.1:8031",
      }),
    );
    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (url.endsWith("/v1/jobs/req-missing")) {
        return createJsonResponse({ detail: "not found" }, 404);
      }
      if (url.endsWith("/v1/jobs/req-live")) {
        return createJsonResponse({
          request_id: "req-live",
          status: "running",
        });
      }
      return createJsonResponse({ error: "unexpected route" }, 404);
    };

    const result = await reconcileSkillRunnerBackendTaskLedgerOnce({
      backend: {
        id: "remote-skillrunner",
        displayName: "Remote SkillRunner",
        type: "skillrunner",
        baseUrl: "http://127.0.0.1:8031",
        auth: { kind: "none" },
      },
      source: "startup",
    });

    assert.isTrue(result.ok);
    assert.include(result.missingRequestIds, "req-missing");
    assert.notInclude(result.missingRequestIds, "req-live");
    const activeRows = listWorkflowTasks();
    assert.sameMembers(
      activeRows.map((entry) => String(entry.requestId || "")),
      ["req-live"],
    );
    const historyRows = listTaskDashboardHistory({
      backendId: "remote-skillrunner",
    });
    assert.sameMembers(
      historyRows.map((entry) => String(entry.requestId || "")),
      ["req-live"],
    );
  });

  it("reports toast when backend reconcile fails due to communication error", async function () {
    recordTaskDashboardHistoryFromJob(
      makeDashboardJob({
        id: "history-live",
        runId: "run-history-live",
        requestId: "req-live",
        state: "succeeded",
        backendId: "remote-skillrunner",
        backendBaseUrl: "http://127.0.0.1:8031",
      }),
    );
    const toasts: string[] = [];
    setSkillRunnerBackendReconcileFailureToastEmitterForTests((payload) => {
      toasts.push(payload.text);
    });
    (globalThis as { fetch?: typeof fetch }).fetch = async () => {
      throw new Error("network down");
    };

    const result = await reconcileSkillRunnerBackendTaskLedgerOnce({
      backend: {
        id: "remote-skillrunner",
        displayName: "Remote SkillRunner",
        type: "skillrunner",
        baseUrl: "http://127.0.0.1:8031",
        auth: { kind: "none" },
      },
      source: "startup",
      emitFailureToast: true,
    });

    assert.isFalse(result.ok);
    assert.lengthOf(toasts, 1);
    assert.include(toasts[0], "Remote SkillRunner");
  });
});
