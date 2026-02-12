import { assert } from "chai";
import {
  appendRuntimeLog,
  clearRuntimeLogs,
  listRuntimeLogs,
  resetRuntimeLogAllowedLevels,
  setRuntimeLogAllowedLevels,
  snapshotRuntimeLogs,
} from "../../src/modules/runtimeLogManager";

describe("runtime log manager", function () {
  beforeEach(function () {
    clearRuntimeLogs();
    resetRuntimeLogAllowedLevels();
  });

  afterEach(function () {
    clearRuntimeLogs();
    resetRuntimeLogAllowedLevels();
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
    setRuntimeLogAllowedLevels(["info", "warn", "error", "debug"]);
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
});

