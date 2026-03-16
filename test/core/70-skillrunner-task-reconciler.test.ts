import { assert } from "chai";
import { handlers } from "../../src/handlers";
import type { JobRecord } from "../../src/jobQueue/manager";
import {
  reconcileSkillRunnerBackendTaskLedgerOnce,
  setSkillRunnerBackendReconcileFailureToastEmitterForTests,
  setSkillRunnerTaskLifecycleToastEmitterForTests,
  mapSkillRunnerBackendStatusToJobState,
  SkillRunnerTaskReconciler,
} from "../../src/modules/skillRunnerTaskReconciler";
import {
  getSkillRunnerBackendHealthState,
  resetSkillRunnerBackendHealthRegistryForTests,
} from "../../src/modules/skillRunnerBackendHealthRegistry";
import {
  resetWorkflowTasks,
  listWorkflowTasks,
  recordWorkflowTaskUpdate,
} from "../../src/modules/taskRuntime";
import {
  listTaskDashboardHistory,
  recordTaskDashboardHistoryFromJob,
} from "../../src/modules/taskDashboardHistory";
import { clearRuntimeLogs, listRuntimeLogs } from "../../src/modules/runtimeLogManager";
import {
  PLUGIN_TASK_DOMAIN_SKILLRUNNER,
  listPluginTaskContextEntries,
  replacePluginTaskContextEntries,
  resetPluginStateStoreForTests,
  upsertPluginTaskContextEntry,
} from "../../src/modules/pluginStateStore";
import { getPref, setPref } from "../../src/utils/prefs";

const TEST_SKILLRUNNER_BACKEND_ID = "remote-skillrunner";
const TEST_SKILLRUNNER_BASE_URL = "http://127.0.0.1:8031";

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

function isListRunsProbeUrl(url: string) {
  return /\/v1\/system\/ping(?:\?|$)/.test(String(url || ""));
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
      backendId: TEST_SKILLRUNNER_BACKEND_ID,
      backendType: "skillrunner",
      backendBaseUrl: TEST_SKILLRUNNER_BASE_URL,
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
  const persisted = listPluginTaskContextEntries(PLUGIN_TASK_DOMAIN_SKILLRUNNER);
  replacePluginTaskContextEntries(
    PLUGIN_TASK_DOMAIN_SKILLRUNNER,
    persisted.map((entry) => {
      let payload = {} as Record<string, unknown>;
      try {
        payload = JSON.parse(String(entry.payload || "{}")) as Record<string, unknown>;
      } catch {
        payload = {};
      }
      payload.nextApplyRetryAt = "1970-01-01T00:00:00.000Z";
      return {
        contextId: entry.contextId,
        requestId: entry.requestId,
        backendId: entry.backendId,
        state: entry.state,
        updatedAt: new Date().toISOString(),
        payload: JSON.stringify(payload),
      };
    }),
  );
}

describe("skillrunner task reconciler", function () {
  const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch;

  beforeEach(function () {
    setPref("skillRunnerRequestLedgerJson", "");
    setPref("skillRunnerDeferredTasksJson", "");
    setPref("taskDashboardHistoryJson", "");
    setPref(
      "backendsConfigJson",
      JSON.stringify({
        schemaVersion: 2,
        backends: [
          {
            id: TEST_SKILLRUNNER_BACKEND_ID,
            type: "skillrunner",
            baseUrl: TEST_SKILLRUNNER_BASE_URL,
            auth: { kind: "none" },
          },
        ],
      }),
    );
    resetPluginStateStoreForTests();
    resetWorkflowTasks();
    clearRuntimeLogs();
    resetSkillRunnerBackendHealthRegistryForTests();
  });

  afterEach(function () {
    (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
    setPref("skillRunnerRequestLedgerJson", "");
    setPref("skillRunnerDeferredTasksJson", "");
    setPref("taskDashboardHistoryJson", "");
    resetPluginStateStoreForTests();
    resetWorkflowTasks();
    clearRuntimeLogs();
    resetSkillRunnerBackendHealthRegistryForTests();
    setSkillRunnerBackendReconcileFailureToastEmitterForTests();
    setSkillRunnerTaskLifecycleToastEmitterForTests();
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
      if (isListRunsProbeUrl(url)) {
        return createJsonResponse({
          data: [],
        });
      }
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
        id: TEST_SKILLRUNNER_BACKEND_ID,
        type: "skillrunner",
        baseUrl: TEST_SKILLRUNNER_BASE_URL,
        auth: { kind: "none" },
      },
      providerId: "skillrunner",
      providerOptions: { engine: "gemini" },
      job: makeDeferredJob(),
    });

    const persistedBefore = listPluginTaskContextEntries(
      PLUGIN_TASK_DOMAIN_SKILLRUNNER,
    );
    assert.isTrue(
      persistedBefore.some((entry) => entry.requestId === "req-1"),
    );

    await reconciler.reconcilePending();

    const persistedAfter = listPluginTaskContextEntries(
      PLUGIN_TASK_DOMAIN_SKILLRUNNER,
    );
    assert.lengthOf(persistedAfter, 0);
    const tasks = listWorkflowTasks();
    assert.lengthOf(tasks, 1);
    assert.equal(tasks[0].state, "failed");
    assert.equal(tasks[0].requestId, "req-1");
  });

  it("restores pending contexts from sqlite store on start", async function () {
    const record = {
      id: `${TEST_SKILLRUNNER_BACKEND_ID}:req-restore-1`,
      workflowId: "literature-explainer",
      workflowLabel: "Literature Explainer",
      requestKind: "skillrunner.job.v1",
      request: { kind: "skillrunner.job.v1", targetParentID: 123 },
      backendId: TEST_SKILLRUNNER_BACKEND_ID,
      backendType: "skillrunner",
      backendBaseUrl: TEST_SKILLRUNNER_BASE_URL,
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
    upsertPluginTaskContextEntry(PLUGIN_TASK_DOMAIN_SKILLRUNNER, {
      contextId: String(record.id),
      requestId: String(record.requestId),
      backendId: String(record.backendId),
      state: String(record.state),
      updatedAt: String(record.updatedAt),
      payload: JSON.stringify(record),
    });

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
    const unknownRecord = {
      id: `${TEST_SKILLRUNNER_BACKEND_ID}:req-restore-unknown`,
      workflowId: "literature-explainer",
      workflowLabel: "Literature Explainer",
      requestKind: "skillrunner.job.v1",
      request: { kind: "skillrunner.job.v1", targetParentID: 123 },
      backendId: TEST_SKILLRUNNER_BACKEND_ID,
      backendType: "skillrunner",
      backendBaseUrl: TEST_SKILLRUNNER_BASE_URL,
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
    };
    upsertPluginTaskContextEntry(PLUGIN_TASK_DOMAIN_SKILLRUNNER, {
      contextId: String(unknownRecord.id),
      requestId: String(unknownRecord.requestId),
      backendId: String(unknownRecord.backendId),
      state: String(unknownRecord.state),
      updatedAt: String(unknownRecord.updatedAt),
      payload: JSON.stringify(unknownRecord),
    });

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

  it("updates persisted non-terminal context state from observed backend state", async function () {
    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (isListRunsProbeUrl(url)) {
        return createJsonResponse({
          data: [],
        });
      }
      if (url.endsWith("/v1/jobs/req-observed-waiting")) {
        return createJsonResponse({
          request_id: "req-observed-waiting",
          status: "waiting_user",
        });
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
        id: TEST_SKILLRUNNER_BACKEND_ID,
        type: "skillrunner",
        baseUrl: TEST_SKILLRUNNER_BASE_URL,
        auth: { kind: "none" },
      },
      providerId: "skillrunner",
      providerOptions: { engine: "gemini" },
      job: makeDeferredJob({
        id: "job-observed-waiting",
        requestId: "req-observed-waiting",
        state: "running",
        fetchType: "result",
      }),
    });

    await reconciler.reconcilePending();
    const persisted = listPluginTaskContextEntries(PLUGIN_TASK_DOMAIN_SKILLRUNNER);
    const matched = persisted.find(
      (entry) => entry.requestId === "req-observed-waiting",
    );
    assert.isOk(matched);
    const payload = JSON.parse(String(matched?.payload || "{}")) as {
      state?: string;
    };
    assert.equal(payload.state, "waiting_user");
  });

  it("retries deferred apply after transient result fetch failure and then clears context", async function () {
    let resultAttempts = 0;
    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (isListRunsProbeUrl(url)) {
        return createJsonResponse({
          data: [],
        });
      }
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
        id: TEST_SKILLRUNNER_BACKEND_ID,
        type: "skillrunner",
        baseUrl: TEST_SKILLRUNNER_BASE_URL,
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
    let persisted = listPluginTaskContextEntries(PLUGIN_TASK_DOMAIN_SKILLRUNNER);
    assert.lengthOf(persisted, 1);
    let payload = JSON.parse(String(persisted[0]?.payload || "{}")) as {
      applyAttempt?: number;
    };
    assert.equal(payload.applyAttempt, 1);

    forceApplyRetryDueNow(reconciler);
    await reconciler.reconcilePending();
    persisted = listPluginTaskContextEntries(PLUGIN_TASK_DOMAIN_SKILLRUNNER);
    assert.lengthOf(persisted, 0);
    assert.isAtLeast(resultAttempts, 2);
  });

  it("emits succeeded toast when interactive task reaches terminal succeeded and apply completes", async function () {
    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (isListRunsProbeUrl(url)) {
        return createJsonResponse({
          data: [],
        });
      }
      if (url.endsWith("/v1/jobs/req-toast-succeeded")) {
        return createJsonResponse({
          request_id: "req-toast-succeeded",
          status: "succeeded",
        });
      }
      if (url.endsWith("/v1/jobs/req-toast-succeeded/result")) {
        return createJsonResponse({
          note_path: "",
        });
      }
      return createJsonResponse({ error: "unexpected route" }, 404);
    };

    const toasts: Array<{ state: string; text: string; type: string }> = [];
    setSkillRunnerTaskLifecycleToastEmitterForTests((payload) => {
      toasts.push(payload);
    });

    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Toast Succeeded Parent" },
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
        id: TEST_SKILLRUNNER_BACKEND_ID,
        type: "skillrunner",
        baseUrl: TEST_SKILLRUNNER_BASE_URL,
        auth: { kind: "none" },
      },
      providerId: "skillrunner",
      providerOptions: { engine: "gemini" },
      job: makeDeferredJob({
        id: "job-toast-succeeded",
        requestId: "req-toast-succeeded",
        state: "running",
        fetchType: "result",
        targetParentID: parent.id,
      }),
    });

    await reconciler.reconcilePending();
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].state, "succeeded");
    assert.equal(toasts[0].type, "success");
    assert.include(toasts[0].text, "Literature Explainer");
    assert.include(toasts[0].text, "paper.md");
  });

  it("emits failed toast when interactive task reaches terminal failed", async function () {
    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (isListRunsProbeUrl(url)) {
        return createJsonResponse({
          data: [],
        });
      }
      if (url.endsWith("/v1/jobs/req-toast-failed")) {
        return createJsonResponse({
          request_id: "req-toast-failed",
          status: "failed",
          error: "backend failed",
        });
      }
      return createJsonResponse({ error: "unexpected route" }, 404);
    };

    const toasts: Array<{ state: string; text: string; type: string }> = [];
    setSkillRunnerTaskLifecycleToastEmitterForTests((payload) => {
      toasts.push(payload);
    });

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
        id: TEST_SKILLRUNNER_BACKEND_ID,
        type: "skillrunner",
        baseUrl: TEST_SKILLRUNNER_BASE_URL,
        auth: { kind: "none" },
      },
      providerId: "skillrunner",
      providerOptions: { engine: "gemini" },
      job: makeDeferredJob({
        id: "job-toast-failed",
        requestId: "req-toast-failed",
        state: "running",
        fetchType: "result",
      }),
    });

    await reconciler.reconcilePending();
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].state, "failed");
    assert.equal(toasts[0].type, "error");
    assert.include(toasts[0].text, "Literature Explainer");
    assert.include(toasts[0].text, "backend failed");
  });

  it("emits canceled toast when interactive task reaches terminal canceled", async function () {
    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (isListRunsProbeUrl(url)) {
        return createJsonResponse({
          data: [],
        });
      }
      if (url.endsWith("/v1/jobs/req-toast-canceled")) {
        return createJsonResponse({
          request_id: "req-toast-canceled",
          status: "canceled",
        });
      }
      return createJsonResponse({ error: "unexpected route" }, 404);
    };

    const toasts: Array<{ state: string; text: string; type: string }> = [];
    setSkillRunnerTaskLifecycleToastEmitterForTests((payload) => {
      toasts.push(payload);
    });

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
        id: TEST_SKILLRUNNER_BACKEND_ID,
        type: "skillrunner",
        baseUrl: TEST_SKILLRUNNER_BASE_URL,
        auth: { kind: "none" },
      },
      providerId: "skillrunner",
      providerOptions: { engine: "gemini" },
      job: makeDeferredJob({
        id: "job-toast-canceled",
        requestId: "req-toast-canceled",
        state: "running",
        fetchType: "result",
      }),
    });

    await reconciler.reconcilePending();
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].state, "canceled");
    assert.equal(toasts[0].type, "default");
    assert.include(toasts[0].text, "Literature Explainer");
    assert.include(toasts[0].text, "paper.md");
  });

  it("stops apply retries after limit and drops deferred context", async function () {
    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (isListRunsProbeUrl(url)) {
        return createJsonResponse({
          data: [],
        });
      }
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
        id: TEST_SKILLRUNNER_BACKEND_ID,
        type: "skillrunner",
        baseUrl: TEST_SKILLRUNNER_BASE_URL,
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

    const persisted = listPluginTaskContextEntries(
      PLUGIN_TASK_DOMAIN_SKILLRUNNER,
    );
    assert.lengthOf(persisted, 0);
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

  it("reconciles running task to terminal failed after double-confirming backend terminal state", async function () {
    recordWorkflowTaskUpdate(
      makeDashboardJob({
        id: "active-terminal-failed",
        runId: "run-active-terminal-failed",
        requestId: "req-terminal-failed",
        state: "running",
        backendId: "remote-skillrunner",
        backendBaseUrl: "http://127.0.0.1:8031",
      }),
    );
    recordTaskDashboardHistoryFromJob(
      makeDashboardJob({
        id: "history-terminal-failed",
        runId: "run-history-terminal-failed",
        requestId: "req-terminal-failed",
        state: "running",
        backendId: "remote-skillrunner",
        backendBaseUrl: "http://127.0.0.1:8031",
      }),
    );
    const toasts: Array<{ state: string; text: string; type: string }> = [];
    setSkillRunnerTaskLifecycleToastEmitterForTests((payload) => {
      toasts.push(payload);
    });
    let pollCount = 0;
    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (url.endsWith("/v1/jobs/req-terminal-failed")) {
        pollCount += 1;
        return createJsonResponse({
          request_id: "req-terminal-failed",
          status: "failed",
          error: "backend hard terminated",
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
    assert.isAtLeast(pollCount, 2);
    const task = listWorkflowTasks().find(
      (entry) => entry.requestId === "req-terminal-failed",
    );
    assert.isOk(task);
    assert.equal(task?.state, "failed");
    assert.equal(task?.error, "backend hard terminated");
    const historyRows = listTaskDashboardHistory({
      backendId: "remote-skillrunner",
      requestId: "req-terminal-failed",
    });
    assert.lengthOf(historyRows, 1);
    assert.equal(historyRows[0].state, "failed");
    assert.equal(historyRows[0].error, "backend hard terminated");
    assert.lengthOf(toasts, 1);
    assert.equal(toasts[0].state, "failed");
    assert.equal(toasts[0].type, "error");
  });

  it("keeps running task unchanged when double-confirm terminal check is not stable", async function () {
    recordWorkflowTaskUpdate(
      makeDashboardJob({
        id: "active-terminal-unstable",
        runId: "run-active-terminal-unstable",
        requestId: "req-terminal-unstable",
        state: "running",
        backendId: "remote-skillrunner",
        backendBaseUrl: "http://127.0.0.1:8031",
      }),
    );
    recordTaskDashboardHistoryFromJob(
      makeDashboardJob({
        id: "history-terminal-unstable",
        runId: "run-history-terminal-unstable",
        requestId: "req-terminal-unstable",
        state: "running",
        backendId: "remote-skillrunner",
        backendBaseUrl: "http://127.0.0.1:8031",
      }),
    );
    const toasts: Array<{ state: string; text: string; type: string }> = [];
    setSkillRunnerTaskLifecycleToastEmitterForTests((payload) => {
      toasts.push(payload);
    });
    let pollCount = 0;
    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (url.endsWith("/v1/jobs/req-terminal-unstable")) {
        pollCount += 1;
        return createJsonResponse({
          request_id: "req-terminal-unstable",
          status: pollCount === 1 ? "failed" : "running",
          error: pollCount === 1 ? "transient terminal report" : null,
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
    assert.equal(pollCount, 2);
    const task = listWorkflowTasks().find(
      (entry) => entry.requestId === "req-terminal-unstable",
    );
    assert.isOk(task);
    assert.equal(task?.state, "running");
    const historyRows = listTaskDashboardHistory({
      backendId: "remote-skillrunner",
      requestId: "req-terminal-unstable",
    });
    assert.lengthOf(historyRows, 1);
    assert.equal(historyRows[0].state, "running");
    assert.lengthOf(toasts, 0);
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

  it("throttles repeated backend-reconcile-failed logs when backend is unreachable", async function () {
    let networkDown = true;
    (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
      if (isListRunsProbeUrl(url)) {
        if (networkDown) {
          throw new TypeError("NetworkError when attempting to fetch resource.");
        }
        return createJsonResponse({
          data: [],
        });
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
        id: TEST_SKILLRUNNER_BACKEND_ID,
        type: "skillrunner",
        baseUrl: TEST_SKILLRUNNER_BASE_URL,
        auth: { kind: "none" },
      },
      providerId: "skillrunner",
      providerOptions: { engine: "gemini" },
      job: makeDeferredJob({
        id: "job-reconcile-throttle",
        requestId: "req-reconcile-throttle",
        state: "running",
        fetchType: "result",
      }),
    });

    await reconciler.reconcilePending();
    await reconciler.reconcilePending();
    let failedLogs = listRuntimeLogs({
      operation: "backend-health-probe-failed",
      backendId: TEST_SKILLRUNNER_BACKEND_ID,
      order: "asc",
    });
    assert.lengthOf(failedLogs, 1);

    networkDown = true;
    await reconciler.reconcilePending();
    failedLogs = listRuntimeLogs({
      operation: "backend-health-probe-failed",
      backendId: TEST_SKILLRUNNER_BACKEND_ID,
      order: "asc",
    });
    assert.lengthOf(failedLogs, 1);
  });

  it("degrades reconcile poll frequency after sustained failures and restores after recovery", async function () {
    let networkDown = true;
    let fetchCount = 0;
    const previousBackendsPref = String(getPref("backendsConfigJson") || "");
    setPref(
      "backendsConfigJson",
      JSON.stringify({
        schemaVersion: 2,
        backends: [
          {
            id: TEST_SKILLRUNNER_BACKEND_ID,
            displayName: "Local Backend",
            type: "skillrunner",
            baseUrl: TEST_SKILLRUNNER_BASE_URL,
            auth: { kind: "none" },
          },
        ],
      }),
    );
    const dateNowDescriptor = Object.getOwnPropertyDescriptor(Date, "now");
    let fakeNow = Date.now();
    Object.defineProperty(Date, "now", {
      configurable: true,
      value: () => fakeNow,
    });
    try {
      (globalThis as { fetch?: typeof fetch }).fetch = async (url: string) => {
        if (isListRunsProbeUrl(url)) {
          fetchCount += 1;
          if (networkDown) {
            throw new TypeError("NetworkError when attempting to fetch resource.");
          }
          return createJsonResponse({
            data: [],
          });
        }
        if (url.endsWith("/v1/jobs/req-reconcile-backoff")) {
          return createJsonResponse({
            request_id: "req-reconcile-backoff",
            status: "running",
          });
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
          id: TEST_SKILLRUNNER_BACKEND_ID,
          type: "skillrunner",
          baseUrl: TEST_SKILLRUNNER_BASE_URL,
          auth: { kind: "none" },
        },
        providerId: "skillrunner",
        providerOptions: { engine: "gemini" },
        job: makeDeferredJob({
          id: "job-reconcile-backoff",
          requestId: "req-reconcile-backoff",
          state: "waiting_user",
          fetchType: "result",
        }),
      });

      const key = TEST_SKILLRUNNER_BACKEND_ID;

      await reconciler.reconcilePending();
      assert.isAtLeast(fetchCount, 1);
      let health = getSkillRunnerBackendHealthState(key);
      assert.isOk(health);
      assert.equal(health?.backoffLevel, 1);
      assert.isFalse(health?.reconcileFlag);
      assert.isTrue((health?.nextProbeAt || 0) > fakeNow);
      const countAfterFirstProbe = fetchCount;
      await reconciler.reconcilePending();
      assert.equal(fetchCount, countAfterFirstProbe);

      fakeNow = (health?.nextProbeAt || fakeNow) + 1;
      await reconciler.reconcilePending();
      assert.isAbove(fetchCount, countAfterFirstProbe);
      const countAfterSecondProbe = fetchCount;
      health = getSkillRunnerBackendHealthState(key);
      assert.equal(health?.backoffLevel, 2);
      assert.isTrue(health?.reconcileFlag);

      fakeNow = (health?.nextProbeAt || fakeNow) + 1;
      await reconciler.reconcilePending();
      assert.isAbove(fetchCount, countAfterSecondProbe);
      const countAfterThirdProbe = fetchCount;
      health = getSkillRunnerBackendHealthState(key);
      assert.equal(health?.backoffLevel, 2);

      await reconciler.reconcilePending();
      assert.equal(fetchCount, countAfterThirdProbe);

      fakeNow = (health?.nextProbeAt || fakeNow) + 1;
      networkDown = false;
      await reconciler.reconcilePending();
      assert.isAbove(fetchCount, countAfterThirdProbe);
      health = getSkillRunnerBackendHealthState(key);
      assert.equal(health?.backoffLevel, 0);
      assert.isFalse(health?.reconcileFlag);
    } finally {
      if (dateNowDescriptor) {
        Object.defineProperty(Date, "now", dateNowDescriptor);
      }
      setPref("backendsConfigJson", previousBackendsPref);
    }
  });
});
