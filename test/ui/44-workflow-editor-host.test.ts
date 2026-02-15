import { assert } from "chai";
import {
  clearWorkflowEditorRendererRegistry,
  installWorkflowEditorHostBridge,
  openWorkflowEditorSession,
  registerWorkflowEditorRenderer,
} from "../../src/modules/workflowEditorHost";

type MockDialogData = Record<string, unknown> & {
  loadCallback?: () => void;
  unloadLock?: { promise?: Promise<void> };
  _lastButtonId?: string;
};

function createRootElement() {
  return {
    style: {} as Record<string, string>,
    firstChild: null as unknown,
    removeChild: () => {},
    appendChild: () => {},
  };
}

class MockDialog {
  static nextButtons: string[] = [];

  static nextDelays: number[] = [];

  static inFlight = 0;

  static maxInFlight = 0;

  private dialogData: MockDialogData | null = null;

  private readonly root = createRootElement();

  addCell() {
    return this;
  }

  addButton() {
    return this;
  }

  setDialogData(data: MockDialogData) {
    this.dialogData = data;
    return this;
  }

  open() {
    if (!this.dialogData) {
      throw new Error("dialog data missing");
    }
    MockDialog.inFlight += 1;
    MockDialog.maxInFlight = Math.max(MockDialog.maxInFlight, MockDialog.inFlight);
    const delayMs = MockDialog.nextDelays.shift() || 0;
    const clicked = MockDialog.nextButtons.shift() || "save";

    const doc = {
      defaultView: {
        resizeTo: () => {},
      },
      getElementById: () => this.root,
    };

    const window = {
      document: doc,
    };

    const completion = new Promise<void>((resolve) => {
      setTimeout(() => {
        this.dialogData?.loadCallback?.();
        if (this.dialogData) {
          this.dialogData._lastButtonId = clicked;
        }
        MockDialog.inFlight -= 1;
        resolve();
      }, delayMs);
    });

    this.dialogData.unloadLock = { promise: completion };
    return { window };
  }
}

describe("workflow editor host", function () {
  beforeEach(function () {
    clearWorkflowEditorRendererRegistry();
    MockDialog.nextButtons = [];
    MockDialog.nextDelays = [];
    MockDialog.inFlight = 0;
    MockDialog.maxInFlight = 0;

    const runtime = globalThis as typeof globalThis & {
      addon?: {
        data?: {
          dialog?: unknown;
          ztoolkit?: { Dialog?: typeof MockDialog };
        };
      };
      ztoolkit?: { Dialog?: typeof MockDialog };
    };
    runtime.addon = {
      data: {
        ztoolkit: { Dialog: MockDialog },
      },
    };
    runtime.ztoolkit = {
      Dialog: MockDialog,
    };
    installWorkflowEditorHostBridge();
  });

  it("resolves save and cancel lifecycle consistently", async function () {
    registerWorkflowEditorRenderer("test-renderer", {
      render: () => {},
      serialize: ({ state }) => state,
    });

    MockDialog.nextButtons.push("save");
    const saved = await openWorkflowEditorSession({
      rendererId: "test-renderer",
      title: "Test Save",
      initialState: { ok: true },
    });
    assert.isTrue(saved.saved);
    assert.deepEqual(saved.result, { ok: true });

    MockDialog.nextButtons.push("cancel");
    const canceled = await openWorkflowEditorSession({
      rendererId: "test-renderer",
      title: "Test Cancel",
      initialState: { ok: false },
    });
    assert.isFalse(canceled.saved);
    assert.equal(canceled.reason, "canceled");
  });

  it("fails fast when renderer id cannot be resolved", async function () {
    let error: unknown;
    try {
      await openWorkflowEditorSession({
        rendererId: "missing-renderer",
        title: "Missing Renderer",
        initialState: {},
      });
    } catch (caught) {
      error = caught;
    }
    assert.instanceOf(error, Error);
    assert.match(String((error as Error).message), /renderer not found/i);
  });

  it("queues multiple sessions sequentially", async function () {
    registerWorkflowEditorRenderer("queue-renderer", {
      render: () => {},
      serialize: ({ state }) => state,
    });

    MockDialog.nextButtons.push("save", "save");
    MockDialog.nextDelays.push(15, 15);

    await Promise.all([
      openWorkflowEditorSession({
        rendererId: "queue-renderer",
        title: "First",
        initialState: { index: 1 },
      }),
      openWorkflowEditorSession({
        rendererId: "queue-renderer",
        title: "Second",
        initialState: { index: 2 },
      }),
    ]);

    assert.equal(MockDialog.maxInFlight, 1);
  });
});
