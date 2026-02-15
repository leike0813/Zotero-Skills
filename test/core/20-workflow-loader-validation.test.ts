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
    assert.isTrue(
      (loaded.diagnostics || []).some(
        (entry) =>
          entry.category === "manifest_parse_error" &&
          entry.entry === "invalid-json-workflow",
      ),
      `diagnostics=${JSON.stringify(loaded.diagnostics || [])}`,
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
    assert.isTrue(
      (loaded.diagnostics || []).some(
        (entry) =>
          entry.category === "hook_missing_error" &&
          entry.workflowId === "missing-apply-workflow",
      ),
      `diagnostics=${JSON.stringify(loaded.diagnostics || [])}`,
    );
  });

  it("Risk: MR-01 reports normalizeSettings missing file diagnostics", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    await makeWorkflow(
      tmpRoot,
      "normalize-settings-missing-file",
      {
        id: "normalize-settings-missing-file",
        label: "Normalize Settings Missing File",
        request: { kind: "skillrunner.job.v1" },
        hooks: {
          applyResult: "hooks/applyResult.js",
          normalizeSettings: "hooks/normalizeSettings.js",
        },
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
        warning.includes("Hook file missing: hooks/normalizeSettings.js"),
      ),
      `warnings=${JSON.stringify(loaded.warnings)}`,
    );
    assert.isTrue(
      (loaded.diagnostics || []).some(
        (entry) =>
          entry.category === "hook_missing_error" &&
          entry.workflowId === "normalize-settings-missing-file",
      ),
      `diagnostics=${JSON.stringify(loaded.diagnostics || [])}`,
    );
  });

  it("Risk: MR-01 reports normalizeSettings import failures as hook_import_error", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    await makeWorkflow(
      tmpRoot,
      "normalize-settings-import-error",
      {
        id: "normalize-settings-import-error",
        label: "Normalize Settings Import Error",
        request: { kind: "skillrunner.job.v1" },
        hooks: {
          applyResult: "hooks/applyResult.js",
          normalizeSettings: "hooks/normalizeSettings.js",
        },
      },
      {
        "applyResult.js":
          "export async function applyResult(){ return { ok: true }; }",
        "normalizeSettings.js":
          "export async function normalizeSettings( { return {}; }",
      },
    );

    const loaded = await loadWorkflowManifests(tmpRoot);
    assert.lengthOf(loaded.workflows, 0);
    assert.isTrue(
      loaded.warnings.some((warning) =>
        warning.includes("Hook import failed: hooks/normalizeSettings.js"),
      ),
      `warnings=${JSON.stringify(loaded.warnings)}`,
    );
    assert.isTrue(
      (loaded.diagnostics || []).some(
        (entry) =>
          entry.category === "hook_import_error" &&
          entry.workflowId === "normalize-settings-import-error",
      ),
      `diagnostics=${JSON.stringify(loaded.diagnostics || [])}`,
    );
  });

  it("Risk: MR-01 reports normalizeSettings export mismatch diagnostics", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    await makeWorkflow(
      tmpRoot,
      "normalize-settings-export-missing",
      {
        id: "normalize-settings-export-missing",
        label: "Normalize Settings Export Missing",
        request: { kind: "skillrunner.job.v1" },
        hooks: {
          applyResult: "hooks/applyResult.js",
          normalizeSettings: "hooks/normalizeSettings.js",
        },
      },
      {
        "applyResult.js":
          "export async function applyResult(){ return { ok: true }; }",
        "normalizeSettings.js":
          "export async function notNormalizeSettings(){ return {}; }",
      },
    );

    const loaded = await loadWorkflowManifests(tmpRoot);
    assert.lengthOf(loaded.workflows, 0);
    assert.isTrue(
      loaded.warnings.some((warning) =>
        warning.includes("Hook export normalizeSettings() not found"),
      ),
      `warnings=${JSON.stringify(loaded.warnings)}`,
    );
    assert.isTrue(
      (loaded.diagnostics || []).some(
        (entry) =>
          entry.category === "hook_import_error" &&
          entry.workflowId === "normalize-settings-export-missing" &&
          String(entry.reason || "").includes("normalizeSettings export missing"),
      ),
      `diagnostics=${JSON.stringify(loaded.diagnostics || [])}`,
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

  it("emits deterministic ordering for loaded workflows and diagnostics", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    await makeWorkflow(
      tmpRoot,
      "z-workflow",
      {
        id: "z-workflow",
        label: "Z Workflow",
        request: { kind: "skillrunner.job.v1" },
        hooks: { applyResult: "hooks/applyResult.js" },
      },
      {
        "applyResult.js":
          "export async function applyResult(){ return { ok: true }; }",
      },
    );
    await makeWorkflow(
      tmpRoot,
      "a-workflow",
      {
        id: "a-workflow",
        label: "A Workflow",
        request: { kind: "skillrunner.job.v1" },
        hooks: { applyResult: "hooks/applyResult.js" },
      },
      {
        "applyResult.js":
          "export async function applyResult(){ return { ok: true }; }",
      },
    );
    await makeWorkflow(
      tmpRoot,
      "broken-workflow",
      {
        id: "broken-workflow",
        label: "Broken Workflow",
        request: { kind: "skillrunner.job.v1" },
        hooks: { applyResult: "hooks/applyResult.js" },
      },
      {},
    );

    const first = await loadWorkflowManifests(tmpRoot);
    const second = await loadWorkflowManifests(tmpRoot);

    assert.deepEqual(
      first.workflows.map((entry) => entry.manifest.id),
      ["a-workflow", "z-workflow"],
    );
    assert.deepEqual(
      second.workflows.map((entry) => entry.manifest.id),
      ["a-workflow", "z-workflow"],
    );
    assert.deepEqual(first.warnings, second.warnings);
    assert.deepEqual(first.errors, second.errors);
    assert.deepEqual(first.diagnostics || [], second.diagnostics || []);
  });
});
