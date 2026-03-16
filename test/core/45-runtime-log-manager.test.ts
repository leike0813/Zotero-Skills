import { assert } from "chai";
import { config } from "../../package.json";
import {
  appendRuntimeLog,
  buildRuntimeDiagnosticBundle,
  buildRuntimeIssueSummary,
  clearRuntimeLogs,
  getRuntimeLogDiagnosticMode,
  getRuntimeLogRetentionConfig,
  listRuntimeLogs,
  resetRuntimeLogAllowedLevels,
  setRuntimeLogDiagnosticMode,
  setRuntimeLogAllowedLevels,
  snapshotRuntimeLogs,
} from "../../src/modules/runtimeLogManager";

describe("runtime log manager", function () {
  beforeEach(function () {
    clearRuntimeLogs();
    resetRuntimeLogAllowedLevels();
    setRuntimeLogDiagnosticMode(false);
  });

  afterEach(function () {
    clearRuntimeLogs();
    resetRuntimeLogAllowedLevels();
    setRuntimeLogDiagnosticMode(false);
  });

  it("normalizes schema and redacts sensitive fields", function () {
    const entry = appendRuntimeLog({
      level: "error",
      scope: "provider",
      workflowId: "mineru",
      requestId: "req-1",
      jobId: "job-1",
      stage: "upload",
      message: "provider failed",
      details: {
        authorization: "Bearer secret-token",
        token: "abc",
        nested: {
          access_token: "xyz",
          visible: "ok",
        },
      },
      error: new Error("boom"),
    });
    assert.isOk(entry);
    assert.match(entry!.id, /^log-\d+$/);
    assert.equal(entry!.level, "error");
    assert.equal(entry!.scope, "provider");
    assert.equal(entry!.details && (entry!.details as any).authorization, "<redacted>");
    assert.equal(entry!.details && (entry!.details as any).token, "<redacted>");
    assert.equal(
      entry!.details && (entry!.details as any).nested?.access_token,
      "<redacted>",
    );
    assert.equal(entry!.details && (entry!.details as any).nested?.visible, "ok");
    assert.equal(entry!.error?.message, "boom");
  });

  it("skips debug logs by default and keeps error logs", function () {
    const skipped = appendRuntimeLog({
      level: "debug",
      scope: "system",
      stage: "debug-stage",
      message: "debug message",
    });
    assert.isNull(skipped);
    assert.lengthOf(listRuntimeLogs(), 0);

    appendRuntimeLog({
      level: "error",
      scope: "system",
      stage: "error-stage",
      message: "error message",
    });
    assert.lengthOf(listRuntimeLogs(), 1);
  });

  it("enforces fixed retention with oldest-first eviction", function () {
    setRuntimeLogDiagnosticMode(true);
    for (let i = 0; i < 2005; i++) {
      appendRuntimeLog({
        level: "debug",
        scope: "system",
        stage: `s-${i}`,
        message: `m-${i}`,
      });
    }
    const snapshot = snapshotRuntimeLogs();
    assert.equal(snapshot.entries.length, 2005);
    assert.equal(snapshot.maxEntries, 3000);
  });

  it("enforces diagnostic mode dual budget with byte-limit eviction", function () {
    this.timeout(10000);
    setRuntimeLogDiagnosticMode(true);
    for (let i = 0; i < 3200; i++) {
      appendRuntimeLog({
        level: "debug",
        scope: "system",
        stage: `s-${i}`,
        message: `m-${i}-${"x".repeat(180)}`,
      });
    }
    const snapshot = snapshotRuntimeLogs();
    assert.isAtMost(snapshot.entries.length, 3000);
    assert.isAtLeast(snapshot.droppedEntries, 1);
    assert.isAtLeast(
      snapshot.droppedByReason.entry_limit + snapshot.droppedByReason.byte_budget,
      1,
    );
  });

  it("keeps normal mode entry budget and drops oldest entries", function () {
    for (let i = 0; i < 2005; i++) {
      appendRuntimeLog({
        level: "info",
        scope: "system",
        stage: `s-${i}`,
        message: `m-${i}`,
      });
    }
    const snapshot = snapshotRuntimeLogs();
    assert.equal(snapshot.entries.length, 2000);
    assert.equal(snapshot.droppedEntries, 5);
    assert.equal(snapshot.entries[0].stage, "s-5");
    assert.equal(snapshot.entries[snapshot.entries.length - 1].stage, "s-2004");
    assert.equal(snapshot.maxEntries, 2000);
  });

  it("supports filtering and ordering", function () {
    appendRuntimeLog({
      level: "info",
      scope: "workflow-trigger",
      workflowId: "a",
      stage: "start",
      message: "start",
    });
    appendRuntimeLog({
      level: "warn",
      scope: "job",
      workflowId: "a",
      jobId: "job-1",
      stage: "warn-stage",
      message: "warn",
    });
    appendRuntimeLog({
      level: "error",
      scope: "job",
      workflowId: "b",
      jobId: "job-2",
      stage: "error-stage",
      message: "error",
    });

    const filtered = listRuntimeLogs({
      levels: ["warn", "error"],
      scopes: ["job"],
      workflowId: "a",
      order: "desc",
    });
    assert.lengthOf(filtered, 1);
    assert.equal(filtered[0].stage, "warn-stage");
  });

  it("persists logs into prefs and clears persisted payload", function () {
    appendRuntimeLog({
      level: "info",
      scope: "system",
      stage: "persist-stage",
      message: "persist message",
    });
    const prefKey = `${config.prefsPrefix}.runtimeLogsJson`;
    const rawPersisted = String(
      (globalThis as any).Zotero.Prefs.get(prefKey, true) || "",
    );
    assert.isTrue(rawPersisted.length > 0);
    const parsedPersisted = JSON.parse(rawPersisted) as { entries?: unknown[] };
    assert.equal(parsedPersisted.entries?.length || 0, 1);

    clearRuntimeLogs();
    const rawCleared = String(
      (globalThis as any).Zotero.Prefs.get(prefKey, true) || "",
    );
    assert.isTrue(rawCleared.length > 0);
    const parsedCleared = JSON.parse(rawCleared) as { entries?: unknown[] };
    assert.equal(parsedCleared.entries?.length || 0, 0);
  });

  it("supports diagnostic mode toggle", function () {
    assert.isFalse(getRuntimeLogDiagnosticMode());
    setRuntimeLogDiagnosticMode(true);
    assert.isTrue(getRuntimeLogDiagnosticMode());
    const debug = appendRuntimeLog({
      level: "debug",
      scope: "system",
      stage: "diag-stage",
      message: "diag message",
    });
    assert.isOk(debug);
    setRuntimeLogDiagnosticMode(false);
    const skipped = appendRuntimeLog({
      level: "debug",
      scope: "system",
      stage: "normal-stage",
      message: "normal message",
    });
    assert.isNull(skipped);
  });

  it("builds RuntimeDiagnosticBundleV1 and issue summary", function () {
    setRuntimeLogDiagnosticMode(true);
    appendRuntimeLog({
      level: "error",
      scope: "provider",
      backendId: "b1",
      backendType: "skillrunner",
      providerId: "skillrunner",
      workflowId: "wf-1",
      runId: "run-1",
      requestId: "req-1",
      jobId: "job-1",
      component: "provider",
      operation: "dispatch",
      stage: "dispatch-failed",
      message: "request failed due to timeout",
      details: {
        authorization: "Bearer secret-value",
      },
      error: new Error("ETIMEDOUT"),
    });
    const bundle = buildRuntimeDiagnosticBundle({
      filters: {
        requestId: "req-1",
      },
    });
    assert.equal(bundle.schemaVersion, "runtime-diagnostic-bundle/v1");
    assert.equal(bundle.meta.diagnosticMode, true);
    assert.equal(bundle.entries.length, 1);
    assert.equal((bundle.entries[0].details as any).authorization, "<redacted>");
    assert.isTrue(Array.isArray(bundle.timeline));
    assert.isAtLeast(bundle.incidents.length, 1);
    const issue = buildRuntimeIssueSummary({
      filters: {
        requestId: "req-1",
      },
    });
    assert.include(issue, "Runtime Diagnostic Summary");
    assert.include(issue, "req-1");
  });

  it("drops expired logs older than retention window", function () {
    const retentionMs = getRuntimeLogRetentionConfig().retentionMs;
    const expiredTs = new Date(Date.now() - retentionMs - 24 * 60 * 60 * 1000).toISOString();
    appendRuntimeLog({
      ts: expiredTs,
      level: "info",
      scope: "system",
      stage: "expired-stage",
      message: "expired-message",
    });
    const entries = listRuntimeLogs();
    assert.lengthOf(entries, 0);
    assert.isAtLeast(snapshotRuntimeLogs().droppedEntries, 1);
  });
});
