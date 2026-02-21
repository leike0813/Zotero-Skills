import { assert } from "chai";
import { config } from "../../package.json";
import { handlers } from "../../src/handlers";
import { executeWorkflowFromCurrentSelection } from "../../src/modules/workflowExecute";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import { workflowsPath } from "../zotero/workflow-test-utils";

type HostOpenArgs = {
  rendererId?: string;
  title?: string;
  initialState?: {
    entries?: Array<{
      tag: string;
      facet: string;
      source: string;
      note: string;
      deprecated: boolean;
    }>;
    corrupted?: boolean;
  };
};

type HostOpenResult = {
  saved: boolean;
  result?: unknown;
  reason?: string;
};

type RuntimeWithEditorBridge = typeof globalThis & {
  __zsWorkflowEditorHostOpen?: (
    args: HostOpenArgs,
  ) => Promise<HostOpenResult> | HostOpenResult;
  addon?: {
    data?: {
      workflowEditorHost?: {
        open?: (
          args: HostOpenArgs,
        ) => Promise<HostOpenResult> | HostOpenResult;
      };
    };
  };
};

type PersistedTagEntry = {
  tag: string;
  facet: string;
  source: string;
  note: string;
  deprecated: boolean;
};

const TAG_VOCAB_PREF_KEY = `${config.prefsPrefix}.tagVocabularyJson`;

function clearTagVocabularyState() {
  Zotero.Prefs.clear(TAG_VOCAB_PREF_KEY, true);
}

function saveTagVocabularyState(entries: PersistedTagEntry[]) {
  Zotero.Prefs.set(
    TAG_VOCAB_PREF_KEY,
    JSON.stringify({
      version: 1,
      entries,
    }),
    true,
  );
}

function loadTagVocabularyState() {
  const raw = Zotero.Prefs.get(TAG_VOCAB_PREF_KEY, true);
  if (typeof raw !== "string" || !raw.trim()) {
    return {
      corrupted: false,
      entries: [] as PersistedTagEntry[],
    };
  }
  try {
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return {
      corrupted: false,
      entries: entries as PersistedTagEntry[],
    };
  } catch {
    return {
      corrupted: true,
      entries: [] as PersistedTagEntry[],
    };
  }
}

function exportPersistedTagVocabularyStrings() {
  return loadTagVocabularyState()
    .entries.filter((entry) => !entry.deprecated)
    .map((entry) => String(entry.tag || "").trim())
    .filter(Boolean)
    .sort((left, right) =>
      left.localeCompare(right, "en", {
        sensitivity: "base",
      }),
    );
}

async function getTagManagerWorkflow() {
  const loaded = await loadWorkflowManifests(workflowsPath());
  const workflow = loaded.workflows.find(
    (entry) => entry.manifest.id === "tag-manager",
  );
  assert.isOk(
    workflow,
    `workflow tag-manager not found; loaded=${loaded.workflows.map((entry) => entry.manifest.id).join(",")} warnings=${JSON.stringify(loaded.warnings)} errors=${JSON.stringify(loaded.errors)}`,
  );
  return workflow!;
}

function installEditorOpenMock(
  mockOpen: (args: HostOpenArgs) => Promise<HostOpenResult> | HostOpenResult,
) {
  const runtime = globalThis as RuntimeWithEditorBridge;
  const prevGlobal = runtime.__zsWorkflowEditorHostOpen;
  const addonObj = (runtime.addon || {}) as NonNullable<
    RuntimeWithEditorBridge["addon"]
  >;
  if (!addonObj.data) {
    addonObj.data = {};
  }
  if (!addonObj.data.workflowEditorHost) {
    addonObj.data.workflowEditorHost = {};
  }
  const prevAddonOpen = addonObj.data.workflowEditorHost.open;
  addonObj.data.workflowEditorHost.open = mockOpen;
  runtime.__zsWorkflowEditorHostOpen = mockOpen;
  runtime.addon = addonObj;
  return () => {
    runtime.__zsWorkflowEditorHostOpen = prevGlobal;
    addonObj.data!.workflowEditorHost!.open = prevAddonOpen;
  };
}

describe("workflow: tag-manager", function () {
  beforeEach(function () {
    clearTagVocabularyState();
  });

  afterEach(function () {
    clearTagVocabularyState();
  });

  it("persists edited vocabulary when editor saves", async function () {
    const workflow = await getTagManagerWorkflow();
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Manager Save Parent" },
    });
    const calls: HostOpenArgs[] = [];
    const restoreOpen = installEditorOpenMock(async (args) => {
      calls.push(args);
      return {
        saved: true,
        result: {
          entries: [
            {
              tag: "topic:tunnel",
              facet: "topic",
              source: "manual",
              note: "Tunnel",
              deprecated: false,
            },
            {
              tag: "field:CE/UG",
              facet: "field",
              source: "manual",
              note: "Civil underground",
              deprecated: false,
            },
          ],
        },
      };
    });

    const alerts: string[] = [];
    const toastLines: string[] = [];
    const runtime = globalThis as typeof globalThis & {
      ztoolkit?: {
        ProgressWindow?: new (
          title: string,
          options?: Record<string, unknown>,
        ) => {
          createLine: (args: { text?: string }) => {
            show: () => { startCloseTimer?: (delayMs: number) => unknown };
          };
        };
      };
    };
    const hadToolkit = Boolean(runtime.ztoolkit);
    const prevProgressWindow = runtime.ztoolkit?.ProgressWindow;
    runtime.ztoolkit = runtime.ztoolkit || {};
    runtime.ztoolkit.ProgressWindow = class MockProgressWindow {
      createLine(args: { text?: string }) {
        toastLines.push(String(args?.text || ""));
        return {
          show() {
            return {
              startCloseTimer() {
                return undefined;
              },
            };
          },
        };
      }
    };
    const win = {
      ZoteroPane: {
        getSelectedItems: () => [parent],
      },
      alert: (message: string) => alerts.push(message),
    } as unknown as _ZoteroTypes.MainWindow;

    try {
      await executeWorkflowFromCurrentSelection({
        win,
        workflow,
      });
    } finally {
      if (hadToolkit) {
        runtime.ztoolkit!.ProgressWindow = prevProgressWindow;
      } else {
        delete runtime.ztoolkit;
      }
      restoreOpen();
    }

    assert.lengthOf(calls, 1);
    assert.equal(calls[0].rendererId, "tag-manager.default.v1");
    assert.equal(calls[0].title, "Tag Manager");
    assert.lengthOf(alerts, 0);
    assert.lengthOf(toastLines, 0);

    const loaded = loadTagVocabularyState();
    assert.isFalse(loaded.corrupted);
    assert.deepEqual(
      loaded.entries.map((entry) => entry.tag),
      ["field:CE/UG", "topic:tunnel"],
    );
    assert.deepEqual(exportPersistedTagVocabularyStrings(), [
      "field:CE/UG",
      "topic:tunnel",
    ]);
  });

  it("keeps previous state when editor is canceled", async function () {
    const workflow = await getTagManagerWorkflow();
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Manager Cancel Parent" },
    });
    saveTagVocabularyState([
      {
        tag: "topic:stable",
        facet: "topic",
        source: "manual",
        note: "Stable",
        deprecated: false,
      },
    ]);

    const restoreOpen = installEditorOpenMock(async () => ({
      saved: false,
      reason: "user-canceled",
    }));
    const alerts: string[] = [];
    const win = {
      ZoteroPane: {
        getSelectedItems: () => [parent],
      },
      alert: (message: string) => alerts.push(message),
    } as unknown as _ZoteroTypes.MainWindow;

    try {
      await executeWorkflowFromCurrentSelection({
        win,
        workflow,
      });
    } finally {
      restoreOpen();
    }

    assert.lengthOf(alerts, 0);
    assert.deepEqual(exportPersistedTagVocabularyStrings(), ["topic:stable"]);
  });
});
