import { assert } from "chai";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import { fixturePath, joinPath, mkTempDir, writeUtf8 } from "./workflow-test-utils";

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
        provider: "skillrunner",
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

  it("accepts pass-through workflow without buildRequest and request", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    await makeWorkflow(
      tmpRoot,
      "pass-through-minimal",
      {
        id: "pass-through-minimal",
        label: "Pass Through Minimal",
        provider: "pass-through",
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

  it("rejects fixture workflow when workflow.json is invalid JSON", async function () {
    const loaded = await loadWorkflowManifests(
      fixturePath("workflow-loader-invalid-json"),
    );
    assert.lengthOf(loaded.workflows, 0);
    assert.isTrue(
      loaded.warnings.some((warning) =>
        warning.includes("invalid-json-workflow"),
      ),
      `warnings=${JSON.stringify(loaded.warnings)}`,
    );
  });

  it("rejects fixture workflow when required applyResult hook file is missing", async function () {
    const loaded = await loadWorkflowManifests(
      fixturePath("workflow-loader-missing-apply"),
    );
    assert.lengthOf(loaded.workflows, 0);
    assert.isTrue(
      loaded.warnings.some((warning) =>
        warning.includes("missing-apply-workflow"),
      ),
      `warnings=${JSON.stringify(loaded.warnings)}`,
    );
    assert.isTrue(
      loaded.warnings.some((warning) => warning.includes("applyResult.js")),
      `warnings=${JSON.stringify(loaded.warnings)}`,
    );
  });

  it("rejects fixture workflows when required manifest fields are missing or empty", async function () {
    const fixturesRoot = fixturePath("workflow-loader-missing-required-fields");
    const invalidEntries = [
      "missing-id",
      "empty-id",
      "missing-label",
      "empty-label",
      "missing-hooks",
      "missing-apply-path",
      "empty-apply-path",
    ];

    const loaded = await loadWorkflowManifests(fixturesRoot);
    assert.lengthOf(loaded.workflows, 0);

    for (const entry of invalidEntries) {
      assert.isTrue(
        loaded.warnings.some(
          (warning) =>
            warning.includes("Invalid workflow manifest:") &&
            warning.includes(`${entry}`) &&
            warning.includes("workflow.json"),
        ),
        `missing warning for fixture=${entry}, warnings=${JSON.stringify(loaded.warnings)}`,
      );
    }
  });
});
