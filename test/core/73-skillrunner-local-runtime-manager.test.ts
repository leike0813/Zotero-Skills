import { assert } from "chai";
import { config } from "../../package.json";
import { loadBackendsRegistry } from "../../src/backends/registry";
import {
  buildManualDeployCommands,
  deployAndConfigureLocalSkillRunner,
  ensureManagedLocalRuntimeForBackend,
  getManagedLocalRuntimeStateSnapshot,
  getLocalRuntimeManualDeployCommands,
  readManagedLocalRuntimeState,
  resetLocalRuntimeAutoStartSessionState,
  releaseManagedLocalRuntimeLeaseOnShutdown,
  setLocalRuntimeAutoPullEnabled,
  setSkillRunnerCtlBridgeFactoryForTests,
  setSkillRunnerReleaseInstallerForTests,
  startLocalRuntime,
  stopLocalRuntime,
  toggleLocalRuntimeAutoPull,
  uninstallLocalRuntime,
} from "../../src/modules/skillRunnerLocalRuntimeManager";
import type { SkillRunnerCtlCommandResult } from "../../src/modules/skillRunnerCtlBridge";

function makeCtlResult(args: {
  ok: boolean;
  message?: string;
  details?: Record<string, unknown>;
}): SkillRunnerCtlCommandResult {
  return {
    ok: args.ok,
    exitCode: args.ok ? 0 : 1,
    message: args.message || (args.ok ? "ok" : "failed"),
    stdout: "",
    stderr: "",
    details: args.details || {},
    command: "mock",
    args: [],
  };
}

describe("skillrunner local runtime manager", function () {
  this.timeout(30000);

  const backendsConfigPrefKey = `${config.prefsPrefix}.backendsConfigJson`;
  const localRuntimeStatePrefKey = `${config.prefsPrefix}.skillRunnerLocalRuntimeStateJson`;
  const localRuntimeVersionPrefKey = `${config.prefsPrefix}.skillRunnerLocalRuntimeVersion`;

  let prevBackendsConfigPref: unknown;
  let prevStatePref: unknown;
  let prevVersionPref: unknown;
  let prevFetch: unknown;
  let prevIOUtils: unknown;

  beforeEach(function () {
    prevBackendsConfigPref = Zotero.Prefs.get(backendsConfigPrefKey, true);
    prevStatePref = Zotero.Prefs.get(localRuntimeStatePrefKey, true);
    prevVersionPref = Zotero.Prefs.get(localRuntimeVersionPrefKey, true);
    prevFetch = (globalThis as { fetch?: unknown }).fetch;
    prevIOUtils = (globalThis as { IOUtils?: unknown }).IOUtils;
    Zotero.Prefs.set(
      backendsConfigPrefKey,
      JSON.stringify({
        backends: [
          {
            id: "generic-http-local",
            type: "generic-http",
            baseUrl: "http://127.0.0.1:9000",
            auth: { kind: "none" },
          },
        ],
      }),
      true,
    );
    Zotero.Prefs.clear(localRuntimeStatePrefKey, true);
    Zotero.Prefs.set(localRuntimeVersionPrefKey, "v0.5.2", true);
    delete (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { IOUtils?: unknown }).IOUtils = {
      exists: async () => true,
      readUTF8: async () =>
        JSON.stringify({
          summary: {
            outcome: "ok",
            failed_engines: [],
          },
        }),
    };
    setSkillRunnerReleaseInstallerForTests(async (args) => ({
      ok: true,
      stage: "deploy-release-install",
      message: "installed",
      installDir: `${args.installRoot}\\${args.version}`,
      details: {
        downloadProof: {
          artifactUrl: "https://example.invalid/artifact.tar.gz",
        },
        checksumProof: {
          matched: true,
        },
        extractProof: {
          installDir: `${args.installRoot}\\${args.version}`,
        },
      },
    }));
    resetLocalRuntimeAutoStartSessionState();
  });

  afterEach(async function () {
    if (typeof prevBackendsConfigPref === "undefined") {
      Zotero.Prefs.clear(backendsConfigPrefKey, true);
    } else {
      Zotero.Prefs.set(backendsConfigPrefKey, prevBackendsConfigPref, true);
    }
    if (typeof prevStatePref === "undefined") {
      Zotero.Prefs.clear(localRuntimeStatePrefKey, true);
    } else {
      Zotero.Prefs.set(localRuntimeStatePrefKey, prevStatePref, true);
    }
    if (typeof prevVersionPref === "undefined") {
      Zotero.Prefs.clear(localRuntimeVersionPrefKey, true);
    } else {
      Zotero.Prefs.set(localRuntimeVersionPrefKey, prevVersionPref, true);
    }
    if (typeof prevFetch === "undefined") {
      delete (globalThis as { fetch?: unknown }).fetch;
    } else {
      (globalThis as { fetch?: unknown }).fetch = prevFetch;
    }
    if (typeof prevIOUtils === "undefined") {
      delete (globalThis as { IOUtils?: unknown }).IOUtils;
    } else {
      (globalThis as { IOUtils?: unknown }).IOUtils = prevIOUtils;
    }
    setSkillRunnerCtlBridgeFactoryForTests();
    setSkillRunnerReleaseInstallerForTests();
    await releaseManagedLocalRuntimeLeaseOnShutdown();
  });

  it("deploys with bootstrap only and configures managed backend", async function () {
    const commands: string[] = [];
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: (installDir: string) =>
            `${installDir}\\scripts\\skill-runnerctl.ps1`,
          runCtlCommand: async (args: { command: string }) => {
            commands.push(args.command);
            return args.command === "bootstrap"
              ? makeCtlResult({
                  ok: true,
                  details: {
                    bootstrap_report_file: "C:\\SkillRunner\\data\\agent_bootstrap_report.json",
                  },
                })
              : makeCtlResult({ ok: true });
          },
        }) as any,
    );
    await setLocalRuntimeAutoPullEnabled(true);

    const result = await deployAndConfigureLocalSkillRunner({
      version: "v0.5.2",
    });

    assert.isTrue(result.ok);
    assert.deepEqual(commands, ["bootstrap"]);
    const loaded = await loadBackendsRegistry();
    const managed = loaded.backends.find((entry) => entry.id === "skillrunner-local");
    assert.isOk(managed);
    assert.equal(managed?.baseUrl, "http://127.0.0.1:29813");
    const state = readManagedLocalRuntimeState();
    assert.equal(state.managedBackendId, "skillrunner-local");
    assert.equal(state.runtimeState, "stopped");
    assert.isUndefined((state as { deploymentState?: unknown }).deploymentState);
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.autoStartPaused, false);
  });

  it("keeps deploy successful with warning when bootstrap report is partial_failure", async function () {
    (globalThis as { IOUtils?: unknown }).IOUtils = {
      exists: async () => true,
      readUTF8: async () =>
        JSON.stringify({
          summary: {
            outcome: "partial_failure",
            failed_engines: ["opencode"],
          },
        }),
    };
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: (installDir: string) =>
            `${installDir}\\scripts\\skill-runnerctl.ps1`,
          runCtlCommand: async (args: { command: string }) =>
            args.command === "bootstrap"
              ? makeCtlResult({
                  ok: true,
                  details: {
                    bootstrap_report_file: "C:\\SkillRunner\\data\\agent_bootstrap_report.json",
                  },
                })
              : makeCtlResult({ ok: true }),
        }) as any,
    );

    const result = await deployAndConfigureLocalSkillRunner({
      version: "v0.5.2",
    });

    assert.isTrue(result.ok);
    assert.equal(result.details?.bootstrapOutcome, "partial_failure");
    assert.deepEqual(result.details?.bootstrapFailedEngines, ["opencode"]);
    assert.include(String(result.message || ""), "bootstrap warning");
  });

  it("fails deploy when ctl bootstrap payload misses bootstrap report path", async function () {
    const commands: string[] = [];
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: (installDir: string) =>
            `${installDir}\\scripts\\skill-runnerctl.ps1`,
          runCtlCommand: async (args: { command: string }) => {
            commands.push(args.command);
            return makeCtlResult({ ok: true });
          },
        }) as any,
    );

    const result = await deployAndConfigureLocalSkillRunner({
      version: "v0.5.2",
    });

    assert.isFalse(result.ok);
    assert.equal(result.stage, "deploy-bootstrap-report");
    assert.include(
      String(result.message || ""),
      "bootstrap report path missing in ctl bootstrap response",
    );
    assert.deepEqual(commands, ["bootstrap"]);
  });

  it("ensures runtime with preflight -> up -> status and then acquires lease", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "skillrunner-local",
        runtimeState: "stopped",
        autoStartPaused: false,
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
        baseUrl: "http://127.0.0.1:29813",
        requestedPort: 29813,
        portFallbackSpan: 10,
      }),
      true,
    );
    const commandTrail: string[] = [];
    let statusCalls = 0;
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async (args: { command: string }) => {
            commandTrail.push(args.command);
            if (args.command === "status") {
              statusCalls += 1;
              if (statusCalls === 1) {
                return makeCtlResult({
                  ok: true,
                  details: { status: "stopped" },
                });
              }
              return makeCtlResult({
                ok: true,
                details: {
                  status: "running",
                  host: "127.0.0.1",
                  port: 29815,
                  url: "http://127.0.0.1:29815/",
                },
              });
            }
            if (args.command === "preflight") {
              return makeCtlResult({
                ok: true,
                details: {
                  blocking_issues: [],
                },
              });
            }
            if (args.command === "up") {
              return makeCtlResult({
                ok: true,
                details: {
                  host: "127.0.0.1",
                  port: 29815,
                  url: "http://127.0.0.1:29815/",
                  requested_port: 29813,
                  port_fallback_span: 10,
                  port_fallback_used: true,
                  tried_ports: [29813, 29814, 29815],
                },
              });
            }
            return makeCtlResult({ ok: true });
          },
        }) as any,
    );
    const fetchCalls: Array<{
      url: string;
      body: Record<string, unknown>;
    }> = [];
    (globalThis as { fetch?: unknown }).fetch = async (
      input: unknown,
      init?: unknown,
    ) => {
      const url = String(input || "");
      const body = JSON.parse(
        String((init as { body?: unknown } | undefined)?.body || "{}"),
      ) as Record<string, unknown>;
      fetchCalls.push({ url, body });
      if (url.endsWith("/lease/acquire")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              lease_id: "lease-1",
              heartbeat_interval_seconds: 12,
            }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      } as Response;
    };
    await setLocalRuntimeAutoPullEnabled(true);

    const result = await ensureManagedLocalRuntimeForBackend("skillrunner-local");

    assert.isTrue(result.ok);
    assert.deepEqual(commandTrail, ["status", "preflight", "up", "status"]);
    const state = readManagedLocalRuntimeState();
    assert.equal(state.runtimeState, "running");
    assert.equal(state.runtimePort, 29815);
    assert.isTrue(state.lease?.acquired);
    const acquireCall = fetchCalls.find((entry) =>
      entry.url.includes("/v1/local-runtime/lease/acquire"),
    );
    assert.isOk(acquireCall);
    assert.equal(acquireCall?.body.owner_id, "zotero-plugin");
    assert.deepEqual(acquireCall?.body.metadata, {
      client: "zotero-plugin",
    });
  });

  it("blocks runtime start when preflight fails", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "skillrunner-local",
        runtimeState: "stopped",
        autoStartPaused: false,
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
        baseUrl: "http://127.0.0.1:29813",
      }),
      true,
    );
    const commandTrail: string[] = [];
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async (args: { command: string }) => {
            commandTrail.push(args.command);
            if (args.command === "status") {
              return makeCtlResult({
                ok: true,
                details: { status: "stopped" },
              });
            }
            if (args.command === "preflight") {
              return makeCtlResult({
                ok: false,
                message: "preflight blocked",
                details: {
                  blocking_issues: [{ code: "integrity_missing" }],
                },
              });
            }
            return makeCtlResult({ ok: true });
          },
        }) as any,
    );
    await setLocalRuntimeAutoPullEnabled(true);

    const result = await ensureManagedLocalRuntimeForBackend("skillrunner-local");

    assert.isFalse(result.ok);
    assert.equal(result.stage, "ensure-preflight");
    assert.deepEqual(commandTrail, ["status", "preflight"]);
  });

  it("start keeps auto-start switch unchanged and still follows preflight startup chain", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "skillrunner-local",
        runtimeState: "stopped",
        autoStartPaused: true,
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
        baseUrl: "http://127.0.0.1:29813",
      }),
      true,
    );
    const commandTrail: string[] = [];
    let statusCalls = 0;
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async (args: { command: string }) => {
            commandTrail.push(args.command);
            if (args.command === "status") {
              statusCalls += 1;
              return makeCtlResult({
                ok: true,
                details: { status: statusCalls === 1 ? "stopped" : "running" },
              });
            }
            if (args.command === "preflight") {
              return makeCtlResult({ ok: true });
            }
            return makeCtlResult({ ok: true });
          },
        }) as any,
    );
    (globalThis as { fetch?: unknown }).fetch = async (input: unknown) =>
      ({
        ok: true,
        status: 200,
        text: async () =>
          String(input).includes("/lease/acquire")
            ? JSON.stringify({
                lease_id: "lease-start",
                heartbeat_interval_seconds: 11,
              })
            : JSON.stringify({ ok: true }),
      }) as Response;

    const result = await startLocalRuntime();

    assert.isTrue(result.ok);
    assert.equal(result.stage, "start-complete");
    assert.deepEqual(commandTrail, ["status", "preflight", "up", "status"]);
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.autoStartPaused, true);
  });

  it("toggles auto-pull state and reflects it in snapshot", async function () {
    await setLocalRuntimeAutoPullEnabled(false);
    const first = getManagedLocalRuntimeStateSnapshot();
    assert.equal(first.details?.autoStartPaused, true);

    const toggled = await toggleLocalRuntimeAutoPull();
    assert.isTrue(toggled.ok);
    const second = getManagedLocalRuntimeStateSnapshot();
    assert.equal(second.details?.autoStartPaused, false);
  });

  it("stop marks runtime stopped without mutating auto-start switch", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "skillrunner-local",
        runtimeState: "running",
        autoStartPaused: false,
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
        lease: {
          acquired: true,
          leaseId: "lease-stop",
        },
      }),
      true,
    );
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async () => makeCtlResult({ ok: true }),
        }) as any,
    );
    const fetchCalls: Array<Record<string, unknown>> = [];
    (globalThis as { fetch?: unknown }).fetch = async (
      _input: unknown,
      init?: unknown,
    ) => {
      fetchCalls.push(
        JSON.parse(String((init as { body?: unknown } | undefined)?.body || "{}")),
      );
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      } as Response;
    };
    await setLocalRuntimeAutoPullEnabled(true);

    const result = await stopLocalRuntime();

    assert.isTrue(result.ok);
    const state = readManagedLocalRuntimeState();
    assert.equal(state.runtimeState, "stopped");
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.autoStartPaused, false);
    assert.equal(fetchCalls[0].lease_id, "lease-stop");
  });

  it("uninstall runs plugin-side orchestration and clears state on full success", async function () {
    Zotero.Prefs.set(
      backendsConfigPrefKey,
      JSON.stringify({
        backends: [
          {
            id: "skillrunner-local",
            type: "skillrunner",
            baseUrl: "http://127.0.0.1:29813",
            auth: { kind: "none" },
          },
        ],
      }),
      true,
    );
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "skillrunner-local",
        installDir: "C:\\SkillRunner\\releases\\v0.5.2",
        ctlPath: "C:\\SkillRunner\\releases\\v0.5.2\\scripts\\skill-runnerctl.ps1",
      }),
      true,
    );
    const deletedPaths: string[] = [];
    const existingPaths = new Set([
      "C:\\SkillRunner\\releases\\v0.5.2\\scripts\\skill-runnerctl.ps1",
      "C:\\SkillRunner\\releases",
      "C:\\SkillRunner\\agent-cache\\npm",
      "C:\\SkillRunner\\agent-cache\\uv_cache",
      "C:\\SkillRunner\\agent-cache\\uv_venv",
      "C:\\SkillRunner\\data",
      "C:\\SkillRunner\\agent-cache\\agent-home",
    ]);
    (globalThis as { IOUtils?: unknown }).IOUtils = {
      exists: async (path: string) => existingPaths.has(path),
      remove: async (path: string) => {
        deletedPaths.push(path);
        existingPaths.delete(path);
      },
    };
    const ctlCommands: string[] = [];
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async (args: { command: string }) => {
            ctlCommands.push(args.command);
            return makeCtlResult({ ok: true });
          },
        }) as any,
    );
    await setLocalRuntimeAutoPullEnabled(true);

    const result = await uninstallLocalRuntime();

    assert.isTrue(result.ok);
    assert.equal(result.stage, "uninstall-complete");
    assert.deepEqual(ctlCommands, ["down"]);
    assert.sameMembers(deletedPaths, [
      "C:\\SkillRunner\\releases",
      "C:\\SkillRunner\\agent-cache\\npm",
      "C:\\SkillRunner\\agent-cache\\uv_cache",
      "C:\\SkillRunner\\agent-cache\\uv_venv",
    ]);
    assert.deepEqual(result.details?.preserved_paths, [
      "C:\\SkillRunner\\data",
      "C:\\SkillRunner\\agent-cache\\agent-home",
    ]);
    assert.deepEqual(result.details?.failed_paths, []);
    const loaded = await loadBackendsRegistry();
    assert.isUndefined(loaded.backends.find((entry) => entry.id === "skillrunner-local"));
    assert.deepEqual(readManagedLocalRuntimeState(), {});
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.autoStartPaused, false);
  });

  it("uninstall fails when managed localRoot cannot be resolved safely", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "skillrunner-local",
        ctlPath: "C:\\SkillRunner\\releases\\v0.5.2\\scripts\\skill-runnerctl.ps1",
      }),
      true,
    );
    let downCalled = false;
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async () => {
            downCalled = true;
            return makeCtlResult({ ok: true });
          },
        }) as any,
    );

    const result = await uninstallLocalRuntime();

    assert.isFalse(result.ok);
    assert.equal(result.stage, "uninstall-local-root");
    assert.isFalse(downCalled);
  });

  it("uninstall aborts on down failure and keeps state for diagnosis", async function () {
    Zotero.Prefs.set(
      backendsConfigPrefKey,
      JSON.stringify({
        backends: [
          {
            id: "skillrunner-local",
            type: "skillrunner",
            baseUrl: "http://127.0.0.1:29813",
            auth: { kind: "none" },
          },
        ],
      }),
      true,
    );
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "skillrunner-local",
        installDir: "C:\\SkillRunner\\releases\\v0.5.2",
        ctlPath: "C:\\SkillRunner\\releases\\v0.5.2\\scripts\\skill-runnerctl.ps1",
      }),
      true,
    );
    let removeCalled = false;
    (globalThis as { IOUtils?: unknown }).IOUtils = {
      exists: async () => true,
      remove: async () => {
        removeCalled = true;
      },
    };
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async () =>
            makeCtlResult({
              ok: false,
              message: "down failed",
            }),
        }) as any,
    );

    const result = await uninstallLocalRuntime();

    assert.isFalse(result.ok);
    assert.equal(result.stage, "uninstall-down");
    assert.isFalse(removeCalled);
    const loaded = await loadBackendsRegistry();
    assert.isOk(loaded.backends.find((entry) => entry.id === "skillrunner-local"));
    assert.notDeepEqual(readManagedLocalRuntimeState(), {});
  });

  it("uninstall respects clear flags and keeps state when deletion fails", async function () {
    Zotero.Prefs.set(
      backendsConfigPrefKey,
      JSON.stringify({
        backends: [
          {
            id: "skillrunner-local",
            type: "skillrunner",
            baseUrl: "http://127.0.0.1:29813",
            auth: { kind: "none" },
          },
        ],
      }),
      true,
    );
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "skillrunner-local",
        installDir: "C:\\SkillRunner\\releases\\v0.5.2",
        ctlPath: "C:\\SkillRunner\\releases\\v0.5.2\\scripts\\skill-runnerctl.ps1",
      }),
      true,
    );
    const removedPaths: string[] = [];
    const existingPaths = new Set([
      "C:\\SkillRunner\\releases\\v0.5.2\\scripts\\skill-runnerctl.ps1",
      "C:\\SkillRunner\\releases",
      "C:\\SkillRunner\\agent-cache\\npm",
      "C:\\SkillRunner\\agent-cache\\uv_cache",
      "C:\\SkillRunner\\agent-cache\\uv_venv",
      "C:\\SkillRunner\\data",
      "C:\\SkillRunner\\agent-cache\\agent-home",
      "C:\\SkillRunner",
    ]);
    (globalThis as { IOUtils?: unknown }).IOUtils = {
      exists: async (path: string) => existingPaths.has(path),
      remove: async (path: string) => {
        if (/uv_cache$/i.test(path)) {
          throw new Error("permission denied");
        }
        removedPaths.push(path);
        if (/^C:\\SkillRunner$/i.test(path) && existingPaths.has("C:\\SkillRunner\\agent-cache\\uv_cache")) {
          throw new Error("directory not empty");
        }
        for (const existingPath of Array.from(existingPaths.values())) {
          if (
            existingPath === path ||
            existingPath.startsWith(`${path}\\`) ||
            existingPath.startsWith(`${path}/`)
          ) {
            existingPaths.delete(existingPath);
          }
        }
      },
    };
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async () => makeCtlResult({ ok: true }),
        }) as any,
    );

    const result = await uninstallLocalRuntime({
      clearData: true,
      clearAgentHome: true,
    });

    assert.isFalse(result.ok);
    assert.equal(result.stage, "uninstall-delete");
    assert.includeDeepMembers(removedPaths, [
      "C:\\SkillRunner\\releases",
      "C:\\SkillRunner\\agent-cache\\npm",
      "C:\\SkillRunner\\agent-cache\\uv_venv",
      "C:\\SkillRunner\\data",
      "C:\\SkillRunner\\agent-cache\\agent-home",
      "C:\\SkillRunner",
    ]);
    assert.deepEqual(result.details?.preserved_paths, []);
    assert.includeDeepMembers(result.details?.failed_paths as string[], [
      "C:\\SkillRunner\\agent-cache\\uv_cache",
    ]);
    const loaded = await loadBackendsRegistry();
    assert.isOk(loaded.backends.find((entry) => entry.id === "skillrunner-local"));
    assert.notDeepEqual(readManagedLocalRuntimeState(), {});
  });

  it("uninstall continues cleanup when ctl path is missing", async function () {
    Zotero.Prefs.set(
      backendsConfigPrefKey,
      JSON.stringify({
        backends: [
          {
            id: "skillrunner-local",
            type: "skillrunner",
            baseUrl: "http://127.0.0.1:29813",
            auth: { kind: "none" },
          },
        ],
      }),
      true,
    );
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "skillrunner-local",
        installDir: "C:\\SkillRunner\\releases\\v0.5.2",
        ctlPath: "C:\\SkillRunner\\releases\\v0.5.2\\scripts\\skill-runnerctl.ps1",
      }),
      true,
    );
    const deletedPaths: string[] = [];
    const existingPaths = new Set([
      "C:\\SkillRunner\\releases",
      "C:\\SkillRunner\\agent-cache\\npm",
      "C:\\SkillRunner\\agent-cache\\uv_cache",
      "C:\\SkillRunner\\agent-cache\\uv_venv",
    ]);
    (globalThis as { IOUtils?: unknown }).IOUtils = {
      exists: async (path: string) => existingPaths.has(path),
      remove: async (path: string) => {
        deletedPaths.push(path);
        existingPaths.delete(path);
      },
    };
    let downCalled = false;
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async () => {
            downCalled = true;
            return makeCtlResult({ ok: true });
          },
        }) as any,
    );

    const result = await uninstallLocalRuntime();

    assert.isTrue(result.ok);
    assert.equal(result.stage, "uninstall-complete");
    assert.isFalse(downCalled);
    assert.sameMembers(deletedPaths, [
      "C:\\SkillRunner\\releases",
      "C:\\SkillRunner\\agent-cache\\npm",
      "C:\\SkillRunner\\agent-cache\\uv_cache",
      "C:\\SkillRunner\\agent-cache\\uv_venv",
    ]);
    assert.equal(result.details?.down_result?.invoked, false);
  });

  it("reads bootstrap report from ctl bootstrap payload path when available", async function () {
    const readPaths: string[] = [];
    (globalThis as { IOUtils?: unknown }).IOUtils = {
      exists: async () => true,
      readUTF8: async (path: string) => {
        readPaths.push(path);
        return JSON.stringify({
          summary: {
            outcome: "ok",
            failed_engines: [],
          },
        });
      },
    };
    const reportPath = "C:\\SkillRunner\\data\\agent_bootstrap_report.json";
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: (installDir: string) =>
            `${installDir}\\scripts\\skill-runnerctl.ps1`,
          runCtlCommand: async (args: { command: string }) =>
            args.command === "bootstrap"
              ? makeCtlResult({
                  ok: true,
                  details: {
                    bootstrap_report_file: reportPath,
                  },
                })
              : makeCtlResult({ ok: true }),
        }) as any,
    );

    const result = await deployAndConfigureLocalSkillRunner({
      version: "v0.5.2",
    });

    assert.isTrue(result.ok);
    assert.deepEqual(readPaths, [reportPath]);
  });

  it("uses session-only auto-start switch and ignores persisted autoStartPaused field", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "skillrunner-local",
        runtimeState: "stopped",
        autoStartPaused: false,
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
        baseUrl: "http://127.0.0.1:29813",
      }),
      true,
    );
    const firstSnapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(firstSnapshot.details?.autoStartPaused, true);

    await setLocalRuntimeAutoPullEnabled(true);
    const secondSnapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(secondSnapshot.details?.autoStartPaused, false);
    assert.equal(readManagedLocalRuntimeState().autoStartPaused, false);

    resetLocalRuntimeAutoStartSessionState();
    const resetSnapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(resetSnapshot.details?.autoStartPaused, true);
  });

  it("treats unset auto-start flag as paused and only toggle can enable it", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "skillrunner-local",
        runtimeState: "stopped",
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
        baseUrl: "http://127.0.0.1:29813",
      }),
      true,
    );
    const ensureResult = await ensureManagedLocalRuntimeForBackend("skillrunner-local");
    assert.isTrue(ensureResult.ok);
    assert.equal(ensureResult.stage, "ensure-skipped-paused");

    const toggleResult = await toggleLocalRuntimeAutoPull();
    assert.isTrue(toggleResult.ok);
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.autoStartPaused, false);
  });

  it("builds manual deploy commands with preflight before up", async function () {
    const commandText = buildManualDeployCommands({
      version: "v0.4.4",
      installRoot: "C:\\Users\\tester\\AppData\\Local\\SkillRunner\\releases",
      host: "127.0.0.1",
      port: 29813,
      portFallbackSpan: 10,
    });
    assert.include(commandText, "bootstrap --json");
    assert.include(commandText, "preflight");
    assert.include(commandText, "up --mode local");

    const result = await getLocalRuntimeManualDeployCommands({
      version: "v0.4.4",
    });
    assert.isTrue(result.ok);
    assert.equal(result.stage, "manual-deploy-commands");
    assert.include(String(result.details?.commands || ""), "preflight");
  });

  it("state snapshot omits deployment state", async function () {
    await setLocalRuntimeAutoPullEnabled(false);
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.isTrue(snapshot.ok);
    assert.equal(snapshot.stage, "state");
    assert.isUndefined((snapshot.details || {}).deploymentState);
  });
});
