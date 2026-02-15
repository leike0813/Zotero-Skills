import { assert } from "chai";
import {
  collectBackendsFromDialog,
  persistBackendsConfig,
} from "../../src/modules/backendManager";

type FakeControl = {
  value?: string;
  getAttribute: (name: string) => string | null;
};

type FakeRow = {
  getAttribute: (name: string) => string | null;
  querySelector: (selector: string) => Element | null;
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
