import { assert } from "chai";
import { getProjectRoot, joinPath, readUtf8 } from "../zotero/workflow-test-utils";

async function readProjectFile(relativePath: string) {
  const targetPath = joinPath(getProjectRoot(), relativePath);
  return readUtf8(targetPath);
}

describe("dashboard home columns", function () {
  it("renders home running table with backend column and without request/actions columns", async function () {
    const js = await readProjectFile("addon/content/dashboard/app.js");
    assert.include(js, "labels.colBackend || \"Backend\"");
    assert.include(
      js,
      "columns: [\n          labels.colTask,\n          labels.colWorkflow,\n          labels.colBackend || \"Backend\",\n          labels.colStatus,\n          labels.colUpdatedAt,\n        ]",
    );
    assert.notInclude(
      js,
      "columns: [\n      labels.colTask,\n      labels.colWorkflow,\n      labels.colStatus,\n      labels.colRequestId,\n      labels.colUpdatedAt,\n      labels.colActions || \"Actions\",\n    ]",
    );
  });

  it("maps backend label into dashboard running rows", async function () {
    const ts = await readProjectFile("src/modules/taskManagerDialog.ts");
    assert.include(ts, "backendLabel: string;");
    assert.include(ts, "const backendDisplayName = backendId");
    assert.include(ts, "`${backendDisplayName} (${backendType})`");
    assert.include(ts, "options?.backendMetaById?.get(backendId)");
    assert.include(ts, "String(backendMeta?.type || \"\").trim()");
    assert.include(ts, "colBackend: localize(\"task-dashboard-col-backend\", \"Backend\")");
  });
});
