import { assert } from "chai";
import {
  installRuntimeBridgeOverrideForTests,
  resetRuntimeBridgeOverrideForTests,
  resolveAddonName,
  resolveAddonRef,
  resolveRuntimeAddon,
  resolveRuntimeAlert,
  resolveRuntimeToolkit,
  resolveToolkitMember,
} from "../../src/utils/runtimeBridge";

describe("runtime bridge", function () {
  beforeEach(function () {
    resetRuntimeBridgeOverrideForTests();
  });

  afterEach(function () {
    resetRuntimeBridgeOverrideForTests();
  });

  it("resolves addon/toolkit capabilities from injected override", function () {
    const dialogCtor = function MockDialog() {} as unknown as new (
      rows: number,
      columns: number,
    ) => unknown;
    const progressCtor = function MockProgress() {} as unknown as new (
      title: string,
    ) => unknown;

    installRuntimeBridgeOverrideForTests({
      addon: {
        data: {
          config: {
            addonName: "Runtime Bridge Addon",
            addonRef: "runtime-bridge",
          },
          ztoolkit: {
            Dialog: dialogCtor,
            ProgressWindow: progressCtor,
          },
        },
      },
      ztoolkit: {
        Dialog: dialogCtor,
        ProgressWindow: progressCtor,
      },
    });

    assert.equal(resolveAddonName("fallback"), "Runtime Bridge Addon");
    assert.equal(resolveAddonRef("fallback"), "runtime-bridge");
    assert.strictEqual(resolveToolkitMember("Dialog"), dialogCtor);
    assert.strictEqual(resolveToolkitMember("ProgressWindow"), progressCtor);
  });

  it("supports forcing unavailable capability path via explicit undefined override", function () {
    installRuntimeBridgeOverrideForTests({
      addon: undefined,
      ztoolkit: undefined,
    });

    assert.isUndefined(resolveRuntimeAddon());
    assert.isUndefined(resolveRuntimeToolkit());
    assert.equal(resolveAddonName("fallback"), "fallback");
    assert.equal(resolveAddonRef("fallback"), "fallback");
    assert.isUndefined(resolveToolkitMember("Dialog"));
  });

  it("resolves alert capability with window -> toolkit -> global fallback order", function () {
    const calls: string[] = [];
    const previousGlobalAlert = (globalThis as { alert?: (message: string) => void })
      .alert;

    try {
      installRuntimeBridgeOverrideForTests({
        ztoolkit: {
          getGlobal: (name: string) =>
            name === "alert"
              ? (message: string) => calls.push(`toolkit:${message}`)
              : undefined,
        },
      });

      const windowAlert = resolveRuntimeAlert({
        alert: (message: string) => calls.push(`window:${message}`),
      });
      windowAlert?.("a");

      const toolkitAlert = resolveRuntimeAlert();
      toolkitAlert?.("b");

      installRuntimeBridgeOverrideForTests({
        addon: undefined,
        ztoolkit: undefined,
      });
      (globalThis as { alert?: (message: string) => void }).alert = (
        message: string,
      ) => calls.push(`global:${message}`);
      const globalAlert = resolveRuntimeAlert();
      globalAlert?.("c");
    } finally {
      (globalThis as { alert?: (message: string) => void }).alert =
        previousGlobalAlert;
    }

    assert.deepEqual(calls, ["window:a", "toolkit:b", "global:c"]);
  });
});
