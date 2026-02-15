import { assert } from "chai";
import { config } from "../../package.json";
import { handlers } from "../../src/handlers";
import { buildSelectionContext } from "../../src/modules/selectionContext";
import { rescanWorkflowRegistry } from "../../src/modules/workflowRuntime";
import {
  clearRunOnceWorkflowOverrides,
  clearWorkflowSettings,
  resetRunOnceOverridesForSettingsOpen,
  resolveWorkflowExecutionContext,
  setRunOnceWorkflowOverrides,
  updateWorkflowSettings,
} from "../../src/modules/workflowSettings";
import { executeBuildRequests } from "../../src/workflows/runtime";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import {
  fixturePath,
  workflowsPath,
  joinPath,
  mkTempDir,
  writeUtf8,
} from "./workflow-test-utils";

async function ensureWorkflowRegistryLoaded() {
  await rescanWorkflowRegistry({ workflowsDir: workflowsPath() });
}

describe("workflow settings execution", function () {
  const backendsConfigPrefKey = `${config.prefsPrefix}.backendsConfigJson`;
  const workflowSettingsPrefKey = `${config.prefsPrefix}.workflowSettingsJson`;
  let prevBackendsConfigPref: unknown;
  let prevWorkflowSettingsPref: unknown;

  beforeEach(function () {
    prevBackendsConfigPref = Zotero.Prefs.get(backendsConfigPrefKey, true);
    prevWorkflowSettingsPref = Zotero.Prefs.get(workflowSettingsPrefKey, true);

    Zotero.Prefs.set(
      backendsConfigPrefKey,
      JSON.stringify({
        backends: [
          {
            id: "skillrunner-local",
            type: "skillrunner",
            baseUrl: "http://127.0.0.1:8030",
            auth: { kind: "none" },
          },
          {
            id: "skillrunner-alt",
            type: "skillrunner",
            baseUrl: "http://127.0.0.1:18030",
            auth: { kind: "none" },
          },
          {
            id: "generic-http-local",
            type: "generic-http",
            baseUrl: "http://127.0.0.1:8030",
            auth: { kind: "none" },
          },
        ],
      }),
      true,
    );
    Zotero.Prefs.clear(workflowSettingsPrefKey, true);
    clearRunOnceWorkflowOverrides("literature-digest");
    clearRunOnceWorkflowOverrides("reference-matching");
  });

  afterEach(function () {
    clearRunOnceWorkflowOverrides("literature-digest");
    clearRunOnceWorkflowOverrides("reference-matching");
    clearWorkflowSettings("literature-digest");
    clearWorkflowSettings("reference-matching");
    if (typeof prevBackendsConfigPref === "undefined") {
      Zotero.Prefs.clear(backendsConfigPrefKey, true);
    } else {
      Zotero.Prefs.set(backendsConfigPrefKey, prevBackendsConfigPref, true);
    }
    if (typeof prevWorkflowSettingsPref === "undefined") {
      Zotero.Prefs.clear(workflowSettingsPrefKey, true);
    } else {
      Zotero.Prefs.set(workflowSettingsPrefKey, prevWorkflowSettingsPref, true);
    }
  });

  it("applies persisted workflow params/provider options/profile to request build", async function () {
    updateWorkflowSettings("literature-digest", {
      backendId: "skillrunner-alt",
      workflowParams: { language: "en-US" },
      providerOptions: {
        engine: "gemini",
        model: "gemini-2.5-flash",
        no_cache: true,
      },
    });

    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow);

    const context = await resolveWorkflowExecutionContext({
      workflow: workflow!,
      consumeRunOnce: false,
    });
    assert.equal(context.backend.id, "skillrunner-alt");
    assert.equal(context.providerId, "skillrunner");
    assert.equal(context.workflowParams.language, "en-US");
    assert.equal(context.providerOptions.engine, "gemini");
    assert.equal(context.providerOptions.model, "gemini-2.5-flash");
    assert.equal(context.providerOptions.no_cache, true);

    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Settings Parent" },
    });
    const mdFile = fixturePath("literature-digest", "example.md");
    const attachment = await handlers.attachment.createFromPath({
      parent,
      path: mdFile,
      title: "workflow-settings.md",
      mimeType: "text/markdown",
    });
    const selectionContext = await buildSelectionContext([attachment]);
    const requests = (await executeBuildRequests({
      workflow: workflow!,
      selectionContext,
      executionOptions: {
        workflowParams: context.workflowParams,
        providerOptions: context.providerOptions,
      },
    })) as Array<{
      kind: string;
      parameter?: { language?: string };
      skill_id?: string;
      fetch_type?: "bundle" | "result";
      upload_files?: Array<{ key: string; path: string }>;
    }>;
    assert.equal(requests[0].kind, "skillrunner.job.v1");
    assert.equal(requests[0].skill_id, "literature-digest");
    assert.equal(requests[0].parameter?.language, "en-US");
    assert.equal(requests[0].fetch_type, "bundle");
    assert.equal(requests[0].upload_files?.[0].key, "md_path");
  });

  it("consumes run-once overrides exactly once", async function () {
    updateWorkflowSettings("literature-digest", {
      backendId: "skillrunner-local",
      workflowParams: { language: "zh-CN" },
      providerOptions: {
        engine: "gemini",
        model: "",
        no_cache: false,
      },
    });
    setRunOnceWorkflowOverrides("literature-digest", {
      backendId: "skillrunner-alt",
      workflowParams: { language: "en-US" },
      providerOptions: {
        engine: "gemini",
        model: "gemini-2.5-flash",
        no_cache: true,
      },
    });

    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow);

    const first = await resolveWorkflowExecutionContext({
      workflow: workflow!,
      consumeRunOnce: true,
    });
    assert.equal(first.backend.id, "skillrunner-alt");
    assert.equal(first.workflowParams.language, "en-US");
    assert.equal(first.providerOptions.engine, "gemini");
    assert.equal(first.providerOptions.model, "gemini-2.5-flash");
    assert.equal(first.providerOptions.no_cache, true);

    const second = await resolveWorkflowExecutionContext({
      workflow: workflow!,
      consumeRunOnce: true,
    });
    assert.equal(second.backend.id, "skillrunner-local");
    assert.equal(second.workflowParams.language, "zh-CN");
    assert.equal(second.providerOptions.engine, "gemini");
    assert.equal(second.providerOptions.model, "");
    assert.equal(second.providerOptions.no_cache, false);
  });

  it("resets run-once defaults to persisted snapshot when settings page opens", async function () {
    updateWorkflowSettings("literature-digest", {
      backendId: "skillrunner-local",
      workflowParams: { language: "zh-CN" },
      providerOptions: {
        engine: "gemini",
        model: "",
        no_cache: false,
      },
    });
    setRunOnceWorkflowOverrides("literature-digest", {
      backendId: "skillrunner-alt",
      workflowParams: { language: "en-US" },
      providerOptions: {
        engine: "gemini",
        model: "gemini-2.5-flash",
        no_cache: true,
      },
    });

    const defaults = resetRunOnceOverridesForSettingsOpen("literature-digest");
    assert.equal(defaults.backendId, "skillrunner-local");
    assert.equal(defaults.workflowParams?.language, "zh-CN");
    assert.equal(defaults.providerOptions?.model, "");
    assert.equal(defaults.providerOptions?.no_cache, false);

    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow);

    const context = await resolveWorkflowExecutionContext({
      workflow: workflow!,
      consumeRunOnce: true,
    });
    assert.equal(context.backend.id, "skillrunner-local");
    assert.equal(context.workflowParams.language, "zh-CN");
    assert.equal(context.providerOptions.model, "");
    assert.equal(context.providerOptions.no_cache, false);
  });

  it("uses latest persisted values for run-once defaults after persistent update", function () {
    updateWorkflowSettings("literature-digest", {
      backendId: "skillrunner-local",
      workflowParams: { language: "zh-CN" },
      providerOptions: {
        engine: "gemini",
        model: "",
        no_cache: false,
      },
    });
    setRunOnceWorkflowOverrides("literature-digest", {
      backendId: "skillrunner-alt",
      workflowParams: { language: "en-US" },
      providerOptions: {
        engine: "gemini",
        model: "gemini-2.5-flash",
        no_cache: true,
      },
    });
    const first = resetRunOnceOverridesForSettingsOpen("literature-digest");
    assert.equal(first.workflowParams?.language, "zh-CN");

    updateWorkflowSettings("literature-digest", {
      backendId: "skillrunner-alt",
      workflowParams: { language: "en-US" },
      providerOptions: {
        engine: "gemini",
        model: "gemini-2.5-flash",
        no_cache: true,
      },
    });
    setRunOnceWorkflowOverrides("literature-digest", {
      backendId: "skillrunner-local",
      workflowParams: { language: "zh-CN" },
      providerOptions: {
        engine: "gemini",
        model: "",
        no_cache: false,
      },
    });
    const second = resetRunOnceOverridesForSettingsOpen("literature-digest");
    assert.equal(second.backendId, "skillrunner-alt");
    assert.equal(second.workflowParams?.language, "en-US");
    assert.equal(second.providerOptions?.model, "gemini-2.5-flash");
    assert.equal(second.providerOptions?.no_cache, true);
  });

  it("resolves local pass-through execution context without backend profile", async function () {
    const root = await mkTempDir("zotero-skills-pass-through");
    const workflowRoot = joinPath(root, "pass-through-minimal");
    await writeUtf8(
      joinPath(workflowRoot, "workflow.json"),
      JSON.stringify(
        {
          id: "pass-through-minimal",
          label: "Pass Through Minimal",
          provider: "pass-through",
          hooks: {
            applyResult: "hooks/applyResult.js",
          },
        },
        null,
        2,
      ),
    );
    await writeUtf8(
      joinPath(workflowRoot, "hooks", "applyResult.js"),
      "export async function applyResult(){ return { ok: true }; }",
    );

    const loaded = await loadWorkflowManifests(root);
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "pass-through-minimal",
    );
    assert.isOk(workflow);

    const context = await resolveWorkflowExecutionContext({
      workflow: workflow!,
      consumeRunOnce: false,
    });
    assert.equal(context.providerId, "pass-through");
    assert.equal(context.backend.type, "pass-through");
    assert.equal(context.requestKind, "pass-through.run.v1");

    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Pass Through Parent" },
    });
    const selectionContext = await buildSelectionContext([parent]);
    const requests = (await executeBuildRequests({
      workflow: workflow!,
      selectionContext,
      executionOptions: {
        workflowParams: { hello: "world" },
      },
    })) as Array<{
      kind: string;
      selectionContext?: unknown;
      parameter?: Record<string, unknown>;
    }>;
    assert.lengthOf(requests, 1);
    assert.equal(requests[0].kind, "pass-through.run.v1");
    assert.isObject(requests[0].selectionContext);
    assert.deepEqual(requests[0].parameter, { hello: "world" });
  });

  it("applies persisted bbt port parameter for reference-matching workflow", async function () {
    await ensureWorkflowRegistryLoaded();
    updateWorkflowSettings("reference-matching", {
      workflowParams: {
        data_source: "bbt-json",
        bbt_port: 24119,
      },
    });

    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "reference-matching",
    );
    assert.isOk(workflow);

    const context = await resolveWorkflowExecutionContext({
      workflow: workflow!,
      consumeRunOnce: false,
    });
    assert.equal(context.workflowParams.data_source, "bbt-json");
    assert.equal(context.workflowParams.bbt_port, 24119);
  });

  it("falls back to default bbt port when persisted value is invalid", async function () {
    await ensureWorkflowRegistryLoaded();
    updateWorkflowSettings("reference-matching", {
      workflowParams: {
        data_source: "bbt-json",
        bbt_port: "invalid" as unknown as number,
      },
    });

    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "reference-matching",
    );
    assert.isOk(workflow);

    const context = await resolveWorkflowExecutionContext({
      workflow: workflow!,
      consumeRunOnce: false,
    });
    assert.equal(context.workflowParams.data_source, "bbt-json");
    assert.equal(context.workflowParams.bbt_port, 23119);
  });

  it("applies persisted bbt-lite citekey template for reference-matching workflow", async function () {
    await ensureWorkflowRegistryLoaded();
    updateWorkflowSettings("reference-matching", {
      workflowParams: {
        citekey_template:
          "auth.lower + '_' + title.nopunct.skipwords.select(1,1).lower + '-' + title.nopunct.skipwords.select(2,1).lower + '_' + year",
      },
    });

    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "reference-matching",
    );
    assert.isOk(workflow);

    const context = await resolveWorkflowExecutionContext({
      workflow: workflow!,
      consumeRunOnce: false,
    });
    assert.equal(
      context.workflowParams.citekey_template,
      "auth.lower + '_' + title.nopunct.skipwords.select(1,1).lower + '-' + title.nopunct.skipwords.select(2,1).lower + '_' + year",
    );
  });

  it("rejects invalid bbt-lite citekey template and falls back to last valid/default", async function () {
    await ensureWorkflowRegistryLoaded();
    updateWorkflowSettings("reference-matching", {
      workflowParams: {
        citekey_template: "auth.lower + '_' + year",
      },
    });
    updateWorkflowSettings("reference-matching", {
      workflowParams: {
        citekey_template: "auth.lower + (",
      },
    });

    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "reference-matching",
    );
    assert.isOk(workflow);

    const context = await resolveWorkflowExecutionContext({
      workflow: workflow!,
      consumeRunOnce: false,
    });
    assert.equal(context.workflowParams.citekey_template, "auth.lower + '_' + year");

    clearWorkflowSettings("reference-matching");
    updateWorkflowSettings("reference-matching", {
      workflowParams: {
        citekey_template: "title.unknown() + '_' + year",
      },
    });
    const fallbackContext = await resolveWorkflowExecutionContext({
      workflow: workflow!,
      consumeRunOnce: false,
    });
    assert.equal(
      fallbackContext.workflowParams.citekey_template,
      "{author}_{title}_{year}",
    );
  });
});
