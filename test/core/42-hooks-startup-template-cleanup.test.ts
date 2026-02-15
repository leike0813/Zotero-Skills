import { assert } from "chai";
import { config } from "../../package.json";
import hooks from "../../src/hooks";
import {
  BasicExampleFactory,
  KeyExampleFactory,
  PromptExampleFactory,
  UIExampleFactory,
} from "../../src/modules/examples";

type LocalizationRequest = {
  id: string;
  args?: Record<string, unknown>;
};

class MockLocalization {
  constructor(_resources: string[], _generateBundles: boolean) {}

  formatMessagesSync(requests: LocalizationRequest[]) {
    return requests.map((request) => ({
      value: request.id,
      attributes: null,
    }));
  }
}

describe("hooks startup template cleanup", function () {
  this.timeout(30000);

  let prevAddonData: unknown;
  let prevAddonHooks: unknown;
  let usedAddonObject: Record<string, unknown> | null = null;
  let prevLocalization: unknown;

  beforeEach(function () {
    const runtime = globalThis as {
      addon?: unknown;
      Localization?: unknown;
    };
    const addonObj = ((runtime.addon as Record<string, unknown> | undefined) ||
      {}) as Record<string, unknown> & {
      data?: unknown;
      hooks?: unknown;
    };
    usedAddonObject = addonObj;
    prevAddonData = addonObj.data;
    prevAddonHooks = addonObj.hooks;
    prevLocalization = runtime.Localization;
    addonObj.data = {
      ...(addonObj.data as Record<string, unknown> | undefined),
      config,
      ztoolkit:
        (addonObj.data as { ztoolkit?: unknown } | undefined)?.ztoolkit || {},
    };
    addonObj.hooks = hooks;
    if (!runtime.addon) {
      try {
        Object.defineProperty(runtime, "addon", {
          configurable: true,
          writable: true,
          value: addonObj,
        });
      } catch {
        // ignore if runtime addon cannot be assigned in this environment
      }
    }
    runtime.Localization = MockLocalization;
  });

  afterEach(function () {
    const runtime = globalThis as {
      addon?: unknown;
      Localization?: unknown;
    };
    if (usedAddonObject) {
      (usedAddonObject as { data?: unknown }).data = prevAddonData;
      (usedAddonObject as { hooks?: unknown }).hooks = prevAddonHooks;
    }
    runtime.Localization = prevLocalization;
  });

  it("keeps prefs registration but does not register template shortcut/prompt/ui examples", async function () {
    const calls = {
      registerPrefs: 0,
      registerNotifier: 0,
      registerShortcuts: 0,
      registerNormalPrompt: 0,
      registerAnonymousPrompt: 0,
      registerConditionalPrompt: 0,
      registerExtraColumn: 0,
      registerExtraColumnCustomCell: 0,
      registerItemPaneCustomInfoRow: 0,
      registerItemPaneSection: 0,
      registerReaderItemPaneSection: 0,
      registerStyleSheet: 0,
    };

    const originalRegisterPrefs = Object.getOwnPropertyDescriptor(
      BasicExampleFactory,
      "registerPrefs",
    );
    const originalRegisterNotifier = Object.getOwnPropertyDescriptor(
      BasicExampleFactory,
      "registerNotifier",
    );
    const originalRegisterShortcuts = Object.getOwnPropertyDescriptor(
      KeyExampleFactory,
      "registerShortcuts",
    );
    const originalRegisterNormalPrompt = Object.getOwnPropertyDescriptor(
      PromptExampleFactory,
      "registerNormalCommandExample",
    );
    const originalRegisterAnonymousPrompt = Object.getOwnPropertyDescriptor(
      PromptExampleFactory,
      "registerAnonymousCommandExample",
    );
    const originalRegisterConditionalPrompt = Object.getOwnPropertyDescriptor(
      PromptExampleFactory,
      "registerConditionalCommandExample",
    );
    const originalRegisterExtraColumn = Object.getOwnPropertyDescriptor(
      UIExampleFactory,
      "registerExtraColumn",
    );
    const originalRegisterExtraColumnCustomCell = Object.getOwnPropertyDescriptor(
      UIExampleFactory,
      "registerExtraColumnWithCustomCell",
    );
    const originalRegisterItemPaneCustomInfoRow = Object.getOwnPropertyDescriptor(
      UIExampleFactory,
      "registerItemPaneCustomInfoRow",
    );
    const originalRegisterItemPaneSection = Object.getOwnPropertyDescriptor(
      UIExampleFactory,
      "registerItemPaneSection",
    );
    const originalRegisterReaderItemPaneSection =
      Object.getOwnPropertyDescriptor(
        UIExampleFactory,
        "registerReaderItemPaneSection",
      );
    const originalRegisterStyleSheet = Object.getOwnPropertyDescriptor(
      UIExampleFactory,
      "registerStyleSheet",
    );

    Object.defineProperty(BasicExampleFactory, "registerPrefs", {
      configurable: true,
      writable: true,
      value: () => {
        calls.registerPrefs += 1;
      },
    });
    Object.defineProperty(BasicExampleFactory, "registerNotifier", {
      configurable: true,
      writable: true,
      value: () => {
        calls.registerNotifier += 1;
      },
    });
    Object.defineProperty(KeyExampleFactory, "registerShortcuts", {
      configurable: true,
      writable: true,
      value: () => {
        calls.registerShortcuts += 1;
      },
    });
    Object.defineProperty(PromptExampleFactory, "registerNormalCommandExample", {
      configurable: true,
      writable: true,
      value: () => {
        calls.registerNormalPrompt += 1;
      },
    });
    Object.defineProperty(
      PromptExampleFactory,
      "registerAnonymousCommandExample",
      {
        configurable: true,
        writable: true,
        value: () => {
          calls.registerAnonymousPrompt += 1;
        },
      },
    );
    Object.defineProperty(
      PromptExampleFactory,
      "registerConditionalCommandExample",
      {
        configurable: true,
        writable: true,
        value: () => {
          calls.registerConditionalPrompt += 1;
        },
      },
    );
    Object.defineProperty(UIExampleFactory, "registerExtraColumn", {
      configurable: true,
      writable: true,
      value: async () => {
        calls.registerExtraColumn += 1;
      },
    });
    Object.defineProperty(UIExampleFactory, "registerExtraColumnWithCustomCell", {
      configurable: true,
      writable: true,
      value: async () => {
        calls.registerExtraColumnCustomCell += 1;
      },
    });
    Object.defineProperty(UIExampleFactory, "registerItemPaneCustomInfoRow", {
      configurable: true,
      writable: true,
      value: () => {
        calls.registerItemPaneCustomInfoRow += 1;
      },
    });
    Object.defineProperty(UIExampleFactory, "registerItemPaneSection", {
      configurable: true,
      writable: true,
      value: () => {
        calls.registerItemPaneSection += 1;
      },
    });
    Object.defineProperty(UIExampleFactory, "registerReaderItemPaneSection", {
      configurable: true,
      writable: true,
      value: () => {
        calls.registerReaderItemPaneSection += 1;
      },
    });
    Object.defineProperty(UIExampleFactory, "registerStyleSheet", {
      configurable: true,
      writable: true,
      value: () => {
        calls.registerStyleSheet += 1;
      },
    });

    try {
      await hooks.onStartup();
    } finally {
      if (originalRegisterPrefs) {
        Object.defineProperty(
          BasicExampleFactory,
          "registerPrefs",
          originalRegisterPrefs,
        );
      }
      if (originalRegisterNotifier) {
        Object.defineProperty(
          BasicExampleFactory,
          "registerNotifier",
          originalRegisterNotifier,
        );
      }
      if (originalRegisterShortcuts) {
        Object.defineProperty(
          KeyExampleFactory,
          "registerShortcuts",
          originalRegisterShortcuts,
        );
      }
      if (originalRegisterNormalPrompt) {
        Object.defineProperty(
          PromptExampleFactory,
          "registerNormalCommandExample",
          originalRegisterNormalPrompt,
        );
      }
      if (originalRegisterAnonymousPrompt) {
        Object.defineProperty(
          PromptExampleFactory,
          "registerAnonymousCommandExample",
          originalRegisterAnonymousPrompt,
        );
      }
      if (originalRegisterConditionalPrompt) {
        Object.defineProperty(
          PromptExampleFactory,
          "registerConditionalCommandExample",
          originalRegisterConditionalPrompt,
        );
      }
      if (originalRegisterExtraColumn) {
        Object.defineProperty(
          UIExampleFactory,
          "registerExtraColumn",
          originalRegisterExtraColumn,
        );
      }
      if (originalRegisterExtraColumnCustomCell) {
        Object.defineProperty(
          UIExampleFactory,
          "registerExtraColumnWithCustomCell",
          originalRegisterExtraColumnCustomCell,
        );
      }
      if (originalRegisterItemPaneCustomInfoRow) {
        Object.defineProperty(
          UIExampleFactory,
          "registerItemPaneCustomInfoRow",
          originalRegisterItemPaneCustomInfoRow,
        );
      }
      if (originalRegisterItemPaneSection) {
        Object.defineProperty(
          UIExampleFactory,
          "registerItemPaneSection",
          originalRegisterItemPaneSection,
        );
      }
      if (originalRegisterReaderItemPaneSection) {
        Object.defineProperty(
          UIExampleFactory,
          "registerReaderItemPaneSection",
          originalRegisterReaderItemPaneSection,
        );
      }
      if (originalRegisterStyleSheet) {
        Object.defineProperty(
          UIExampleFactory,
          "registerStyleSheet",
          originalRegisterStyleSheet,
        );
      }
    }

    assert.equal(calls.registerPrefs, 1);
    assert.equal(calls.registerNotifier, 0);
    assert.equal(calls.registerShortcuts, 0);
    assert.equal(calls.registerNormalPrompt, 0);
    assert.equal(calls.registerAnonymousPrompt, 0);
    assert.equal(calls.registerConditionalPrompt, 0);
    assert.equal(calls.registerExtraColumn, 0);
    assert.equal(calls.registerExtraColumnCustomCell, 0);
    assert.equal(calls.registerItemPaneCustomInfoRow, 0);
    assert.equal(calls.registerItemPaneSection, 0);
    assert.equal(calls.registerReaderItemPaneSection, 0);
    assert.equal(calls.registerStyleSheet, 0);
  });
});
