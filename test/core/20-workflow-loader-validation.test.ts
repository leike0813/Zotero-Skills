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

  it("reports schema-required errors for missing hooks.applyResult", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    await makeWorkflow(
      tmpRoot,
      "missing-required-apply-result",
      {
        id: "missing-required-apply-result",
        label: "Missing Required Apply Result",
        request: { kind: "skillrunner.job.v1" },
        hooks: {},
      },
      {},
    );

    const loaded = await loadWorkflowManifests(tmpRoot);
    assert.lengthOf(loaded.workflows, 0);

    const diagnostic = (loaded.diagnostics || []).find(
      (entry) =>
        entry.category === "manifest_validation_error" &&
        entry.entry === "missing-required-apply-result",
    );
    assert.isOk(
      diagnostic,
      `diagnostics=${JSON.stringify(loaded.diagnostics || [])}`,
    );
    assert.include(
      String(diagnostic?.reason || ""),
      "missing required property \"applyResult\"",
      `diagnostics=${JSON.stringify(loaded.diagnostics || [])}`,
    );
  });

  it("accepts workflow manifest when parameter allowCustom is boolean", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    await makeWorkflow(
      tmpRoot,
      "allow-custom-valid",
      {
        id: "allow-custom-valid",
        label: "Allow Custom Valid",
        request: { kind: "skillrunner.job.v1" },
        parameters: {
          language: {
            type: "string",
            enum: ["zh-CN", "en-US"],
            allowCustom: true,
            default: "zh-CN",
          },
        },
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
  });

  it("rejects workflow manifest when parameter allowCustom is not boolean", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    await makeWorkflow(
      tmpRoot,
      "allow-custom-invalid",
      {
        id: "allow-custom-invalid",
        label: "Allow Custom Invalid",
        request: { kind: "skillrunner.job.v1" },
        parameters: {
          language: {
            type: "string",
            enum: ["zh-CN", "en-US"],
            allowCustom: "yes",
            default: "zh-CN",
          },
        },
        hooks: { applyResult: "hooks/applyResult.js" },
      },
      {
        "applyResult.js":
          "export async function applyResult(){ return { ok: true }; }",
      },
    );

    const loaded = await loadWorkflowManifests(tmpRoot);
    assert.lengthOf(loaded.workflows, 0);
    const diagnostic = (loaded.diagnostics || []).find(
      (entry) =>
        entry.category === "manifest_validation_error" &&
        entry.entry === "allow-custom-invalid",
    );
    assert.isOk(
      diagnostic,
      `diagnostics=${JSON.stringify(loaded.diagnostics || [])}`,
    );
    assert.include(
      String(diagnostic?.reason || ""),
      "/parameters/language/allowCustom",
    );
    assert.include(String(diagnostic?.reason || ""), "must be boolean");
  });

  it("accepts workflow manifest when execution.feedback.showNotifications is boolean", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    await makeWorkflow(
      tmpRoot,
      "execution-feedback-valid",
      {
        id: "execution-feedback-valid",
        label: "Execution Feedback Valid",
        provider: "pass-through",
        execution: {
          feedback: {
            showNotifications: false,
          },
        },
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
  });

  it("rejects workflow manifest when execution.feedback.showNotifications is not boolean", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    await makeWorkflow(
      tmpRoot,
      "execution-feedback-invalid",
      {
        id: "execution-feedback-invalid",
        label: "Execution Feedback Invalid",
        provider: "pass-through",
        execution: {
          feedback: {
            showNotifications: "no",
          },
        },
        hooks: { applyResult: "hooks/applyResult.js" },
      },
      {
        "applyResult.js":
          "export async function applyResult(){ return { ok: true }; }",
      },
    );

    const loaded = await loadWorkflowManifests(tmpRoot);
    assert.lengthOf(loaded.workflows, 0);
    const diagnostic = (loaded.diagnostics || []).find(
      (entry) =>
        entry.category === "manifest_validation_error" &&
        entry.entry === "execution-feedback-invalid",
    );
    assert.isOk(
      diagnostic,
      `diagnostics=${JSON.stringify(loaded.diagnostics || [])}`,
    );
    assert.include(
      String(diagnostic?.reason || ""),
      "/execution/feedback/showNotifications",
    );
    assert.include(String(diagnostic?.reason || ""), "must be boolean");
  });

  it("rejects manifests containing deprecated fields through schema validation", async function () {
    const tmpRoot = await mkTempDir("zotero-skills-wf");
    const cases: Array<{
      id: string;
      manifest: Record<string, unknown>;
      reasonIncludes: string;
    }> = [
      {
        id: "deprecated-backend",
        reasonIncludes: "/backend uses deprecated field",
        manifest: {
          id: "deprecated-backend",
          label: "Deprecated Backend",
          backend: "legacy-backend",
          request: { kind: "skillrunner.job.v1" },
          hooks: { applyResult: "hooks/applyResult.js" },
        },
      },
      {
        id: "deprecated-defaults",
        reasonIncludes: "/defaults uses deprecated field",
        manifest: {
          id: "deprecated-defaults",
          label: "Deprecated Defaults",
          defaults: {},
          request: { kind: "skillrunner.job.v1" },
          hooks: { applyResult: "hooks/applyResult.js" },
        },
      },
      {
        id: "deprecated-request-result",
        reasonIncludes: "/request/result uses deprecated field",
        manifest: {
          id: "deprecated-request-result",
          label: "Deprecated Request Result",
          request: {
            kind: "skillrunner.job.v1",
            result: {},
          },
          hooks: { applyResult: "hooks/applyResult.js" },
        },
      },
      {
        id: "deprecated-request-create-engine",
        reasonIncludes: "/request/create/engine uses deprecated field",
        manifest: {
          id: "deprecated-request-create-engine",
          label: "Deprecated Request Create Engine",
          request: {
            kind: "skillrunner.job.v1",
            create: {
              skill_id: "literature-digest",
              engine: "openai",
            },
          },
          hooks: { applyResult: "hooks/applyResult.js" },
        },
      },
      {
        id: "deprecated-request-create-parameter",
        reasonIncludes: "/request/create/parameter uses deprecated field",
        manifest: {
          id: "deprecated-request-create-parameter",
          label: "Deprecated Request Create Parameter",
          request: {
            kind: "skillrunner.job.v1",
            create: {
              skill_id: "literature-digest",
              parameter: {},
            },
          },
          hooks: { applyResult: "hooks/applyResult.js" },
        },
      },
      {
        id: "deprecated-request-create-model",
        reasonIncludes: "/request/create/model uses deprecated field",
        manifest: {
          id: "deprecated-request-create-model",
          label: "Deprecated Request Create Model",
          request: {
            kind: "skillrunner.job.v1",
            create: {
              skill_id: "literature-digest",
              model: "gpt-4o-mini",
            },
          },
          hooks: { applyResult: "hooks/applyResult.js" },
        },
      },
      {
        id: "deprecated-request-create-runtime-options",
        reasonIncludes: "/request/create/runtime_options uses deprecated field",
        manifest: {
          id: "deprecated-request-create-runtime-options",
          label: "Deprecated Request Create Runtime Options",
          request: {
            kind: "skillrunner.job.v1",
            create: {
              skill_id: "literature-digest",
              runtime_options: {},
            },
          },
          hooks: { applyResult: "hooks/applyResult.js" },
        },
      },
    ];

    for (const entry of cases) {
      await makeWorkflow(
        tmpRoot,
        entry.id,
        entry.manifest,
        {
          "applyResult.js":
            "export async function applyResult(){ return { ok: true }; }",
        },
      );
    }

    const loaded = await loadWorkflowManifests(tmpRoot);
    assert.lengthOf(loaded.workflows, 0);

    for (const entry of cases) {
      const diagnostic = (loaded.diagnostics || []).find(
        (item) =>
          item.category === "manifest_validation_error" && item.entry === entry.id,
      );
      assert.isOk(
        diagnostic,
        `missing diagnostic entry=${entry.id}; diagnostics=${JSON.stringify(loaded.diagnostics || [])}`,
      );
      assert.include(
        String(diagnostic?.reason || ""),
        entry.reasonIncludes,
        `entry=${entry.id}; diagnostics=${JSON.stringify(loaded.diagnostics || [])}`,
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
