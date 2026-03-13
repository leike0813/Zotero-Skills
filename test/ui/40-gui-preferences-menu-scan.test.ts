import { assert } from "chai";
import { config } from "../../package.json";
import { handlers } from "../../src/handlers";
import { registerPrefsScripts } from "../../src/modules/preferenceScript";
import { ensureWorkflowMenuForWindow } from "../../src/modules/workflowMenu";
import {
  getEffectiveWorkflowDir,
  getLoadedWorkflowEntries,
  getWorkflowRegistryState,
  rescanWorkflowRegistry,
} from "../../src/modules/workflowRuntime";
import type { LoadedWorkflow } from "../../src/workflows/types";
import { joinPath, mkTempDir, writeUtf8 } from "./workflow-test-utils";
import { isFullTestMode } from "../zotero/testMode";

type Listener = (event: Record<string, unknown>) => void;

class FakeXULElement {
  private attrs = new Map<string, string>();
  private listeners = new Map<string, Listener[]>();
  private _id = "";

  public value = "";
  public textContent = "";
  public parentNode: FakeXULElement | null = null;
  public children: FakeXULElement[] = [];

  constructor(
    private readonly owner: FakeDocument,
    public readonly tagName: string,
  ) {}

  get id() {
    return this._id;
  }

  set id(value: string) {
    this._id = value;
    this.attrs.set("id", value);
    this.owner.register(this);
  }

  get firstChild() {
    return this.children[0] || null;
  }

  appendChild(child: FakeXULElement) {
    child.parentNode = this;
    this.children.push(child);
    if (child.id) {
      this.owner.register(child);
    }
    return child;
  }

  removeChild(child: FakeXULElement) {
    this.children = this.children.filter((entry) => entry !== child);
    child.parentNode = null;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
    this.owner.unregister(this.id);
  }

  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
    if (name === "id") {
      this.id = value;
    }
  }

  getAttribute(name: string) {
    return this.attrs.get(name) || null;
  }

  removeAttribute(name: string) {
    this.attrs.delete(name);
  }

  addEventListener(type: string, listener: Listener) {
    const existing = this.listeners.get(type) || [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  dispatch(type: string, init: Record<string, unknown> = {}) {
    const listeners = this.listeners.get(type) || [];
    const event = {
      type,
      target: this,
      ...init,
    };
    for (const listener of listeners) {
      listener(event);
    }
  }
}

class FakeDocument {
  private elements = new Map<string, FakeXULElement>();

  createXULElement(tagName: string) {
    return new FakeXULElement(this, tagName);
  }

  register(element: FakeXULElement) {
    if (element.id) {
      this.elements.set(element.id, element);
    }
  }

  unregister(id: string) {
    if (!id) {
      return;
    }
    this.elements.delete(id);
  }

  getElementById(id: string) {
    return this.elements.get(id) || null;
  }

  querySelector(selector: string) {
    if (!selector.startsWith("#")) {
      return null;
    }
    return this.getElementById(selector.slice(1));
  }
}

function makeLoadedWorkflow(id: string, label: string): LoadedWorkflow {
  return {
    manifest: {
      id,
      label,
      provider: "skillrunner",
      request: {
        kind: "skillrunner.job.v1",
      },
      hooks: {
        applyResult: "hooks/applyResult.js",
      },
    },
    rootDir: joinPath("workflows", id),
    hooks: {
      applyResult: async () => ({ ok: true }),
    },
    buildStrategy: "declarative",
  };
}

function makePassThroughWorkflow(id: string, label: string): LoadedWorkflow {
  return {
    manifest: {
      id,
      label,
      provider: "pass-through",
      hooks: {
        applyResult: "hooks/applyResult.js",
      },
    },
    rootDir: joinPath("workflows", id),
    hooks: {
      applyResult: async () => ({ ok: true }),
    },
    buildStrategy: "declarative",
  };
}

function setWorkflowState(workflows: LoadedWorkflow[]) {
  const runtime = globalThis as {
    addon: {
      data: {
        workflow?: {
          workflowsDir: string;
          loaded: {
            workflows: LoadedWorkflow[];
            manifests: Array<LoadedWorkflow["manifest"]>;
            warnings: string[];
            errors: string[];
          };
        };
      };
    };
  };
  runtime.addon.data.workflow = {
    workflowsDir: "test-workflows",
    loaded: {
      workflows,
      manifests: workflows.map((entry) => entry.manifest),
      warnings: [],
      errors: [],
    },
  };
}

function createPrefsWindow() {
  const document = new FakeDocument();

  const workflowDirInput = document.createXULElement("input");
  workflowDirInput.id = `zotero-prefpane-${config.addonRef}-workflow-dir`;

  const scanButton = document.createXULElement("button");
  scanButton.id = `zotero-prefpane-${config.addonRef}-workflow-scan`;
  const workflowSettingsButton = document.createXULElement("button");
  workflowSettingsButton.id = `zotero-prefpane-${config.addonRef}-workflow-settings`;

  const backendManageButton = document.createXULElement("button");
  backendManageButton.id = `zotero-prefpane-${config.addonRef}-backend-manage`;
  const localRuntimeVersionInput = document.createXULElement("input");
  localRuntimeVersionInput.id =
    `zotero-prefpane-${config.addonRef}-skillrunner-local-version`;
  const localRuntimeDeployButton = document.createXULElement("button");
  localRuntimeDeployButton.id =
    `zotero-prefpane-${config.addonRef}-skillrunner-local-deploy`;
  const localRuntimeStatusButton = document.createXULElement("button");
  localRuntimeStatusButton.id =
    `zotero-prefpane-${config.addonRef}-skillrunner-local-status`;
  const localRuntimeStartButton = document.createXULElement("button");
  localRuntimeStartButton.id =
    `zotero-prefpane-${config.addonRef}-skillrunner-local-start`;
  const localRuntimeStopButton = document.createXULElement("button");
  localRuntimeStopButton.id =
    `zotero-prefpane-${config.addonRef}-skillrunner-local-stop`;
  const localRuntimeUninstallButton = document.createXULElement("button");
  localRuntimeUninstallButton.id =
    `zotero-prefpane-${config.addonRef}-skillrunner-local-uninstall`;
  const localRuntimeDoctorButton = document.createXULElement("button");
  localRuntimeDoctorButton.id =
    `zotero-prefpane-${config.addonRef}-skillrunner-local-doctor`;
  const localRuntimeCopyCommandsButton = document.createXULElement("button");
  localRuntimeCopyCommandsButton.id =
    `zotero-prefpane-${config.addonRef}-skillrunner-local-copy-commands`;
  const localRuntimeOpenDebugConsoleButton = document.createXULElement("button");
  localRuntimeOpenDebugConsoleButton.id =
    `zotero-prefpane-${config.addonRef}-skillrunner-local-open-debug-console`;
  const localRuntimeAutoPullToggleButton = document.createXULElement("button");
  localRuntimeAutoPullToggleButton.id =
    `zotero-prefpane-${config.addonRef}-skillrunner-local-auto-pull-toggle`;
  const localRuntimeStatusText = document.createXULElement("description");
  localRuntimeStatusText.id =
    `zotero-prefpane-${config.addonRef}-skillrunner-local-status-text`;
  const localRuntimeStateText = document.createXULElement("description");
  localRuntimeStateText.id =
    `zotero-prefpane-${config.addonRef}-skillrunner-local-state-text`;

  return {
    window: { document } as unknown as Window,
    workflowDirInput,
    scanButton,
    workflowSettingsButton,
    backendManageButton,
    localRuntimeVersionInput,
    localRuntimeDeployButton,
    localRuntimeStatusButton,
    localRuntimeStartButton,
    localRuntimeStopButton,
    localRuntimeUninstallButton,
    localRuntimeDoctorButton,
    localRuntimeCopyCommandsButton,
    localRuntimeOpenDebugConsoleButton,
    localRuntimeAutoPullToggleButton,
    localRuntimeStatusText,
    localRuntimeStateText,
  };
}

function createMainWindow(selectedItems: unknown[]) {
  const document = new FakeDocument();
  const itemMenu = document.createXULElement("menupopup");
  itemMenu.id = "zotero-itemmenu";

  return {
    document,
    ZoteroPane: {
      getSelectedItems: () => selectedItems,
    },
  } as unknown as _ZoteroTypes.MainWindow;
}

async function flushTasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function assertMenuLabel(
  actual: string | null,
  options: readonly string[],
  context: string,
) {
  assert.isString(actual, `${context} should be a string`);
  assert.include(options, actual as string, `${context} should match locale`);
}

const itFullOnly = isFullTestMode() ? it : it.skip;

describe("gui: preference scripts", function () {
  const workflowDirPrefKey = `${config.prefsPrefix}.workflowDir`;

  let prevAddon: unknown;
  let prevWorkflowDirPref: unknown;

  beforeEach(function () {
    const runtime = globalThis as { addon?: unknown };
    prevAddon = runtime.addon;
    prevWorkflowDirPref = Zotero.Prefs.get(workflowDirPrefKey, true);
    runtime.addon = {
      data: {
        config,
      },
      hooks: {
        onPrefsEvent: async () => {},
      },
    };
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
  });

  it("binds preference inputs and dispatches workflow scan/settings/backend manager commands", async function () {
    const calls: Array<{ type: string; data: unknown }> = [];
    (globalThis as { addon: { hooks: { onPrefsEvent: (type: string, data: unknown) => Promise<void> } } }).addon.hooks.onPrefsEvent =
      async (type, data) => {
        calls.push({ type, data });
      };

    const {
      window,
      workflowDirInput,
      scanButton,
      workflowSettingsButton,
      backendManageButton,
    } = createPrefsWindow();
    await registerPrefsScripts(window);
    assert.lengthOf(calls, 1);
    assert.equal(calls[0].type, "stateSkillRunnerLocalRuntime");
    assert.deepEqual(calls[0].data, {
      window,
    });

    assert.isNotEmpty(workflowDirInput.value);
    assert.equal(Zotero.Prefs.get(workflowDirPrefKey, true), workflowDirInput.value);

    workflowDirInput.value = "D:/tmp/workflows-custom";
    workflowDirInput.dispatch("change", { target: workflowDirInput });
    assert.equal(workflowDirInput.value, "D:/tmp/workflows-custom");
    assert.equal(
      Zotero.Prefs.get(workflowDirPrefKey, true),
      "D:/tmp/workflows-custom",
    );

    const directScanWorkflowDir = "D:/tmp/workflows-scan-direct";
    workflowDirInput.value = directScanWorkflowDir;
    scanButton.dispatch("command");
    assert.equal(Zotero.Prefs.get(workflowDirPrefKey, true), directScanWorkflowDir);
    assert.lengthOf(calls, 2);
    assert.equal(calls[1].type, "scanWorkflows");
    assert.deepEqual(calls[1].data, {
      window,
      workflowsDir: directScanWorkflowDir,
    });

    workflowDirInput.value = "  ";
    scanButton.dispatch("command");
    assert.lengthOf(calls, 3);
    assert.equal(calls[2].type, "scanWorkflows");
    assert.equal((calls[2].data as { workflowsDir?: string }).workflowsDir, undefined);
    assert.isNotEmpty(workflowDirInput.value);
    assert.equal(Zotero.Prefs.get(workflowDirPrefKey, true), workflowDirInput.value);

    workflowSettingsButton.dispatch("command");
    assert.lengthOf(calls, 4);
    assert.equal(calls[3].type, "openWorkflowSettings");
    assert.deepEqual(calls[3].data, {
      window,
      source: "preferences",
    });

    backendManageButton.dispatch("command");
    assert.lengthOf(calls, 5);
    assert.equal(calls[4].type, "openBackendManager");
    assert.deepEqual(calls[4].data, {
      window,
    });
  });

  it("binds local runtime controls and dispatches deploy/status/start/stop/uninstall/doctor actions", async function () {
    const calls: Array<{ type: string; data: unknown }> = [];
    const copyPayloads: string[] = [];
    const runtime = globalThis as {
      Zotero?: {
        Utilities?: {
          Internal?: {
            copyTextToClipboard?: (value: string) => void;
          };
        };
      };
    };
    const previousCopy = runtime.Zotero?.Utilities?.Internal?.copyTextToClipboard;
    if (!runtime.Zotero) {
      runtime.Zotero = {};
    }
    if (!runtime.Zotero.Utilities) {
      runtime.Zotero.Utilities = {};
    }
    if (!runtime.Zotero.Utilities.Internal) {
      runtime.Zotero.Utilities.Internal = {};
    }
    runtime.Zotero.Utilities.Internal.copyTextToClipboard = (value: string) => {
      copyPayloads.push(value);
    };
    (
      globalThis as {
        addon: {
          hooks: {
            onPrefsEvent: (type: string, data: unknown) => Promise<unknown>;
          };
        };
      }
    ).addon.hooks.onPrefsEvent = async (type, data) => {
      calls.push({ type, data });
      if (type === "copySkillRunnerLocalDeployCommands") {
        return {
          ok: true,
          message: "manual commands generated",
          details: {
            commands: "echo test",
          },
        };
      }
      return {
        ok: true,
        message: `ok-${type}`,
      };
    };

    const versionPrefKey = `${config.prefsPrefix}.skillRunnerLocalRuntimeVersion`;
    Zotero.Prefs.clear(versionPrefKey, true);

    try {
      const {
        window,
        localRuntimeVersionInput,
        localRuntimeDeployButton,
        localRuntimeStatusButton,
        localRuntimeStartButton,
        localRuntimeStopButton,
        localRuntimeUninstallButton,
        localRuntimeDoctorButton,
        localRuntimeCopyCommandsButton,
        localRuntimeOpenDebugConsoleButton,
        localRuntimeAutoPullToggleButton,
        localRuntimeStatusText,
      } = createPrefsWindow();
      await registerPrefsScripts(window);

      assert.isNotEmpty(localRuntimeVersionInput.value);
      localRuntimeVersionInput.value = "v9.9.9";
      localRuntimeVersionInput.dispatch("change", { target: localRuntimeVersionInput });
      assert.equal(
        Zotero.Prefs.get(versionPrefKey, true),
        "v9.9.9",
      );

      localRuntimeDeployButton.dispatch("command");
      await flushTasks();
      await flushTasks();
      localRuntimeStatusButton.dispatch("command");
      await flushTasks();
      localRuntimeStartButton.dispatch("command");
      await flushTasks();
      localRuntimeStopButton.dispatch("command");
      await flushTasks();
      localRuntimeUninstallButton.dispatch("command");
      await flushTasks();
      localRuntimeDoctorButton.dispatch("command");
      await flushTasks();
      localRuntimeCopyCommandsButton.dispatch("command");
      await flushTasks();
      localRuntimeOpenDebugConsoleButton.dispatch("command");
      await flushTasks();
      localRuntimeAutoPullToggleButton.dispatch("command");
      await flushTasks();

      assert.equal(calls[0].type, "stateSkillRunnerLocalRuntime");
      assert.deepEqual(calls[0].data, {
        window,
      });
      assert.equal(calls[1].type, "openSkillRunnerLocalDeployDebugConsole");
      assert.deepEqual(calls[1].data, {
        window,
      });
      assert.equal(calls[2].type, "deploySkillRunnerLocalRuntime");
      assert.deepEqual(calls[2].data, {
        window,
        version: "v9.9.9",
      });
      assert.equal(calls[3].type, "stateSkillRunnerLocalRuntime");
      assert.deepEqual(calls[3].data, { window });
      assert.equal(calls[4].type, "statusSkillRunnerLocalRuntime");
      assert.deepEqual(calls[4].data, { window });
      assert.equal(calls[5].type, "stateSkillRunnerLocalRuntime");
      assert.deepEqual(calls[5].data, { window });
      assert.equal(calls[6].type, "startSkillRunnerLocalRuntime");
      assert.deepEqual(calls[6].data, { window });
      assert.equal(calls[7].type, "stateSkillRunnerLocalRuntime");
      assert.deepEqual(calls[7].data, { window });
      assert.equal(calls[8].type, "stopSkillRunnerLocalRuntime");
      assert.deepEqual(calls[8].data, { window });
      assert.equal(calls[9].type, "stateSkillRunnerLocalRuntime");
      assert.deepEqual(calls[9].data, { window });
      assert.equal(calls[10].type, "uninstallSkillRunnerLocalRuntime");
      assert.deepEqual(calls[10].data, { window });
      assert.equal(calls[11].type, "stateSkillRunnerLocalRuntime");
      assert.deepEqual(calls[11].data, { window });
      assert.equal(calls[12].type, "doctorSkillRunnerLocalRuntime");
      assert.deepEqual(calls[12].data, { window });
      assert.equal(calls[13].type, "stateSkillRunnerLocalRuntime");
      assert.deepEqual(calls[13].data, { window });
      assert.equal(calls[14].type, "copySkillRunnerLocalDeployCommands");
      assert.deepEqual(calls[14].data, {
        window,
        version: "v9.9.9",
      });
      assert.equal(calls[15].type, "stateSkillRunnerLocalRuntime");
      assert.deepEqual(calls[15].data, { window });
      assert.equal(calls[16].type, "openSkillRunnerLocalDeployDebugConsole");
      assert.deepEqual(calls[16].data, { window });
      assert.equal(calls[17].type, "stateSkillRunnerLocalRuntime");
      assert.deepEqual(calls[17].data, {
        window,
      });
      assert.equal(calls[18].type, "toggleSkillRunnerLocalRuntimeAutoPull");
      assert.deepEqual(calls[18].data, { window });
      assert.equal(calls[19].type, "stateSkillRunnerLocalRuntime");
      assert.deepEqual(calls[19].data, { window });
      assert.lengthOf(calls, 20);
      assert.deepEqual(copyPayloads, ["echo test"]);
      const autoPullLabel = String(
        localRuntimeAutoPullToggleButton.getAttribute("label") || "",
      ).trim();
      assert.isNotEmpty(autoPullLabel);
      assert.notMatch(autoPullLabel, /pref-skillrunner-local-auto-pull/);
      assert.match(
        autoPullLabel,
        /Enable Auto-start|Disable Auto-start|开启自动拉起|关闭自动拉起/,
      );
      assert.match(
        localRuntimeStatusText.textContent || "",
        /Success:|成功：|pref-skillrunner-local-status-ok-prefix/,
      );
    } finally {
      runtime.Zotero!.Utilities!.Internal!.copyTextToClipboard = previousCopy;
    }
  });
});

describe("gui: workflow runtime scan", function () {
  const workflowDirPrefKey = `${config.prefsPrefix}.workflowDir`;
  let prevAddon: unknown;
  let prevWorkflowDirPref: unknown;

  beforeEach(function () {
    const runtime = globalThis as { addon?: unknown };
    prevAddon = runtime.addon;
    runtime.addon = {
      data: {
        config,
      },
    };
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
  });

  it("rescans workflow registry and exposes loaded entries", async function () {
    const root = await mkTempDir("zotero-skills-gui-scan");
    const workflowRoot = joinPath(root, "gui-scan-workflow");
    await writeUtf8(
      joinPath(workflowRoot, "workflow.json"),
      JSON.stringify(
        {
          id: "gui-scan-workflow",
          label: "GUI Scan Workflow",
          provider: "skillrunner",
          request: { kind: "skillrunner.job.v1" },
          execution: {
            skillrunner_mode: "auto",
          },
          hooks: { applyResult: "hooks/applyResult.js" },
        },
        null,
        2,
      ),
    );
    await writeUtf8(
      joinPath(workflowRoot, "hooks", "applyResult.js"),
      "export async function applyResult(){ return { ok: true }; }",
    );

    const state = await rescanWorkflowRegistry({ workflowsDir: root });
    assert.equal(state.workflowsDir, root);
    assert.lengthOf(state.loaded.workflows, 1);
    assert.equal(state.loaded.workflows[0].manifest.id, "gui-scan-workflow");

    const entries = getLoadedWorkflowEntries();
    assert.lengthOf(entries, 1);
    assert.equal(entries[0].manifest.label, "GUI Scan Workflow");
    assert.equal(getWorkflowRegistryState().workflowsDir, root);
  });

  itFullOnly("falls back to default workflow dir when preference is empty", function () {
    const effectiveDir = getEffectiveWorkflowDir();
    assert.isTrue(/[\\/]workflows$/.test(effectiveDir), `effectiveDir=${effectiveDir}`);
    assert.equal(Zotero.Prefs.get(workflowDirPrefKey, true), effectiveDir);
  });
});

describe("gui: workflow context menu", function () {
  let prevAddon: unknown;

  beforeEach(function () {
    const runtime = globalThis as { addon?: unknown };
    prevAddon = runtime.addon;
    runtime.addon = {
      data: {
        config,
        workflow: {
          workflowsDir: "test-workflows",
          loaded: {
            workflows: [],
            manifests: [],
            warnings: [],
            errors: [],
          },
        },
      },
      hooks: {
        onPrefsEvent: async () => {},
      },
    };
  });

  afterEach(function () {
    const runtime = globalThis as { addon?: unknown };
    runtime.addon = prevAddon;
  });

  it("adds workflows root menu and shows empty state when registry is empty", async function () {
    setWorkflowState([]);
    const win = createMainWindow([]);
    ensureWorkflowMenuForWindow(win);

    const menu = win.document.getElementById(`${config.addonRef}-workflows-menu`) as FakeXULElement | null;
    const popup = win.document.getElementById(
      `${config.addonRef}-workflows-popup`,
    ) as FakeXULElement | null;

    assert.isOk(menu);
    assert.isOk(popup);
    popup!.dispatch("popupshowing");
    await flushTasks();

    assert.lengthOf(popup!.children, 6);
    assertMenuLabel(
      popup!.children[0].getAttribute("label"),
      ["Rescan Workflows", "重新扫描 Workflow"],
      "rescan label",
    );
    assert.equal(popup!.children[0].getAttribute("disabled"), null);
    assertMenuLabel(
      popup!.children[1].getAttribute("label"),
      ["Workflow Settings...", "Workflow 设置..."],
      "settings label",
    );
    assert.equal(popup!.children[1].tagName, "menu");
    const settingsPopup = popup!.children[1].children[0] as FakeXULElement;
    assert.isOk(settingsPopup);
    assert.lengthOf(settingsPopup.children, 1);
    assertMenuLabel(
      settingsPopup.children[0].getAttribute("label"),
      ["No workflows loaded", "未加载任何 Workflow"],
      "settings empty label",
    );
    assert.equal(settingsPopup.children[0].getAttribute("disabled"), "true");
    assertMenuLabel(
      popup!.children[2].getAttribute("label"),
      ["Open Dashboard...", "打开 Dashboard..."],
      "task-manager label",
    );
    assertMenuLabel(
      popup!.children[3].getAttribute("label"),
      ["Open Logs...", "打开日志窗口..."],
      "logs label",
    );
    assert.equal(popup!.children[4].tagName, "menuseparator");
    assert.equal(popup!.children[5].getAttribute("disabled"), "true");
    assertMenuLabel(
      popup!.children[5].getAttribute("label"),
      ["No workflows loaded", "未加载任何 Workflow"],
      "root empty label",
    );
  });

  it("renders disabled workflow entries when no items are selected", async function () {
    setWorkflowState([
      makeLoadedWorkflow("workflow-a", "Workflow A"),
      makeLoadedWorkflow("workflow-b", "Workflow B"),
    ]);
    const win = createMainWindow([]);
    ensureWorkflowMenuForWindow(win);

    const popup = win.document.getElementById(
      `${config.addonRef}-workflows-popup`,
    ) as FakeXULElement;
    popup.dispatch("popupshowing");
    await flushTasks();

    assert.lengthOf(popup.children, 7);
    assertMenuLabel(
      popup.children[0].getAttribute("label"),
      ["Rescan Workflows", "重新扫描 Workflow"],
      "rescan label",
    );
    assertMenuLabel(
      popup.children[1].getAttribute("label"),
      ["Workflow Settings...", "Workflow 设置..."],
      "settings label",
    );
    assert.equal(popup.children[1].tagName, "menu");
    const settingsPopup = popup.children[1].children[0] as FakeXULElement;
    assert.lengthOf(settingsPopup.children, 2);
    assert.equal(settingsPopup.children[0].getAttribute("label"), "Workflow A");
    assert.equal(settingsPopup.children[1].getAttribute("label"), "Workflow B");
    assertMenuLabel(
      popup.children[2].getAttribute("label"),
      ["Open Dashboard...", "打开 Dashboard..."],
      "task-manager label",
    );
    assertMenuLabel(
      popup.children[3].getAttribute("label"),
      ["Open Logs...", "打开日志窗口..."],
      "logs label",
    );
    assert.equal(popup.children[4].tagName, "menuseparator");
    assert.equal(popup.children[5].getAttribute("disabled"), "true");
    assert.equal(popup.children[6].getAttribute("disabled"), "true");
    assert.match(
      popup.children[5].getAttribute("label") || "",
      /^Workflow A \((no selection|未选择条目)\)$/,
    );
    assert.match(
      popup.children[6].getAttribute("label") || "",
      /^Workflow B \((no selection|未选择条目)\)$/,
    );
  });

  it("dispatches scanWorkflows from context-menu rescan action", async function () {
    setWorkflowState([]);
    const calls: Array<{ type: string; data: unknown }> = [];
    (
      globalThis as {
        addon: {
          hooks: {
            onPrefsEvent: (type: string, data: unknown) => Promise<void>;
          };
        };
      }
    ).addon.hooks.onPrefsEvent = async (type, data) => {
      calls.push({ type, data });
    };

    const win = createMainWindow([]);
    ensureWorkflowMenuForWindow(win);
    const popup = win.document.getElementById(
      `${config.addonRef}-workflows-popup`,
    ) as FakeXULElement;
    popup.dispatch("popupshowing");
    await flushTasks();
    popup.children[0].dispatch("command");

    assert.lengthOf(calls, 1);
    assert.equal(calls[0].type, "scanWorkflows");
    assert.deepEqual(calls[0].data, { window: win });
  });

  it("dispatches openWorkflowSettings with workflowId from context-menu settings submenu", async function () {
    setWorkflowState([
      makeLoadedWorkflow("workflow-a", "Workflow A"),
      makeLoadedWorkflow("workflow-b", "Workflow B"),
    ]);
    const calls: Array<{ type: string; data: unknown }> = [];
    (
      globalThis as {
        addon: {
          hooks: {
            onPrefsEvent: (type: string, data: unknown) => Promise<void>;
          };
        };
      }
    ).addon.hooks.onPrefsEvent = async (type, data) => {
      calls.push({ type, data });
    };

    const win = createMainWindow([]);
    ensureWorkflowMenuForWindow(win);
    const popup = win.document.getElementById(
      `${config.addonRef}-workflows-popup`,
    ) as FakeXULElement;
    popup.dispatch("popupshowing");
    await flushTasks();
    const settingsPopup = popup.children[1].children[0] as FakeXULElement;
    settingsPopup.children[1].dispatch("command");

    assert.lengthOf(calls, 1);
    assert.equal(calls[0].type, "openWorkflowSettings");
    assert.deepEqual(calls[0].data, {
      window: win,
      workflowId: "workflow-b",
    });
  });

  it("hides pass-through workflows without settings from workflow settings submenu", async function () {
    setWorkflowState([
      makeLoadedWorkflow("workflow-a", "Workflow A"),
      makePassThroughWorkflow("pass-through-gui", "Pass Through GUI"),
    ]);

    const win = createMainWindow([]);
    ensureWorkflowMenuForWindow(win);
    const popup = win.document.getElementById(
      `${config.addonRef}-workflows-popup`,
    ) as FakeXULElement;
    popup.dispatch("popupshowing");
    await flushTasks();

    const settingsPopup = popup.children[1].children[0] as FakeXULElement;
    assert.lengthOf(settingsPopup.children, 1);
    assert.equal(settingsPopup.children[0].getAttribute("label"), "Workflow A");
  });

  itFullOnly("does not rebuild root popup when submenu popupshowing bubbles", async function () {
    setWorkflowState([
      makeLoadedWorkflow("workflow-a", "Workflow A"),
      makeLoadedWorkflow("workflow-b", "Workflow B"),
    ]);
    const win = createMainWindow([]);
    ensureWorkflowMenuForWindow(win);
    const popup = win.document.getElementById(
      `${config.addonRef}-workflows-popup`,
    ) as FakeXULElement;
    popup.dispatch("popupshowing");
    await flushTasks();

    const settingsMenuBefore = popup.children[1];
    const settingsPopup = settingsMenuBefore.children[0] as FakeXULElement;
    popup.dispatch("popupshowing", { target: settingsPopup });
    await flushTasks();

    assert.strictEqual(
      popup.children[1],
      settingsMenuBefore,
      "bubbled submenu popupshowing should not trigger root popup rebuild",
    );
  });

  itFullOnly("dispatches openDashboard from context-menu dashboard action", async function () {
    setWorkflowState([]);
    const calls: Array<{ type: string; data: unknown }> = [];
    (
      globalThis as {
        addon: {
          hooks: {
            onPrefsEvent: (type: string, data: unknown) => Promise<void>;
          };
        };
      }
    ).addon.hooks.onPrefsEvent = async (type, data) => {
      calls.push({ type, data });
    };

    const win = createMainWindow([]);
    ensureWorkflowMenuForWindow(win);
    const popup = win.document.getElementById(
      `${config.addonRef}-workflows-popup`,
    ) as FakeXULElement;
    popup.dispatch("popupshowing");
    await flushTasks();
    popup.children[2].dispatch("command");

    assert.lengthOf(calls, 1);
    assert.equal(calls[0].type, "openDashboard");
    assert.deepEqual(calls[0].data, { window: win });
  });

  itFullOnly("dispatches openLogViewer from context-menu logs action", async function () {
    setWorkflowState([]);
    const calls: Array<{ type: string; data: unknown }> = [];
    (
      globalThis as {
        addon: {
          hooks: {
            onPrefsEvent: (type: string, data: unknown) => Promise<void>;
          };
        };
      }
    ).addon.hooks.onPrefsEvent = async (type, data) => {
      calls.push({ type, data });
    };

    const win = createMainWindow([]);
    ensureWorkflowMenuForWindow(win);
    const popup = win.document.getElementById(
      `${config.addonRef}-workflows-popup`,
    ) as FakeXULElement;
    popup.dispatch("popupshowing");
    await flushTasks();
    popup.children[3].dispatch("command");

    assert.lengthOf(calls, 1);
    assert.equal(calls[0].type, "openLogViewer");
    assert.deepEqual(calls[0].data, { window: win });
  });

  it("keeps pass-through workflow menu item enabled without backend profile", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Pass Through GUI Parent" },
    });
    setWorkflowState([
      makePassThroughWorkflow("pass-through-gui", "Pass Through GUI"),
    ]);
    const win = createMainWindow([parent]);
    ensureWorkflowMenuForWindow(win);
    const popup = win.document.getElementById(
      `${config.addonRef}-workflows-popup`,
    ) as FakeXULElement;
    popup.dispatch("popupshowing");
    for (let i = 0; i < 10; i++) {
      await flushTasks();
      if (popup.children.length > 5) {
        break;
      }
    }

    const workflowItem = popup.children.find(
      (entry) => (entry.getAttribute("label") || "").startsWith("Pass Through GUI"),
    );
    assert.isOk(workflowItem);
    assert.equal(workflowItem.getAttribute("label"), "Pass Through GUI");
    assert.equal(workflowItem.getAttribute("disabled"), null);
  });

  it("shows no-valid-input hint instead of raw error name when workflow cannot run on current selection", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "No Valid Input Parent" },
    });
    setWorkflowState([makeLoadedWorkflow("workflow-a", "Workflow A")]);
    const win = createMainWindow([parent]);
    ensureWorkflowMenuForWindow(win);
    const popup = win.document.getElementById(
      `${config.addonRef}-workflows-popup`,
    ) as FakeXULElement;
    popup.dispatch("popupshowing");
    for (let i = 0; i < 10; i++) {
      await flushTasks();
      if (popup.children.length > 5) {
        break;
      }
    }

    const workflowItem = popup.children.find(
      (entry) => (entry.getAttribute("label") || "").startsWith("Workflow A"),
    );
    assert.isOk(workflowItem);
    assert.match(
      workflowItem.getAttribute("label") || "",
      /^Workflow A \((no valid input|无合法输入)\)$/,
    );
    assert.equal(workflowItem.getAttribute("disabled"), "true");
  });
});
