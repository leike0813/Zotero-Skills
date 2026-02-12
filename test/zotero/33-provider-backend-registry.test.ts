import { assert } from "chai";
import { config } from "../../package.json";
import {
  loadBackendsRegistry,
  resolveBackendForWorkflow,
} from "../../src/backends/registry";
import { resolveProvider } from "../../src/providers/registry";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import type { LoadedWorkflow } from "../../src/workflows/types";
import { workflowsPath } from "./workflow-test-utils";
import { PASS_THROUGH_REQUEST_KIND } from "../../src/config/defaults";

function buildWorkflow(args: {
  id: string;
  provider?: string;
  requestKind: string;
}): LoadedWorkflow {
  return {
    manifest: {
      id: args.id,
      label: args.id,
      provider: args.provider,
      request: {
        kind: args.requestKind,
      },
      hooks: {
        applyResult: "hooks/applyResult.js",
      },
    },
    rootDir: "test-workflow",
    hooks: {
      applyResult: async () => ({ ok: true }),
    },
    buildStrategy: "declarative",
  };
}

describe("provider/backend registry", function () {
  const backendsConfigPrefKey = `${config.prefsPrefix}.backendsConfigJson`;
  const endpointPrefKey = `${config.prefsPrefix}.skillRunnerEndpoint`;
  let prevBackendsConfigPref: unknown;
  let prevEndpointPref: unknown;

  function setBackendsConfig(configValue: unknown) {
    Zotero.Prefs.set(
      backendsConfigPrefKey,
      JSON.stringify(configValue),
      true,
    );
  }

  beforeEach(function () {
    prevBackendsConfigPref = Zotero.Prefs.get(backendsConfigPrefKey, true);
    prevEndpointPref = Zotero.Prefs.get(endpointPrefKey, true);

    setBackendsConfig({
      backends: [
        {
          id: "skillrunner-local",
          type: "skillrunner",
          baseUrl: "http://127.0.0.1:8030",
          auth: { kind: "none" },
          defaults: {
            headers: {},
            timeout_ms: 600000,
          },
        },
        {
          id: "generic-http-local",
          type: "generic-http",
          baseUrl: "http://127.0.0.1:8030",
          auth: { kind: "none" },
          defaults: {
            headers: {},
            timeout_ms: 600000,
          },
        },
      ],
    });
    Zotero.Prefs.set(endpointPrefKey, "http://127.0.0.1:8030", true);
  });

  afterEach(function () {
    if (typeof prevBackendsConfigPref === "undefined") {
      Zotero.Prefs.clear(backendsConfigPrefKey, true);
    } else {
      Zotero.Prefs.set(backendsConfigPrefKey, prevBackendsConfigPref, true);
    }
    if (typeof prevEndpointPref === "undefined") {
      Zotero.Prefs.clear(endpointPrefKey, true);
    } else {
      Zotero.Prefs.set(endpointPrefKey, prevEndpointPref, true);
    }
  });

  it("loads backends from prefs and keeps valid entries", async function () {
    const loaded = await loadBackendsRegistry();
    assert.isUndefined(loaded.fatalError);
    assert.isAtLeast(loaded.backends.length, 2);
    assert.isOk(loaded.backends.find((entry) => entry.id === "skillrunner-local"));
    assert.isOk(loaded.backends.find((entry) => entry.id === "generic-http-local"));
  });

  it("resolves first provider-compatible backend when no preferred profile is set", async function () {
    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "workflow literature-digest not found");

    const backend = await resolveBackendForWorkflow(workflow!);
    assert.equal(backend.id, "skillrunner-local");
    assert.equal(backend.type, "skillrunner");
    assert.equal(backend.baseUrl, "http://127.0.0.1:8030");
  });

  it("resolves provider by request kind and backend type", async function () {
    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "workflow literature-digest not found");

    const backend = await resolveBackendForWorkflow(workflow!);
    const provider = resolveProvider({
      requestKind: workflow!.manifest.request!.kind,
      backend,
    });

    assert.equal(provider.id, "skillrunner");
  });

  it("throws when no provider supports request kind for backend", async function () {
    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "workflow literature-digest not found");

    const backend = await resolveBackendForWorkflow(workflow!);
    assert.throws(
      () =>
        resolveProvider({
          requestKind: "unsupported.kind",
          backend,
        }),
      /No provider found/,
    );
  });

  it("resolves and executes pass-through provider with unified result model", async function () {
    const provider = resolveProvider({
      requestKind: PASS_THROUGH_REQUEST_KIND,
      backend: {
        id: "pass-through-local",
        type: "pass-through",
        baseUrl: "local://pass-through",
        auth: { kind: "none" },
      },
    });
    assert.equal(provider.id, "pass-through");

    const result = await provider.execute({
      requestKind: PASS_THROUGH_REQUEST_KIND,
      backend: {
        id: "pass-through-local",
        type: "pass-through",
        baseUrl: "local://pass-through",
        auth: { kind: "none" },
      },
      request: {
        kind: PASS_THROUGH_REQUEST_KIND,
        targetParentID: 10,
        taskName: "pass-through-test",
        sourceAttachmentPaths: [],
        selectionContext: {
          selectionType: "parent",
          items: { parents: [{ item: { id: 10 } }] },
        },
        parameter: {
          foo: "bar",
        },
      },
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.fetchType, "result");
    assert.isObject(result.resultJson);
    assert.equal(
      (result.resultJson as { kind?: string }).kind,
      PASS_THROUGH_REQUEST_KIND,
    );
    assert.deepEqual(
      (result.resultJson as { parameter?: Record<string, unknown> }).parameter,
      { foo: "bar" },
    );
  });

  it("blocks all workflows when backends prefs JSON is invalid", async function () {
    Zotero.Prefs.set(backendsConfigPrefKey, "{invalid", true);
    const workflow = buildWorkflow({
      id: "invalid-backends-check",
      provider: "skillrunner",
      requestKind: "skillrunner.job.v1",
    });

    let thrown: unknown;
    try {
      await resolveBackendForWorkflow(workflow);
    } catch (error) {
      thrown = error;
    }
    assert.isOk(thrown);
    assert.match(String(thrown), /Invalid backends JSON/);
  });

  it("only disables workflows that bind to invalid backend entries", async function () {
    setBackendsConfig({
      backends: [
        {
          id: "skillrunner-local",
          type: "skillrunner",
          baseUrl: "http://127.0.0.1:8030",
          auth: { kind: "none" },
        },
        {
          id: "generic-http-local",
          type: "generic-http",
          baseUrl: "http://127.0.0.1:8030",
          auth: { kind: "none" },
        },
        {
          id: "broken-backend",
          type: "generic-http",
          auth: { kind: "none" },
        },
      ],
    });
    const loaded = await loadBackendsRegistry();
    assert.isUndefined(loaded.fatalError);
    assert.isAtLeast(loaded.errors.length, 1);
    assert.isOk(loaded.invalidBackends["broken-backend"]);

    const validWorkflow = buildWorkflow({
      id: "generic-http-ok",
      provider: "generic-http",
      requestKind: "generic-http.request.v1",
    });
    const validBackend = await resolveBackendForWorkflow(validWorkflow, {
      preferredBackendId: "generic-http-local",
    });
    assert.equal(validBackend.id, "generic-http-local");

    const invalidWorkflow = buildWorkflow({
      id: "generic-http-broken",
      provider: "generic-http",
      requestKind: "generic-http.request.v1",
    });
    let thrown: unknown;
    try {
      await resolveBackendForWorkflow(invalidWorkflow, {
        preferredBackendId: "broken-backend",
      });
    } catch (error) {
      thrown = error;
    }
    assert.isOk(thrown);
    assert.match(String(thrown), /is invalid|Unknown backendId/);
  });

  it("migrates legacy skillRunnerEndpoint on first load when backend prefs are empty", async function () {
    Zotero.Prefs.clear(backendsConfigPrefKey, true);
    Zotero.Prefs.set(endpointPrefKey, "http://127.0.0.1:18030", true);

    const loaded = await loadBackendsRegistry();
    assert.isUndefined(loaded.fatalError);
    const backend = loaded.backends.find((entry) => entry.id === "skillrunner-local");
    assert.isOk(backend);
    assert.equal(backend?.baseUrl, "http://127.0.0.1:18030");
  });
});
