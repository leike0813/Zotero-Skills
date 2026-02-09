import { assert } from "chai";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import { joinPath, mkTempDir, writeUtf8 } from "./workflow-test-utils";

async function makeWorkflow(
  rootDir: string,
  id: string,
  manifest: Record<string, unknown>,
  hooks: Record<string, string>,
) {
  const workflowDir = joinPath(rootDir, id);
  const hooksDir = joinPath(workflowDir, "hooks");
  await writeUtf8(
    joinPath(workflowDir, "workflow.json"),
    JSON.stringify(manifest, null, 2),
  );
  for (const [name, content] of Object.entries(hooks)) {
    await writeUtf8(joinPath(hooksDir, name), content);
  }
}

describe("workflow loader validation", function () {
  it("accepts workflow with declarative request and required applyResult hook", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    await makeWorkflow(
      tmpRoot,
      "declarative-ok",
      {
        id: "declarative-ok",
        label: "Declarative",
        request: { kind: "skillrunner.job.v1" },
        hooks: { applyResult: "hooks/applyResult.js" },
      },
      {
        "applyResult.js":
          "export async function applyResult(){ return { ok: true }; }",
      },
    );
    const loaded = await loadWorkflowManifests(tmpRoot);
    assert.lengthOf(
      loaded.workflows,
      1,
      `warnings=${JSON.stringify(loaded.warnings)} errors=${JSON.stringify(loaded.errors)}`,
    );
    assert.equal(loaded.workflows[0].buildStrategy, "declarative");
  });

  it("rejects workflow when both buildRequest hook and request are missing", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    await makeWorkflow(
      tmpRoot,
      "missing-build",
      {
        id: "missing-build",
        label: "Missing Build",
        hooks: { applyResult: "hooks/applyResult.js" },
      },
      {
        "applyResult.js":
          "export async function applyResult(){ return { ok: true }; }",
      },
    );
    const loaded = await loadWorkflowManifests(tmpRoot);
    assert.lengthOf(loaded.workflows, 0);
    assert.isTrue(
      loaded.warnings.some((warning) =>
        warning.includes("missing hooks.buildRequest and request declaration"),
      ),
    );
  });

  it("rejects workflow when applyResult hook is missing", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    await makeWorkflow(
      tmpRoot,
      "missing-apply",
      {
        id: "missing-apply",
        label: "Missing Apply",
        request: { kind: "skillrunner.job.v1" },
        hooks: { applyResult: "hooks/applyResult.js" },
      },
      {},
    );
    const loaded = await loadWorkflowManifests(tmpRoot);
    assert.lengthOf(loaded.workflows, 0);
    assert.isTrue(
      loaded.warnings.some((warning) => warning.includes("missing-apply")),
    );
  });
});
