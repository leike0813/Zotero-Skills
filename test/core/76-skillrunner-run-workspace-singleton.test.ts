import { assert } from "chai";
import { getProjectRoot, joinPath, readUtf8 } from "../zotero/workflow-test-utils";

async function readProjectFile(relativePath: string) {
  const targetPath = joinPath(getProjectRoot(), relativePath);
  return readUtf8(targetPath);
}

describe("skillrunner run workspace singleton", function () {
  it("routes openSkillRunnerRunDialog to one global workspace window", async function () {
    const ts = await readProjectFile("src/modules/skillRunnerRunDialog.ts");
    assert.include(ts, "isWindowAlive(runWorkspaceState.dialog?.window)");
    assert.include(ts, "runWorkspaceState.dialog?.window?.focus()");
    assert.include(ts, "runWorkspaceState.latestOpenTarget");
    assert.include(ts, "refreshWorkspaceSnapshot({");
  });

  it("builds workspace groups with active/finished buckets and title fallback", async function () {
    const ts = await readProjectFile("src/modules/skillRunnerRunDialog.ts");
    assert.include(ts, "activeTasks: disabled ? [] : sorted.filter((task) => !task.terminal)");
    assert.include(ts, "finishedTasks: disabled ? [] : sorted.filter((task) => task.terminal)");
    assert.include(ts, "disabled = isSkillRunnerBackendReconcileFlagged");
    assert.include(ts, "resolveRunWorkspaceTaskTitle");
    assert.include(ts, "task-dashboard-run-waiting-request-id");
    assert.include(ts, "selectable: requestId.length > 0");
  });

  it("extends host snapshot with workspace plus selected session", async function () {
    const ts = await readProjectFile("src/modules/skillRunnerRunDialog.ts");
    assert.include(ts, "buildRunWorkspaceSnapshot");
    assert.include(ts, "workspace: {");
    assert.include(ts, "selectedTaskKey: runWorkspaceState.selectedTaskKey");
    assert.include(ts, "session,");
  });
});
