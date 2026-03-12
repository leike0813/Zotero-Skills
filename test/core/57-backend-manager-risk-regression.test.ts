import { assert } from "chai";
import { config } from "../../package.json";
import {
  collectBackendsFromDialog,
  getBackendRowActionKindsForType,
  launchSkillRunnerManagementFromRow,
  refreshSkillRunnerModelCacheFromRow,
  persistBackendsConfig,
  resolveSkillRunnerManagementLaunchPayloadFromRow,
} from "../../src/modules/backendManager";

type FakeControl = {
  value?: string;
  getAttribute: (name: string) => string | null;
};

type FakeRow = {
  getAttribute: (name: string) => string | null;
  querySelector: (selector: string) => Element | null;
  __controls?: Map<string, FakeControl>;
};

function makeTextControl(value: string): FakeControl {
  return {
    value,
    getAttribute: () => null,
  };
}

function makeChoiceControl(value: string): FakeControl {
  return {
    getAttribute: (name: string) => {
      if (name === "data-zs-choice-control") {
        return "1";
      }
      if (name === "data-zs-choice-value") {
        return value;
      }
      return null;
    },
  };
}

function makeRow(args: {
  type: string;
  id: string;
  baseUrl: string;
  authKind: "none" | "bearer";
  authToken: string;
  timeoutMs: string;
}): FakeRow {
  const controls = new Map<string, FakeControl>([
    ["id", makeTextControl(args.id)],
    ["baseUrl", makeTextControl(args.baseUrl)],
    ["authKind", makeChoiceControl(args.authKind)],
    ["authToken", makeTextControl(args.authToken)],
    ["timeoutMs", makeTextControl(args.timeoutMs)],
  ]);

  return {
    getAttribute: (name: string) => {
      if (name === "data-zs-backend-type") {
        return args.type;
      }
      return null;
    },
    querySelector: (selector: string) => {
      const match = selector.match(/\[data-zs-backend-field="([^"]+)"\]/);
      if (!match) {
        return null;
      }
      return (controls.get(match[1]) || null) as unknown as Element | null;
    },
    __controls: controls,
  };
}

function makeDoc(rows: FakeRow[]) {
  return {
    querySelectorAll: () => rows as unknown as NodeListOf<Element>,
  } as unknown as Document;
}

describe("backend manager risk regression", function () {
  let previousAddon: unknown;

  beforeEach(function () {
    const runtime = globalThis as { addon?: Record<string, unknown> };
    previousAddon = runtime.addon;
    runtime.addon = runtime.addon || {};
    runtime.addon.data = (runtime.addon.data as Record<string, unknown>) || {};
  });

  afterEach(function () {
    const runtime = globalThis as { addon?: unknown };
    runtime.addon = previousAddon;
  });

  it("Risk: HR-01 rejects duplicated backend ids during dialog collection", function () {
    const doc = makeDoc([
      makeRow({
        type: "skillrunner",
        id: "dup-id",
        baseUrl: "http://127.0.0.1:8030",
        authKind: "none",
        authToken: "",
        timeoutMs: "600000",
      }),
      makeRow({
        type: "generic-http",
        id: "dup-id",
        baseUrl: "http://127.0.0.1:8040",
        authKind: "none",
        authToken: "",
        timeoutMs: "600000",
      }),
    ]);

    let thrown: unknown = null;
    try {
      collectBackendsFromDialog(doc);
    } catch (error) {
      thrown = error;
    }

    assert.isOk(thrown);
    assert.match(String(thrown), /duplicate|重复/i);
  });

  it("Risk: HR-01 exposes management action only for skillrunner rows", function () {
    assert.deepEqual(getBackendRowActionKindsForType("skillrunner"), [
      "manage-ui",
      "refresh-model-cache",
      "remove",
    ]);
    assert.deepEqual(getBackendRowActionKindsForType("generic-http"), [
      "remove",
    ]);
    assert.deepEqual(getBackendRowActionKindsForType(""), ["remove"]);
  });

  it("Risk: HR-01 resolves management launch payload from current row values", function () {
    const row = makeRow({
      type: "skillrunner",
      id: "skillrunner-local",
      baseUrl: "http://127.0.0.1:8030",
      authKind: "none",
      authToken: "",
      timeoutMs: "600000",
    });
    (row.__controls?.get("id") as { value?: string } | undefined)!.value =
      "skillrunner-edited";
    (row.__controls?.get("baseUrl") as { value?: string } | undefined)!.value =
      "http://127.0.0.1:9030/";

    const payload = resolveSkillRunnerManagementLaunchPayloadFromRow(
      row as unknown as Element,
    );
    assert.equal(payload.backendId, "skillrunner-edited");
    assert.equal(payload.baseUrl, "http://127.0.0.1:9030/");
    assert.equal(payload.uiUrl, "http://127.0.0.1:9030/ui");
  });

  it("Risk: HR-01 normalizes endpoint baseUrl to origin-level /ui URL", function () {
    const row = makeRow({
      type: "skillrunner",
      id: "skillrunner-local",
      baseUrl: "http://127.0.0.1:8030/v1",
      authKind: "none",
      authToken: "",
      timeoutMs: "600000",
    });
    const payload = resolveSkillRunnerManagementLaunchPayloadFromRow(
      row as unknown as Element,
    );
    assert.equal(payload.baseUrl, "http://127.0.0.1:8030/v1");
    assert.equal(payload.uiUrl, "http://127.0.0.1:8030/ui");
  });

  it("Risk: HR-01 rejects invalid management baseUrl deterministically", function () {
    const row = makeRow({
      type: "skillrunner",
      id: "skillrunner-local",
      baseUrl: "ftp://127.0.0.1:8030",
      authKind: "none",
      authToken: "",
      timeoutMs: "600000",
    });

    let thrown: unknown = null;
    try {
      resolveSkillRunnerManagementLaunchPayloadFromRow(row as unknown as Element);
    } catch (error) {
      thrown = error;
    }
    assert.isOk(thrown);
    assert.match(
      String(thrown),
      /baseUrl|http\/https|management-base-url-invalid/i,
    );
  });

  it("Risk: HR-01 launches management host with unsaved row edits", async function () {
    const row = makeRow({
      type: "skillrunner",
      id: "skillrunner-local",
      baseUrl: "http://127.0.0.1:8030",
      authKind: "none",
      authToken: "",
      timeoutMs: "600000",
    });
    (row.__controls?.get("id") as { value?: string } | undefined)!.value =
      "skillrunner-unsaved";
    (row.__controls?.get("baseUrl") as { value?: string } | undefined)!.value =
      "http://127.0.0.1:18030";

    const launched: Array<{
      backendId: string;
      baseUrl: string;
      uiUrl: string;
    }> = [];
    await launchSkillRunnerManagementFromRow({
      row: row as unknown as Element,
      openDialog: async (payload) => {
        launched.push(payload);
      },
    });

    assert.lengthOf(launched, 1);
    assert.deepEqual(launched[0], {
      backendId: "skillrunner-unsaved",
      baseUrl: "http://127.0.0.1:18030",
      uiUrl: "http://127.0.0.1:18030/ui",
    });
  });

  it("Risk: HR-01 refreshes model cache by current skillrunner row values only", async function () {
    const row = makeRow({
      type: "skillrunner",
      id: "skillrunner-local",
      baseUrl: "http://127.0.0.1:8030",
      authKind: "bearer",
      authToken: "token-123",
      timeoutMs: "600000",
    });
    (row.__controls?.get("id") as { value?: string } | undefined)!.value =
      "skillrunner-edited";
    (row.__controls?.get("baseUrl") as { value?: string } | undefined)!.value =
      "http://127.0.0.1:19030/";

    const calls: Array<{
      id: string;
      type: string;
      baseUrl: string;
      authKind: string;
      authToken?: string;
    }> = [];
    const result = await refreshSkillRunnerModelCacheFromRow({
      row: row as unknown as Element,
      refresh: async ({ backend }) => {
        calls.push({
          id: backend.id,
          type: backend.type,
          baseUrl: backend.baseUrl,
          authKind: String(backend.auth?.kind || "none"),
          authToken: backend.auth?.token,
        });
        return {
          ok: true,
          refreshedAt: "2026-03-11T00:00:00.000Z",
          backendId: backend.id,
        };
      },
    });

    assert.lengthOf(calls, 1);
    assert.deepEqual(calls[0], {
      id: "skillrunner-edited",
      type: "skillrunner",
      baseUrl: "http://127.0.0.1:19030/",
      authKind: "bearer",
      authToken: "token-123",
    });
    assert.deepEqual(result, {
      ok: true,
      refreshedAt: "2026-03-11T00:00:00.000Z",
      backendId: "skillrunner-edited",
    });
  });

  it("Risk: HR-01 rejects bearer backend rows without token", function () {
    const doc = makeDoc([
      makeRow({
        type: "skillrunner",
        id: "skillrunner-local",
        baseUrl: "http://127.0.0.1:8030",
        authKind: "bearer",
        authToken: "",
        timeoutMs: "600000",
      }),
    ]);

    let thrown: unknown = null;
    try {
      collectBackendsFromDialog(doc);
    } catch (error) {
      thrown = error;
    }

    assert.isOk(thrown);
    assert.match(String(thrown), /bearer|必填/i);
  });

  it("Risk: HR-01 persists validated backend config and refreshes workflow menus", function () {
    let persistedKey = "";
    let persistedValue = "";
    let refreshCalls = 0;

    persistBackendsConfig(
      [
        {
          id: "skillrunner-local",
          type: "skillrunner",
          baseUrl: "http://127.0.0.1:8030",
          auth: { kind: "none" },
          defaults: { timeout_ms: 600000 },
        },
      ],
      {
        setPref: ((key: string, value: string) => {
          persistedKey = key;
          persistedValue = value;
        }) as any,
        refreshWorkflowMenus: () => {
          refreshCalls += 1;
        },
      },
    );

    assert.equal(persistedKey, "backendsConfigJson");
    const parsed = JSON.parse(persistedValue) as {
      backends?: Array<{ id?: string }>;
    };
    assert.equal(parsed.backends?.[0]?.id, "skillrunner-local");
    assert.equal(refreshCalls, 1);
  });

  it("Risk: HR-01 preserves existing management_auth when dialog row omits it", function () {
    const prefKey = `${config.prefsPrefix}.backendsConfigJson`;
    const previous = Zotero.Prefs.get(prefKey, true);
    Zotero.Prefs.set(
      prefKey,
      JSON.stringify({
        backends: [
          {
            id: "skillrunner-local",
            type: "skillrunner",
            baseUrl: "http://127.0.0.1:8030",
            auth: { kind: "none" },
            management_auth: {
              kind: "basic",
              username: "admin",
              password: "secret",
            },
          },
        ],
      }),
      true,
    );

    let persisted = "";
    try {
      persistBackendsConfig(
        [
          {
            id: "skillrunner-local",
            type: "skillrunner",
            baseUrl: "http://127.0.0.1:8030",
            auth: { kind: "none" },
          },
        ],
        {
          setPref: ((_: string, value: string) => {
            persisted = value;
          }) as any,
          refreshWorkflowMenus: () => {},
        },
      );
    } finally {
      if (typeof previous === "undefined") {
        Zotero.Prefs.clear(prefKey, true);
      } else {
        Zotero.Prefs.set(prefKey, previous, true);
      }
    }

    const parsed = JSON.parse(persisted) as {
      backends: Array<{ management_auth?: { kind?: string; username?: string } }>;
    };
    assert.deepEqual(parsed.backends[0].management_auth, {
      kind: "basic",
      username: "admin",
      password: "secret",
    });
  });

  it("Risk: HR-01 surfaces persistence failures without swallowing storage errors", function () {
    let refreshCalls = 0;
    let thrown: unknown = null;

    try {
      persistBackendsConfig(
        [
          {
            id: "skillrunner-local",
            type: "skillrunner",
            baseUrl: "http://127.0.0.1:8030",
            auth: { kind: "none" },
          },
        ],
        {
          setPref: (() => {
            throw new Error("disk is readonly");
          }) as any,
          refreshWorkflowMenus: () => {
            refreshCalls += 1;
          },
        },
      );
    } catch (error) {
      thrown = error;
    }

    assert.isOk(thrown);
    assert.match(String(thrown), /disk is readonly/i);
    assert.equal(refreshCalls, 0);
  });
});
