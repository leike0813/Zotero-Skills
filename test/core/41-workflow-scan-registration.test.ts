import { assert } from "chai";
import { config } from "../../package.json";
import hooks from "../../src/hooks";
import {
  ensureDefaultWorkflowDirExistsOnStartup,
  getBuiltinWorkflowDir,
  getDefaultWorkflowDir,
  getEffectiveWorkflowDir,
  getLoadedWorkflowEntries,
  getWorkflowRegistryState,
  rescanWorkflowRegistry,
} from "../../src/modules/workflowRuntime";
import { syncBuiltinWorkflowsOnStartup } from "../../src/modules/builtinWorkflowSync";
import { existsPath, joinPath, workflowsPath } from "./workflow-test-utils";

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

  it("keeps user workflow dir default separate from built-in dir and registers literature-digest", async function () {
    const processEnv =
      (globalThis as { process?: { env?: Record<string, string | undefined> } })
        .process?.env;
    if (processEnv) {
      delete processEnv.ZOTERO_TEST_WORKFLOW_DIR;
    }
    (
      globalThis as {
        __zoteroSkillsDisableWorkflowDirOverride?: boolean;
      }
    ).__zoteroSkillsDisableWorkflowDirOverride = true;

    await syncBuiltinWorkflowsOnStartup();
    const configuredDir = getDefaultWorkflowDir();
    assert.equal(getEffectiveWorkflowDir(), configuredDir);
    assert.equal(Zotero.Prefs.get(workflowDirPrefKey, true), configuredDir);

    const state = await rescanWorkflowRegistry();
    const workflow = state.loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    const builtinDir = getBuiltinWorkflowDir();

    assert.equal(state.workflowsDir, configuredDir);
    assert.equal(state.builtinWorkflowsDir, builtinDir);
    assert.notEqual(state.workflowsDir, state.builtinWorkflowsDir);
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

  it("creates default user workflow directory on startup path and does not fallback to built-in source directory", async function () {
    const processEnv =
      (globalThis as { process?: { env?: Record<string, string | undefined> } })
        .process?.env;
    if (processEnv) {
      delete processEnv.ZOTERO_TEST_WORKFLOW_DIR;
    }

    (Zotero as unknown as { DataDirectory?: { dir?: string } }).DataDirectory = {
      dir: joinPath(workflowsPath(), "..", "non-existing-zotero-data"),
    };

    (
      globalThis as {
        __zoteroSkillsDisableWorkflowDirOverride?: boolean;
      }
    ).__zoteroSkillsDisableWorkflowDirOverride = true;

    Zotero.Prefs.clear(workflowDirPrefKey, true);

    const expectedDefault = joinPath(
      (Zotero as unknown as { DataDirectory: { dir: string } }).DataDirectory.dir,
      "zotero-skills",
      "workflows",
    );
    const created = await ensureDefaultWorkflowDirExistsOnStartup();
    assert.isTrue(created || (await existsPath(expectedDefault)));
    const existedAfter = await existsPath(expectedDefault);
    assert.isTrue(existedAfter, `expected directory created: ${expectedDefault}`);

    const state = await rescanWorkflowRegistry();

    assert.equal(state.workflowsDir, expectedDefault);
    assert.equal(Zotero.Prefs.get(workflowDirPrefKey, true), expectedDefault);
    assert.notEqual(state.workflowsDir, getBuiltinWorkflowDir());
    assert.lengthOf(state.loaded.workflows, 0);
    assert.isTrue(
      state.loaded.errors.every((entry) => !String(entry || "").includes(expectedDefault)),
      `errors=${JSON.stringify(state.loaded.errors)}`,
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

    const invalidDir = `${getDefaultWorkflowDir()}-missing`;
    await hooks.onPrefsEvent("scanWorkflows", {
      window,
      workflowsDir: invalidDir,
    });

    assert.lengthOf(alerts, 1);
    assert.match(
      alerts[0],
      /^Workflow scan finished: loaded=\d+, warnings=\d+, errors=\d+/,
    );
    assert.include(alerts[0], "First error:");
    assert.include(alerts[0], invalidDir);
    const errorsMatch = alerts[0].match(/errors=(\d+)/);
    assert.isOk(errorsMatch);
    assert.isAtLeast(Number(errorsMatch![1]), 1);

    const state = getWorkflowRegistryState();
    assert.equal(state.workflowsDir, invalidDir);
    assert.isAtLeast(state.loaded.workflows.length, 0);
    assert.isAtLeast(state.loaded.errors.length, 1);
  });
});
