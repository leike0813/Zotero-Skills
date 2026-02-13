import { assert } from "chai";
import { config } from "../../package.json";
import hooks from "../../src/hooks";
import {
  getEffectiveWorkflowDir,
  getLoadedWorkflowEntries,
  getWorkflowRegistryState,
  rescanWorkflowRegistry,
} from "../../src/modules/workflowRuntime";
import { joinPath, workflowsPath } from "./workflow-test-utils";

function getRuntimeCwd() {
  const runtime = globalThis as {
    process?: { cwd?: () => string };
    Services?: { dirsvc?: { get?: (key: string, iface: unknown) => { path?: string } } };
    Ci?: { nsIFile?: unknown };
  };
  if (typeof runtime.process?.cwd === "function") {
    return runtime.process.cwd();
  }
  if (runtime.Services?.dirsvc?.get && runtime.Ci?.nsIFile) {
    const file = runtime.Services.dirsvc.get("CurWorkD", runtime.Ci.nsIFile);
    if (file?.path) {
      return file.path;
    }
  }
  return "";
}

function getExpectedTestWorkflowDir() {
  const runtime = globalThis as {
    process?: { env?: Record<string, string | undefined> };
    Services?: { env?: { get?: (key: string) => string } };
  };
  const fromProcess = runtime.process?.env?.ZOTERO_TEST_WORKFLOW_DIR;
  if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
    return fromProcess.trim();
  }
  if (typeof runtime.Services?.env?.get === "function") {
    try {
      const fromServices = runtime.Services.env.get("ZOTERO_TEST_WORKFLOW_DIR");
      if (typeof fromServices === "string" && fromServices.trim().length > 0) {
        return fromServices.trim();
      }
    } catch {
      // ignore
    }
  }
  const cwd = getRuntimeCwd();
  if (!cwd) {
    return workflowsPath();
  }
  return joinPath(cwd, "workflows");
}

describe("workflow scan + registry integration", function () {
  const workflowDirPrefKey = `${config.prefsPrefix}.workflowDir`;

  let prevAddon: unknown;
  let prevWorkflowDirPref: unknown;
  let prevDataDirectory: unknown;
  let prevTestWorkflowDirEnv: string | undefined;
  let prevDisableWorkflowDirOverride: boolean | undefined;

  beforeEach(function () {
    const runtime = globalThis as { addon?: unknown };
    prevAddon = runtime.addon;
    runtime.addon = {
      data: {
        config,
      },
    };

    prevDataDirectory = (Zotero as unknown as { DataDirectory?: unknown }).DataDirectory;
    prevTestWorkflowDirEnv =
      (globalThis as { process?: { env?: Record<string, string | undefined> } })
        .process?.env?.ZOTERO_TEST_WORKFLOW_DIR;
    prevDisableWorkflowDirOverride = (
      globalThis as {
        __zoteroSkillsDisableWorkflowDirOverride?: boolean;
      }
    ).__zoteroSkillsDisableWorkflowDirOverride;

    prevWorkflowDirPref = Zotero.Prefs.get(workflowDirPrefKey, true);
    Zotero.Prefs.clear(workflowDirPrefKey, true);
  });

  afterEach(function () {
    if (typeof prevWorkflowDirPref === "undefined") {
      Zotero.Prefs.clear(workflowDirPrefKey, true);
    } else {
      Zotero.Prefs.set(workflowDirPrefKey, prevWorkflowDirPref, true);
    }
    const runtime = globalThis as { addon?: unknown };
    runtime.addon = prevAddon;

    const zoteroRuntime = Zotero as unknown as { DataDirectory?: unknown };
    zoteroRuntime.DataDirectory = prevDataDirectory as
      | { dir?: string }
      | undefined;

    const processEnv =
      (globalThis as { process?: { env?: Record<string, string | undefined> } })
        .process?.env;
    if (processEnv) {
      if (typeof prevTestWorkflowDirEnv === "undefined") {
        delete processEnv.ZOTERO_TEST_WORKFLOW_DIR;
      } else {
        processEnv.ZOTERO_TEST_WORKFLOW_DIR = prevTestWorkflowDirEnv;
      }
    }

    (
      globalThis as {
        __zoteroSkillsDisableWorkflowDirOverride?: boolean;
      }
    ).__zoteroSkillsDisableWorkflowDirOverride =
      prevDisableWorkflowDirOverride;
  });

  it("uses ${cwd}/workflows in tests and registers literature-digest", async function () {
    const configuredDir = getExpectedTestWorkflowDir();
    assert.equal(getEffectiveWorkflowDir(), configuredDir);
    assert.equal(Zotero.Prefs.get(workflowDirPrefKey, true), configuredDir);

    const state = await rescanWorkflowRegistry();
    const workflow = state.loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );

    assert.equal(state.workflowsDir, configuredDir);
    assert.isOk(
      workflow,
      `workflows=${state.loaded.workflows.map((entry) => entry.manifest.id).join(",")} warnings=${JSON.stringify(state.loaded.warnings)} errors=${JSON.stringify(state.loaded.errors)}`,
    );
    assert.equal(workflow?.manifest.label, "Literature Digest");
    assert.isFunction(workflow?.hooks.applyResult);
    assert.isFunction(workflow?.hooks.filterInputs);
    assert.isAtLeast(state.loaded.manifests.length, 1);
    assert.isAtLeast((state.loaded.diagnostics || []).length, 0);

    const entries = getLoadedWorkflowEntries();
    assert.isAtLeast(entries.length, 1);
    assert.isOk(entries.find((entry) => entry.manifest.id === "literature-digest"));
    assert.equal(getWorkflowRegistryState().workflowsDir, configuredDir);
  });

  it("does not fallback to ${cwd}/workflows when default data directory has no workflows", async function () {
    const processEnv =
      (globalThis as { process?: { env?: Record<string, string | undefined> } })
        .process?.env;
    if (processEnv) {
      delete processEnv.ZOTERO_TEST_WORKFLOW_DIR;
    }

    (Zotero as unknown as { DataDirectory?: { dir?: string } }).DataDirectory = {
      dir: joinPath(getExpectedTestWorkflowDir(), "..", "non-existing-zotero-data"),
    };

    (
      globalThis as {
        __zoteroSkillsDisableWorkflowDirOverride?: boolean;
      }
    ).__zoteroSkillsDisableWorkflowDirOverride = true;

    Zotero.Prefs.clear(workflowDirPrefKey, true);

    const state = await rescanWorkflowRegistry();
    const expectedDefault = joinPath(
      (Zotero as unknown as { DataDirectory: { dir: string } }).DataDirectory.dir,
      "zotero-skills",
      "workflows",
    );

    assert.equal(state.workflowsDir, expectedDefault);
    assert.equal(Zotero.Prefs.get(workflowDirPrefKey, true), expectedDefault);
    assert.lengthOf(state.loaded.workflows, 0);
    assert.lengthOf(state.loaded.errors, 1);
    assert.include(state.loaded.errors[0], expectedDefault);
    assert.isTrue(
      (state.loaded.diagnostics || []).some(
        (entry) => entry.category === "scan_path_error",
      ),
      `diagnostics=${JSON.stringify(state.loaded.diagnostics || [])}`,
    );
  });

  it("scans via prefs event and reports summary message", async function () {
    const alerts: string[] = [];
    const window = {
      alert: (message: string) => {
        alerts.push(message);
      },
    } as unknown as Window;

    await hooks.onPrefsEvent("scanWorkflows", { window });

    assert.lengthOf(alerts, 1);
    assert.match(
      alerts[0],
      /^Workflow scan finished: loaded=\d+, warnings=\d+, errors=\d+/,
    );

    const loadedMatch = alerts[0].match(/loaded=(\d+)/);
    assert.isOk(loadedMatch);
    assert.isAtLeast(Number(loadedMatch![1]), 1);

    const entries = getLoadedWorkflowEntries();
    assert.isOk(entries.find((entry) => entry.manifest.id === "literature-digest"));
  });

  it("shows first error detail when scan target directory is invalid", async function () {
    const alerts: string[] = [];
    const window = {
      alert: (message: string) => {
        alerts.push(message);
      },
    } as unknown as Window;

    const invalidDir = `${getExpectedTestWorkflowDir()}-missing`;
    await hooks.onPrefsEvent("scanWorkflows", {
      window,
      workflowsDir: invalidDir,
    });

    assert.lengthOf(alerts, 1);
    assert.match(alerts[0], /^Workflow scan finished: loaded=0, warnings=0, errors=1/);
    assert.include(alerts[0], "First error:");
    assert.include(alerts[0], invalidDir);

    const state = getWorkflowRegistryState();
    assert.equal(state.workflowsDir, invalidDir);
    assert.lengthOf(state.loaded.workflows, 0);
    assert.lengthOf(state.loaded.errors, 1);
  });
});
