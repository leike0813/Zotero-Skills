import { assert } from "chai";
import { config } from "../../package.json";
import { handlers } from "../../src/handlers";
import { buildSelectionContext } from "../../src/modules/selectionContext";
import {
  clearRunOnceWorkflowOverrides,
  clearWorkflowSettings,
  resolveWorkflowExecutionContext,
  setRunOnceWorkflowOverrides,
  updateWorkflowSettings,
} from "../../src/modules/workflowSettings";
import { executeBuildRequests } from "../../src/workflows/runtime";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import { fixturePath, workflowsPath } from "./workflow-test-utils";

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
  });

  afterEach(function () {
    clearRunOnceWorkflowOverrides("literature-digest");
    clearWorkflowSettings("literature-digest");
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
});
