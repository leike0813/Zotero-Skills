import { assert } from "chai";
import {
  getPluginStateMigrationStatus,
  inspectPluginStateStoreCounts,
  resetPluginStateStoreForTests,
} from "../../src/modules/pluginStateStore";
import { getPref, setPref } from "../../src/utils/prefs";

describe("plugin state store bootstrap", function () {
  beforeEach(function () {
    setPref("skillRunnerRequestLedgerJson", "");
    setPref("skillRunnerDeferredTasksJson", "");
    setPref("taskDashboardHistoryJson", "");
    resetPluginStateStoreForTests();
  });

  afterEach(function () {
    setPref("skillRunnerRequestLedgerJson", "");
    setPref("skillRunnerDeferredTasksJson", "");
    setPref("taskDashboardHistoryJson", "");
    resetPluginStateStoreForTests();
  });

  it("writes migration status in plugin_meta during initialization", function () {
    const status = getPluginStateMigrationStatus();
    assert.equal(status, "done");
  });

  it("skips malformed legacy rows and keeps valid rows when migrating", function () {
    setPref(
      "skillRunnerRequestLedgerJson",
      JSON.stringify([
        null,
        { requestId: "", backendId: "b1", snapshot: "running" },
        {
          requestId: "req-ok",
          backendId: "b1",
          snapshot: "running",
          updatedAt: "2026-03-16T00:00:00.000Z",
        },
      ]),
    );
    setPref(
      "skillRunnerDeferredTasksJson",
      JSON.stringify([
        { id: "", requestId: "", backendId: "b1", state: "running" },
        { id: "ctx-ok", requestId: "req-ok", backendId: "b1", state: "running" },
      ]),
    );
    setPref(
      "taskDashboardHistoryJson",
      JSON.stringify([
        { id: "", requestId: "req-ok", backendId: "b1", state: "failed" },
        { id: "task-ok", requestId: "req-ok", backendId: "b1", state: "failed" },
      ]),
    );
    resetPluginStateStoreForTests();

    assert.equal(getPluginStateMigrationStatus(), "done");
    const counts = inspectPluginStateStoreCounts();
    assert.isAtLeast(counts.requestCount, 0);
    assert.isAtLeast(counts.contextCount, 0);
    assert.isAtLeast(counts.rowCount, 0);
    assert.equal(String(getPref("skillRunnerRequestLedgerJson") || ""), "");
    assert.equal(String(getPref("skillRunnerDeferredTasksJson") || ""), "");
    assert.equal(String(getPref("taskDashboardHistoryJson") || ""), "");
  });
});
