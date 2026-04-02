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
  __zsWorkflowRuntimeBridge?: {
    appendRuntimeLog?: (entry: Record<string, unknown>) => unknown;
    showToast?: (args: { text?: string; type?: string }) => void;
  };
  fetch?: (input: string, init?: Record<string, unknown>) => Promise<{
    ok: boolean;
    status: number;
    statusText?: string;
    json: () => Promise<unknown>;
  }>;
  addon?: {
    data?: {
      workflowEditorHost?: {
        open?: (
          args: HostOpenArgs,
        ) => Promise<HostOpenResult> | HostOpenResult;
      };
      workflowRuntimeBridge?: {
        appendRuntimeLog?: (entry: Record<string, unknown>) => unknown;
        showToast?: (args: { text?: string; type?: string }) => void;
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
const TAG_VOCAB_LOCAL_PREF_KEY = `${config.prefsPrefix}.tagVocabularyLocalCommittedJson`;
const TAG_VOCAB_REMOTE_PREF_KEY = `${config.prefsPrefix}.tagVocabularyRemoteCommittedJson`;
const WORKFLOW_SETTINGS_PREF_KEY = `${config.prefsPrefix}.workflowSettingsJson`;

function clearTagVocabularyState() {
  Zotero.Prefs.clear(TAG_VOCAB_PREF_KEY, true);
  Zotero.Prefs.clear(TAG_VOCAB_LOCAL_PREF_KEY, true);
  Zotero.Prefs.clear(TAG_VOCAB_REMOTE_PREF_KEY, true);
}

function clearWorkflowSettingsState() {
  Zotero.Prefs.clear(WORKFLOW_SETTINGS_PREF_KEY, true);
}

function saveWorkflowSettingsState(workflowId: string, workflowParams: Record<string, unknown>) {
  Zotero.Prefs.set(
    WORKFLOW_SETTINGS_PREF_KEY,
    JSON.stringify({
      [workflowId]: {
        workflowParams,
      },
    }),
    true,
  );
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

function saveRemoteCommittedVocabularyState(entries: PersistedTagEntry[]) {
  Zotero.Prefs.set(
    TAG_VOCAB_REMOTE_PREF_KEY,
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

function installTagVocabularySyncBridgeMock(args: {
  logs?: Array<Record<string, unknown>>;
  toasts?: string[];
}) {
  const runtime = globalThis as RuntimeWithEditorBridge;
  const prevGlobal = runtime.__zsWorkflowRuntimeBridge;
  const addonObj = (runtime.addon || {}) as NonNullable<
    RuntimeWithEditorBridge["addon"]
  >;
  if (!addonObj.data) {
    addonObj.data = {};
  }
  const prevAddonBridge = addonObj.data.workflowRuntimeBridge;
  const bridge = {
    appendRuntimeLog: (entry: Record<string, unknown>) => {
      args.logs?.push(entry);
      return entry;
    },
    showToast: (payload: { text?: string }) => {
      args.toasts?.push(String(payload?.text || ""));
    },
  };
  runtime.__zsWorkflowRuntimeBridge = bridge;
  addonObj.data.workflowRuntimeBridge = bridge;
  runtime.addon = addonObj;
  return () => {
    runtime.__zsWorkflowRuntimeBridge = prevGlobal;
    addonObj.data!.workflowRuntimeBridge = prevAddonBridge;
  };
}

function installFetchMock(
  mockFetch: NonNullable<RuntimeWithEditorBridge["fetch"]>,
) {
  const runtime = globalThis as RuntimeWithEditorBridge;
  const prevFetch = runtime.fetch;
  runtime.fetch = mockFetch;
  return () => {
    runtime.fetch = prevFetch;
  };
}

function toBase64(text: string) {
  return Buffer.from(text, "utf8").toString("base64");
}

describe("workflow: tag-manager", function () {
  beforeEach(function () {
    clearTagVocabularyState();
    clearWorkflowSettingsState();
  });

  afterEach(function () {
    clearTagVocabularyState();
    clearWorkflowSettingsState();
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

  it("subscribes remote vocabulary before opening editor when GitHub sync is configured", async function () {
    saveWorkflowSettingsState("tag-manager", {
      github_owner: "demo-owner",
      github_repo: "Zotero_TagVocab",
      file_path: "tags/tags.json",
      github_token: "secret-token",
    });
    const workflow = await getTagManagerWorkflow();
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Manager Remote Subscribe Parent" },
    });
    const calls: HostOpenArgs[] = [];
    const restoreOpen = installEditorOpenMock(async (args) => {
      calls.push(args);
      return {
        saved: false,
        reason: "user-canceled",
      };
    });
    const restoreFetch = installFetchMock(async (input) => ({
      ok: true,
      status: 200,
      json: async () => ({
        version: "1.0.0",
        updated_at: "2026-04-02T00:00:00.000Z",
        facets: ["topic"],
        tags: [
          {
            tag: "topic:remote",
            facet: "topic",
            source: "remote",
            note: "remote-tag",
            deprecated: false,
          },
        ],
        abbrevs: {},
        tag_count: 1,
      }),
    }));
    const win = {
      ZoteroPane: {
        getSelectedItems: () => [parent],
      },
      alert: () => undefined,
    } as unknown as _ZoteroTypes.MainWindow;

    try {
      await executeWorkflowFromCurrentSelection({
        win,
        workflow,
      });
    } finally {
      restoreFetch();
      restoreOpen();
    }

    assert.lengthOf(calls, 1);
    assert.deepEqual(
      calls[0].initialState?.entries?.map((entry) => entry.tag),
      ["topic:remote"],
    );
    assert.equal((calls[0].initialState as Record<string, unknown>)?.remoteSyncState, "subscribed");
  });

  it("publishes remote vocabulary after local save when GitHub sync is configured", async function () {
    saveWorkflowSettingsState("tag-manager", {
      github_owner: "demo-owner",
      github_repo: "Zotero_TagVocab",
      file_path: "tags/tags.json",
      github_token: "secret-token",
    });
    const workflow = await getTagManagerWorkflow();
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Manager Remote Publish Parent" },
    });
    const requests: Array<{ url: string; method: string; body: string }> = [];
    const restoreOpen = installEditorOpenMock(async () => ({
      saved: true,
      result: {
        entries: [
          {
            tag: "topic:publish-me",
            facet: "topic",
            source: "manual",
            note: "publish",
            deprecated: false,
          },
        ],
      },
    }));
    const restoreFetch = installFetchMock(async (input, init) => {
      const url = String(input || "");
      const method = String(init?.method || "GET").toUpperCase();
      const body = String(init?.body || "");
      requests.push({ url, method, body });
      if (url.includes("raw.githubusercontent.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            version: "1.0.0",
            updated_at: "2026-04-02T00:00:00.000Z",
            facets: ["topic"],
            tags: [],
            abbrevs: { llm: "LLM" },
            tag_count: 0,
          }),
        };
      }
      if (method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            sha: "sha-1",
            content: toBase64(
              JSON.stringify({
                version: "1.0.0",
                updated_at: "2026-04-02T00:00:00.000Z",
                facets: ["topic"],
                tags: [],
                abbrevs: { llm: "LLM" },
                tag_count: 0,
              }),
            ),
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });
    const win = {
      ZoteroPane: {
        getSelectedItems: () => [parent],
      },
      alert: () => undefined,
    } as unknown as _ZoteroTypes.MainWindow;

    try {
      await executeWorkflowFromCurrentSelection({
        win,
        workflow,
      });
    } finally {
      restoreFetch();
      restoreOpen();
    }

    assert.deepEqual(exportPersistedTagVocabularyStrings(), ["topic:publish-me"]);
    const putRequest = requests.find((entry) => entry.method === "PUT");
    assert.isOk(putRequest);
    const payload = JSON.parse(putRequest!.body);
    const published = JSON.parse(Buffer.from(String(payload.content || ""), "base64").toString("utf8"));
    assert.equal(payload.sha, "sha-1");
    assert.deepEqual(
      published.tags.map((entry: PersistedTagEntry) => entry.tag),
      ["topic:publish-me"],
    );
    assert.deepEqual(published.abbrevs, { llm: "LLM" });
  });

  it("keeps remote committed snapshot unchanged and preserves failed draft when remote publish fails", async function () {
    saveWorkflowSettingsState("tag-manager", {
      github_owner: "demo-owner",
      github_repo: "Zotero_TagVocab",
      file_path: "tags/tags.json",
      github_token: "secret-token",
    });
    saveRemoteCommittedVocabularyState([
      {
        tag: "topic:remote-stable",
        facet: "topic",
        source: "remote",
        note: "stable",
        deprecated: false,
      },
    ]);
    const workflow = await getTagManagerWorkflow();
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Manager Remote Publish Failure Parent" },
    });
    const logs: Array<Record<string, unknown>> = [];
    const toasts: string[] = [];
    const restoreBridge = installTagVocabularySyncBridgeMock({
      logs,
      toasts,
    });
    const calls: HostOpenArgs[] = [];
    let openCount = 0;
    const restoreOpen = installEditorOpenMock(async (args) => {
      calls.push(args);
      openCount += 1;
      if (openCount === 1) {
        return {
          saved: true,
          result: {
            entries: [
              {
                tag: "topic:still-local",
                facet: "topic",
                source: "manual",
                note: "local only",
                deprecated: false,
              },
            ],
          },
        };
      }
      return {
        saved: false,
        reason: "user-canceled-after-failure",
      };
    });
    const restoreFetch = installFetchMock(async (input, init) => {
      const url = String(input || "");
      const method = String(init?.method || "GET").toUpperCase();
      if (url.includes("raw.githubusercontent.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            version: "1.0.0",
            updated_at: "2026-04-02T00:00:00.000Z",
            facets: ["topic"],
            tags: [
              {
                tag: "topic:remote-stable",
                facet: "topic",
                source: "remote",
                note: "stable",
                deprecated: false,
              },
            ],
            abbrevs: {},
            tag_count: 1,
          }),
        };
      }
      if (method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            sha: "sha-1",
            content: toBase64(
              JSON.stringify({
                version: "1.0.0",
                updated_at: "2026-04-02T00:00:00.000Z",
                facets: ["topic"],
                tags: [
                  {
                    tag: "topic:remote-stable",
                    facet: "topic",
                    source: "remote",
                    note: "stable",
                    deprecated: false,
                  },
                ],
                abbrevs: {},
                tag_count: 1,
              }),
            ),
          }),
        };
      }
      return {
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: async () => ({}),
      };
    });
    const win = {
      ZoteroPane: {
        getSelectedItems: () => [parent],
      },
      alert: () => undefined,
    } as unknown as _ZoteroTypes.MainWindow;

    try {
      await executeWorkflowFromCurrentSelection({
        win,
        workflow,
      });
    } finally {
      restoreFetch();
      restoreOpen();
      restoreBridge();
    }

    assert.lengthOf(calls, 2);
    assert.equal(
      String((calls[1].initialState as Record<string, unknown>)?.remoteSyncState || ""),
      "save-publish-failed",
    );
    assert.deepEqual(exportPersistedTagVocabularyStrings(), ["topic:remote-stable"]);
    assert.isTrue(
      toasts.some((entry) => entry.includes("remote publish failed")),
    );
    assert.isTrue(
      logs.some((entry) => String(entry.stage || "") === "publish-failed"),
    );
  });

  it("falls back to last successful remote snapshot when subscribe fails", async function () {
    saveWorkflowSettingsState("tag-manager", {
      github_owner: "demo-owner",
      github_repo: "Zotero_TagVocab",
      file_path: "tags/tags.json",
      github_token: "secret-token",
    });
    saveRemoteCommittedVocabularyState([
      {
        tag: "topic:cached-remote",
        facet: "topic",
        source: "remote",
        note: "cached",
        deprecated: false,
      },
    ]);
    const workflow = await getTagManagerWorkflow();
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Manager Remote Cache Parent" },
    });
    const calls: HostOpenArgs[] = [];
    const restoreOpen = installEditorOpenMock(async (args) => {
      calls.push(args);
      return {
        saved: false,
        reason: "user-canceled",
      };
    });
    const restoreFetch = installFetchMock(async () => ({
      ok: false,
      status: 503,
      statusText: "Unavailable",
      json: async () => ({}),
    }));
    const win = {
      ZoteroPane: {
        getSelectedItems: () => [parent],
      },
      alert: () => undefined,
    } as unknown as _ZoteroTypes.MainWindow;

    try {
      await executeWorkflowFromCurrentSelection({
        win,
        workflow,
      });
    } finally {
      restoreFetch();
      restoreOpen();
    }

    assert.lengthOf(calls, 1);
    assert.deepEqual(
      calls[0].initialState?.entries?.map((entry) => entry.tag),
      ["topic:cached-remote"],
    );
    assert.equal(
      String((calls[0].initialState as Record<string, unknown>)?.remoteSyncState || ""),
      "subscribe-failed",
    );
  });
});
