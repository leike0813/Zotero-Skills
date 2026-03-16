import { assert } from "chai";
import { getProjectRoot, joinPath, readUtf8 } from "../zotero/workflow-test-utils";

async function readProjectFile(relativePath: string) {
  const targetPath = joinPath(getProjectRoot(), relativePath);
  return readUtf8(targetPath);
}

describe("dashboard home columns", function () {
  it("renders home running table with backend column and row-click routing", async function () {
    const js = await readProjectFile("addon/content/dashboard/app.js");
    assert.include(js, "labels.colBackend || \"Backend\"");
    assert.include(
      js,
      "columns: [\n          labels.colTask,\n          labels.colWorkflow,\n          labels.colBackend || \"Backend\",\n          labels.colStatus,\n          labels.colUpdatedAt,\n        ]",
    );
    assert.include(js, "onRowClick: (row) => {");
    assert.include(js, 'sendAction("open-running-task", {');
    assert.include(js, "taskId: row.id,");
    assert.include(js, "backendId: row.backendId || \"\",");
    assert.include(js, "backendType: row.backendType || \"\",");
    assert.include(js, "requestId: row.requestId || \"\",");
    assert.notInclude(
      js,
      "columns: [\n      labels.colTask,\n      labels.colWorkflow,\n      labels.colStatus,\n      labels.colRequestId,\n      labels.colUpdatedAt,\n      labels.colActions || \"Actions\",\n    ]",
    );
  });

  it("maps backend label into dashboard running rows", async function () {
    const ts = await readProjectFile("src/modules/taskManagerDialog.ts");
    assert.include(ts, "backendId: string;");
    assert.include(ts, "backendType: string;");
    assert.include(ts, "backendLabel: string;");
    assert.include(ts, "const backendDisplayName = backendId");
    assert.include(ts, "backendId,");
    assert.include(ts, "backendType,");
    assert.include(ts, "`${backendDisplayName} (${backendType})`");
    assert.include(ts, "options?.backendMetaById?.get(backendId)");
    assert.include(ts, "String(backendMeta?.type || \"\").trim()");
    assert.include(ts, "colBackend: localize(\"task-dashboard-col-backend\", \"Backend\")");
  });

  it("routes row-click by backend type and handles missing skillrunner requestId", async function () {
    const ts = await readProjectFile("src/modules/taskManagerDialog.ts");
    assert.include(ts, 'if (action === "open-running-task")');
    assert.include(ts, 'if (backendType === "skillrunner")');
    assert.include(ts, 'if (backendType === "generic-http")');
    assert.include(ts, 'state.selectedTabKey = toBackendTabKey(backendId);');
    assert.include(ts, '"task-dashboard-open-run-missing-request-id"');
  });

  it("defines missing-request-id prompt in both locales", async function () {
    const en = await readProjectFile("addon/locale/en-US/addon.ftl");
    const zh = await readProjectFile("addon/locale/zh-CN/addon.ftl");
    assert.include(
      en,
      "task-dashboard-open-run-missing-request-id = This run does not have a request ID yet. Try again later.",
    );
    assert.include(
      zh,
      "task-dashboard-open-run-missing-request-id = 当前运行尚未分配 request ID，请稍后再试。",
    );
  });
});
