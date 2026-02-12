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

type Listener = (event: Record<string, unknown>) => void;

class FakeXULElement {
  private attrs = new Map<string, string>();
  private listeners = new Map<string, Listener[]>();
  private _id = "";

  public value = "";
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

  return {
    window: { document } as unknown as Window,
    workflowDirInput,
    scanButton,
    workflowSettingsButton,
    backendManageButton,
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
    assert.lengthOf(calls, 1);
    assert.equal(calls[0].type, "scanWorkflows");
    assert.deepEqual(calls[0].data, {
      window,
      workflowsDir: directScanWorkflowDir,
    });

    workflowDirInput.value = "  ";
    scanButton.dispatch("command");
    assert.lengthOf(calls, 2);
    assert.equal(calls[1].type, "scanWorkflows");
    assert.equal((calls[1].data as { workflowsDir?: string }).workflowsDir, undefined);
    assert.isNotEmpty(workflowDirInput.value);
    assert.equal(Zotero.Prefs.get(workflowDirPrefKey, true), workflowDirInput.value);

    workflowSettingsButton.dispatch("command");
    assert.lengthOf(calls, 3);
    assert.equal(calls[2].type, "openWorkflowSettings");
    assert.deepEqual(calls[2].data, {
      window,
      source: "preferences",
    });

    backendManageButton.dispatch("command");
    assert.lengthOf(calls, 4);
    assert.equal(calls[3].type, "openBackendManager");
    assert.deepEqual(calls[3].data, {
      window,
    });
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

  it("falls back to default workflow dir when preference is empty", function () {
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
      ["Open Task Manager...", "打开任务管理窗口..."],
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
      ["Open Task Manager...", "打开任务管理窗口..."],
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

  it("does not rebuild root popup when submenu popupshowing bubbles", async function () {
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

  it("dispatches openTaskManager from context-menu task manager action", async function () {
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
    assert.equal(calls[0].type, "openTaskManager");
    assert.deepEqual(calls[0].data, { window: win });
  });

  it("dispatches openLogViewer from context-menu logs action", async function () {
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
});
