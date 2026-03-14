import { assert } from "chai";
import { config } from "../../package.json";
import { loadBackendsRegistry } from "../../src/backends/registry";
import {
  buildManualDeployCommands,
  deployAndConfigureLocalSkillRunner,
  ensureManagedLocalRuntimeForBackend,
  resetManagedLocalRuntimeStateChangeListenersForTests,
  resetManagedRuntimeAsyncTriggerForTests,
  resetLocalRuntimeToastStateForTests,
  getManagedLocalRuntimeStateSnapshot,
  getLocalRuntimeManualDeployCommands,
  readManagedLocalRuntimeState,
  setManagedLocalRuntimePostUpTaskReconcileRunnerForTests,
  resetLocalRuntimeAutoStartSessionState,
  releaseManagedLocalRuntimeLeaseOnShutdown,
  runManagedRuntimeAutoEnsureTickForTests,
  runManagedRuntimeStartupPreflightProbe,
  setLocalRuntimeAutoPullEnabled,
  setLocalRuntimeToastEmitterForTests,
  setSuppressManagedRuntimeAutoEnsureTriggerForTests,
  setSkillRunnerCtlBridgeFactoryForTests,
  setSkillRunnerReleaseInstallerForTests,
  startLocalRuntime,
  stopLocalRuntime,
  subscribeManagedLocalRuntimeStateChange,
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

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function sleepMsForTest(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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
    (globalThis as { fetch?: unknown }).fetch = undefined;
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
    resetManagedLocalRuntimeStateChangeListenersForTests();
    resetManagedRuntimeAsyncTriggerForTests();
    resetLocalRuntimeToastStateForTests();
    setSuppressManagedRuntimeAutoEnsureTriggerForTests(true);
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
    resetManagedLocalRuntimeStateChangeListenersForTests();
    resetManagedRuntimeAsyncTriggerForTests();
    resetLocalRuntimeToastStateForTests();
    setManagedLocalRuntimePostUpTaskReconcileRunnerForTests();
    setSuppressManagedRuntimeAutoEnsureTriggerForTests(false);
    await releaseManagedLocalRuntimeLeaseOnShutdown();
  });

  it("deploys with bootstrap only and configures managed backend", async function () {
    (globalThis as { fetch?: unknown }).fetch = undefined;
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

    assert.isTrue(result.ok, JSON.stringify(result));
    assert.deepEqual(commands.slice(0, 2), ["bootstrap", "preflight"]);
    const loaded = await loadBackendsRegistry();
    const managed = loaded.backends.find(
      (entry) => entry.id === "local-skillrunner-backend",
    );
    assert.isOk(managed);
    assert.equal(managed?.baseUrl, "http://127.0.0.1:29813");
    const state = readManagedLocalRuntimeState();
    assert.equal(state.managedBackendId, "local-skillrunner-backend");
    assert.equal(state.runtimeState, "stopped");
    assert.isUndefined((state as { deploymentState?: unknown }).deploymentState);
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.autoStartPaused, false);
  });

  it("keeps deploy successful with warning when bootstrap report is partial_failure", async function () {
    delete (globalThis as { fetch?: unknown }).fetch;
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

    assert.isTrue(result.ok, JSON.stringify(result));
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

  it("one-click uses preflight->up->lease when runtime info exists and preflight passes", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
        installDir: "C:\\SkillRunner\\releases\\v0.5.2",
        ctlPath: "C:\\SkillRunner\\releases\\v0.5.2\\scripts\\skill-runnerctl.ps1",
        runtimeState: "stopped",
        runtimeHost: "127.0.0.1",
        runtimePort: 29813,
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
            if (args.command === "preflight") {
              return makeCtlResult({ ok: true });
            }
            if (args.command === "up") {
              return makeCtlResult({
                ok: true,
                details: {
                  host: "127.0.0.1",
                  port: 29814,
                  url: "http://127.0.0.1:29814/",
                },
              });
            }
            if (args.command === "status") {
              statusCalls += 1;
              return makeCtlResult({
                ok: true,
                details: { status: statusCalls === 1 ? "running" : "running" },
              });
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
                lease_id: "lease-oneclick",
                heartbeat_interval_seconds: 11,
              })
            : JSON.stringify({ ok: true }),
      }) as Response;
    const postUpReconcileCalls: Array<{ backendId: string; source: string }> = [];
    setManagedLocalRuntimePostUpTaskReconcileRunnerForTests(async (args) => {
      postUpReconcileCalls.push({
        backendId: args.backendId,
        source: args.source,
      });
    });

    const result = await deployAndConfigureLocalSkillRunner({
      version: "v0.5.2",
    });

    assert.isTrue(result.ok);
    assert.equal(result.stage, "oneclick-start-complete");
    assert.deepEqual(commandTrail, ["preflight", "up", "status"]);
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.runtimeState, "running");
    assert.equal(snapshot.details?.autoStartPaused, false);
    assert.deepEqual(postUpReconcileCalls, [
      {
        backendId: "local-skillrunner-backend",
        source: "local-runtime-up",
      },
    ]);
  });

  it("emits runtime-up toast for one-click start", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
        installDir: "C:\\SkillRunner\\releases\\v0.5.2",
        ctlPath: "C:\\SkillRunner\\releases\\v0.5.2\\scripts\\skill-runnerctl.ps1",
        runtimeState: "stopped",
        runtimeHost: "127.0.0.1",
        runtimePort: 29813,
        requestedPort: 29813,
        portFallbackSpan: 10,
      }),
      true,
    );
    let statusCalls = 0;
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async (args: { command: string }) => {
            if (args.command === "preflight") {
              return makeCtlResult({ ok: true });
            }
            if (args.command === "up") {
              return makeCtlResult({
                ok: true,
                details: {
                  host: "127.0.0.1",
                  port: 29813,
                  url: "http://127.0.0.1:29813/",
                },
              });
            }
            if (args.command === "status") {
              statusCalls += 1;
              return makeCtlResult({
                ok: true,
                details: {
                  status: statusCalls >= 1 ? "running" : "stopped",
                },
              });
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
                lease_id: "lease-oneclick-toast",
                heartbeat_interval_seconds: 11,
              })
            : JSON.stringify({ ok: true }),
      }) as Response;
    const toasts: Array<{ kind: string; text: string; type: string }> = [];
    setLocalRuntimeToastEmitterForTests((payload) => {
      toasts.push(payload);
    });

    const result = await deployAndConfigureLocalSkillRunner();

    assert.isTrue(result.ok);
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].kind, "runtime-up");
    assert.equal(toasts[0].type, "skillrunner-backend");
  });

  it("one-click falls back to deploy when runtime info preflight fails", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
        installDir: "C:\\SkillRunner\\releases\\v0.5.1",
        ctlPath: "C:\\SkillRunner\\releases\\v0.5.1\\scripts\\skill-runnerctl.ps1",
        runtimeState: "stopped",
        runtimeHost: "127.0.0.1",
        runtimePort: 29813,
        requestedPort: 29813,
        portFallbackSpan: 10,
      }),
      true,
    );
    const commandTrail: string[] = [];
    let preflightCalls = 0;
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: (installDir: string) =>
            `${installDir}\\scripts\\skill-runnerctl.ps1`,
          runCtlCommand: async (args: { command: string }) => {
            commandTrail.push(args.command);
            if (args.command === "preflight") {
              preflightCalls += 1;
              if (preflightCalls === 1) {
                return makeCtlResult({
                  ok: false,
                  message: "preflight blocked",
                });
              }
              return makeCtlResult({
                ok: true,
                details: {
                  blocking_issues: [],
                },
              });
            }
            if (args.command === "bootstrap") {
              return makeCtlResult({
                ok: true,
                details: {
                  bootstrap_report_file: "C:\\SkillRunner\\data\\agent_bootstrap_report.json",
                },
              });
            }
            return makeCtlResult({ ok: true });
          },
        }) as any,
    );

    const result = await deployAndConfigureLocalSkillRunner({
      version: "v0.5.2",
    });

    assert.isTrue(result.ok);
    assert.equal(result.stage, "deploy-complete");
    assert.deepEqual(commandTrail.slice(0, 3), ["preflight", "bootstrap", "preflight"]);
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.autoStartPaused, false);
    assert.equal(result.details?.autoEnsureTriggered, false);
  });

  it("returns post-deploy preflight failure when fallback deploy succeeds but post preflight fails", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
        installDir: "C:\\SkillRunner\\releases\\v0.5.1",
        ctlPath: "C:\\SkillRunner\\releases\\v0.5.1\\scripts\\skill-runnerctl.ps1",
        runtimeState: "stopped",
        runtimeHost: "127.0.0.1",
        runtimePort: 29813,
        requestedPort: 29813,
        portFallbackSpan: 10,
      }),
      true,
    );
    const commandTrail: string[] = [];
    let preflightCalls = 0;
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: (installDir: string) =>
            `${installDir}\\scripts\\skill-runnerctl.ps1`,
          runCtlCommand: async (args: { command: string }) => {
            commandTrail.push(args.command);
            if (args.command === "preflight") {
              preflightCalls += 1;
              if (preflightCalls === 1) {
                return makeCtlResult({
                  ok: false,
                  message: "preflight blocked",
                });
              }
              return makeCtlResult({
                ok: false,
                message: "post deploy preflight blocked",
              });
            }
            if (args.command === "bootstrap") {
              return makeCtlResult({
                ok: true,
                details: {
                  bootstrap_report_file: "C:\\SkillRunner\\data\\agent_bootstrap_report.json",
                },
              });
            }
            return makeCtlResult({ ok: true });
          },
        }) as any,
    );

    const result = await deployAndConfigureLocalSkillRunner({
      version: "v0.5.2",
    });

    assert.isFalse(result.ok);
    assert.equal(result.stage, "post-deploy-preflight");
    assert.deepEqual(commandTrail.slice(0, 3), ["preflight", "bootstrap", "preflight"]);
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.autoStartPaused, true);
    assert.equal(result.details?.autoEnsureTriggered, false);
  });

  it("ensures runtime with preflight -> up -> status and then acquires lease", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
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

    const result = await ensureManagedLocalRuntimeForBackend(
      "local-skillrunner-backend",
    );

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

  it("emits state-change notifications when background auto-ensure updates runtime state", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
        installDir: "C:\\SkillRunner\\releases\\v0.5.2",
        ctlPath: "C:\\SkillRunner\\releases\\v0.5.2\\scripts\\skill-runnerctl.ps1",
        runtimeState: "stopped",
        runtimeHost: "127.0.0.1",
        runtimePort: 29813,
        requestedPort: 29813,
        portFallbackSpan: 10,
      }),
      true,
    );
    let statusCalls = 0;
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async (args: { command: string }) => {
            if (args.command === "status") {
              statusCalls += 1;
              return makeCtlResult({
                ok: true,
                details: {
                  status: statusCalls === 1 ? "stopped" : "running",
                },
              });
            }
            if (args.command === "preflight") {
              return makeCtlResult({ ok: true });
            }
            if (args.command === "up") {
              return makeCtlResult({
                ok: true,
                details: {
                  host: "127.0.0.1",
                  port: 29813,
                  url: "http://127.0.0.1:29813/",
                },
              });
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
                lease_id: "lease-auto-ensure",
                heartbeat_interval_seconds: 12,
              })
            : JSON.stringify({ ok: true }),
      }) as Response;

    let notifyCount = 0;
    const unsubscribe = subscribeManagedLocalRuntimeStateChange(() => {
      notifyCount += 1;
    });
    await setLocalRuntimeAutoPullEnabled(true);
    const baselineNotifyCount = notifyCount;

    const result = await runManagedRuntimeAutoEnsureTickForTests();

    unsubscribe();
    assert.isTrue(result.ok);
    assert.equal(result.stage, "ensure-complete");
    assert.isAbove(notifyCount, baselineNotifyCount);
  });

  it("marks inFlightAction while background auto-ensure is waiting for up", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
        installDir: "C:\\SkillRunner\\releases\\v0.5.2",
        ctlPath: "C:\\SkillRunner\\releases\\v0.5.2\\scripts\\skill-runnerctl.ps1",
        runtimeState: "stopped",
        runtimeHost: "127.0.0.1",
        runtimePort: 29813,
      }),
      true,
    );
    const upDeferred = createDeferred<void>();
    let statusCalls = 0;
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async (args: { command: string }) => {
            if (args.command === "status") {
              statusCalls += 1;
              return makeCtlResult({
                ok: true,
                details: {
                  status: statusCalls === 1 ? "stopped" : "running",
                },
              });
            }
            if (args.command === "preflight") {
              return makeCtlResult({ ok: true });
            }
            if (args.command === "up") {
              await upDeferred.promise;
              return makeCtlResult({
                ok: true,
                details: {
                  status: "running",
                },
              });
            }
            return makeCtlResult({ ok: true });
          },
        }) as any,
    );
    (globalThis as { fetch?: unknown }).fetch = async () =>
      ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            lease_id: "lease-auto-ensure-busy",
            heartbeat_interval_seconds: 20,
          }),
      }) as Response;
    await setLocalRuntimeAutoPullEnabled(true);

    const ensurePromise = runManagedRuntimeAutoEnsureTickForTests();
    await Promise.resolve();
    await Promise.resolve();

    const busySnapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(busySnapshot.details?.inFlightAction, "auto-ensure-starting");

    upDeferred.resolve();
    await ensurePromise;

    const idleSnapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(idleSnapshot.details?.inFlightAction, "");
  });

  it("blocks runtime start when preflight fails", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
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

    const result = await ensureManagedLocalRuntimeForBackend(
      "local-skillrunner-backend",
    );

    assert.isFalse(result.ok);
    assert.equal(result.stage, "ensure-preflight");
    assert.deepEqual(commandTrail, ["status", "preflight"]);
  });

  it("start keeps auto-start switch unchanged and still follows preflight startup chain", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
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
    assert.equal(snapshot.details?.autoStartPaused, false);
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

  it("stop marks runtime stopped and immediately turns off auto-start", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
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
          runCtlCommand: async (args: { command: string }) =>
            args.command === "status"
              ? makeCtlResult({
                  ok: true,
                  details: {
                    status: "stopped",
                  },
                })
              : makeCtlResult({ ok: true }),
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
    const toasts: Array<{ kind: string; text: string; type: string }> = [];
    setLocalRuntimeToastEmitterForTests((payload) => {
      toasts.push(payload);
    });

    const result = await stopLocalRuntime();

    assert.isTrue(result.ok);
    assert.equal(result.stage, "stop-complete");
    const state = readManagedLocalRuntimeState();
    assert.equal(state.runtimeState, "stopped");
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.autoStartPaused, true);
    assert.equal(fetchCalls[0].lease_id, "lease-stop");
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].kind, "runtime-down");
  });

  it("turns off auto-start even when stop fails", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
        runtimeState: "running",
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
        lease: {
          acquired: true,
          leaseId: "lease-stop-fail",
        },
      }),
      true,
    );
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async (args: { command: string }) =>
            args.command === "down"
              ? makeCtlResult({
                  ok: false,
                  message: "down failed",
                })
              : makeCtlResult({ ok: true }),
        }) as any,
    );
    (globalThis as { fetch?: unknown }).fetch = async () =>
      ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      }) as Response;
    await setLocalRuntimeAutoPullEnabled(true);

    const result = await stopLocalRuntime();

    assert.isFalse(result.ok);
    assert.equal(result.stage, "stop-down");
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.autoStartPaused, true);
  });

  it("deduplicates runtime-down toast within 5 seconds", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
        runtimeState: "running",
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
      }),
      true,
    );
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async (args: { command: string }) =>
            args.command === "status"
              ? makeCtlResult({
                  ok: true,
                  details: {
                    status: "stopped",
                  },
                })
              : makeCtlResult({ ok: true }),
        }) as any,
    );
    const toasts: Array<{ kind: string; text: string; type: string }> = [];
    setLocalRuntimeToastEmitterForTests((payload) => {
      toasts.push(payload);
    });

    const first = await stopLocalRuntime();
    const second = await stopLocalRuntime();

    assert.isTrue(first.ok);
    assert.isTrue(second.ok);
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].kind, "runtime-down");
  });

  it("uses zh fallback text for runtime-down toast when localization is unavailable", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
        runtimeState: "running",
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
      }),
      true,
    );
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async (args: { command: string }) =>
            args.command === "status"
              ? makeCtlResult({
                  ok: true,
                  details: {
                    status: "stopped",
                  },
                })
              : makeCtlResult({ ok: true }),
        }) as any,
    );
    const runtime = globalThis as { addon?: unknown };
    const previousAddon = runtime.addon;
    const previousLocale = (Zotero as { locale?: unknown }).locale;
    runtime.addon = undefined;
    (Zotero as { locale?: unknown }).locale = "zh-CN";
    const toasts: Array<{ kind: string; text: string; type: string }> = [];
    setLocalRuntimeToastEmitterForTests((payload) => {
      toasts.push(payload);
    });

    try {
      const result = await stopLocalRuntime();
      assert.isTrue(result.ok);
      assert.equal(toasts.length, 1);
      assert.equal(toasts[0].kind, "runtime-down");
      assert.equal(toasts[0].text, "本地后端已停止。");
    } finally {
      runtime.addon = previousAddon;
      (Zotero as { locale?: unknown }).locale = previousLocale;
    }
  });

  it("uses default english fallback text for runtime-down toast when locale is non-zh", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
        runtimeState: "running",
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
      }),
      true,
    );
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async (args: { command: string }) =>
            args.command === "status"
              ? makeCtlResult({
                  ok: true,
                  details: {
                    status: "stopped",
                  },
                })
              : makeCtlResult({ ok: true }),
        }) as any,
    );
    const runtime = globalThis as { addon?: unknown };
    const previousAddon = runtime.addon;
    const previousLocale = (Zotero as { locale?: unknown }).locale;
    runtime.addon = undefined;
    (Zotero as { locale?: unknown }).locale = "en-US";
    const toasts: Array<{ kind: string; text: string; type: string }> = [];
    setLocalRuntimeToastEmitterForTests((payload) => {
      toasts.push(payload);
    });

    try {
      const result = await stopLocalRuntime();
      assert.isTrue(result.ok);
      assert.equal(toasts.length, 1);
      assert.equal(toasts[0].kind, "runtime-down");
      assert.equal(toasts[0].text, "Local backend stopped.");
    } finally {
      runtime.addon = previousAddon;
      (Zotero as { locale?: unknown }).locale = previousLocale;
    }
  });

  it("emits abnormal-stop toast when heartbeat fails and status probe reports stopped", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
        runtimeState: "running",
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
        baseUrl: "http://127.0.0.1:29813",
        runtimeHost: "127.0.0.1",
        runtimePort: 29813,
        lease: {
          acquired: true,
          leaseId: "lease-heartbeat",
          heartbeatIntervalSeconds: 1,
        },
      }),
      true,
    );
    let statusCalls = 0;
    setSkillRunnerCtlBridgeFactoryForTests(
      () =>
        ({
          resolveCtlPathFromInstallDir: () => "",
          runCtlCommand: async (args: { command: string }) => {
            if (args.command === "status") {
              statusCalls += 1;
              if (statusCalls === 1) {
                return makeCtlResult({
                  ok: true,
                  details: { status: "running" },
                });
              }
              return makeCtlResult({
                ok: true,
                details: { status: "stopped" },
              });
            }
            return makeCtlResult({ ok: true });
          },
        }) as any,
    );
    (globalThis as { fetch?: unknown }).fetch = async (input: unknown) =>
      ({
        ok: String(input).includes("/lease/heartbeat") ? false : true,
        status: String(input).includes("/lease/heartbeat") ? 500 : 200,
        text: async () => JSON.stringify({}),
      }) as Response;
    const toasts: Array<{ kind: string; text: string; type: string }> = [];
    setLocalRuntimeToastEmitterForTests((payload) => {
      toasts.push(payload);
    });
    await setLocalRuntimeAutoPullEnabled(true);

    const ensureResult = await ensureManagedLocalRuntimeForBackend(
      "local-skillrunner-backend",
    );
    assert.isTrue(ensureResult.ok);
    await sleepMsForTest(1300);

    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.runtimeState, "stopped");
    assert.isAtLeast(toasts.length, 1);
    assert.equal(toasts[toasts.length - 1].kind, "runtime-abnormal-stop");
  });

  it("uninstall runs plugin-side orchestration and clears state on full success", async function () {
    Zotero.Prefs.set(
      backendsConfigPrefKey,
      JSON.stringify({
        backends: [
          {
            id: "local-skillrunner-backend",
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
        managedBackendId: "local-skillrunner-backend",
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
    assert.isUndefined(
      loaded.backends.find((entry) => entry.id === "local-skillrunner-backend"),
    );
    assert.deepEqual(readManagedLocalRuntimeState(), {});
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.autoStartPaused, true);
  });

  it("uninstall fails when managed localRoot cannot be resolved safely", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
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
    assert.deepEqual(readManagedLocalRuntimeState(), {});
  });

  it("uninstall aborts on down failure and still clears runtime info", async function () {
    Zotero.Prefs.set(
      backendsConfigPrefKey,
      JSON.stringify({
        backends: [
          {
            id: "local-skillrunner-backend",
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
        managedBackendId: "local-skillrunner-backend",
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
    assert.isOk(
      loaded.backends.find((entry) => entry.id === "local-skillrunner-backend"),
    );
    assert.deepEqual(readManagedLocalRuntimeState(), {});
  });

  it("uninstall respects clear flags and keeps runtime info cleared when deletion fails", async function () {
    Zotero.Prefs.set(
      backendsConfigPrefKey,
      JSON.stringify({
        backends: [
          {
            id: "local-skillrunner-backend",
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
        managedBackendId: "local-skillrunner-backend",
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
    assert.isOk(
      loaded.backends.find((entry) => entry.id === "local-skillrunner-backend"),
    );
    assert.deepEqual(readManagedLocalRuntimeState(), {});
  });

  it("uninstall continues cleanup when ctl path is missing", async function () {
    Zotero.Prefs.set(
      backendsConfigPrefKey,
      JSON.stringify({
        backends: [
          {
            id: "local-skillrunner-backend",
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
        managedBackendId: "local-skillrunner-backend",
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
        managedBackendId: "local-skillrunner-backend",
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
        managedBackendId: "local-skillrunner-backend",
        runtimeState: "stopped",
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
        baseUrl: "http://127.0.0.1:29813",
      }),
      true,
    );
    const ensureResult = await ensureManagedLocalRuntimeForBackend(
      "local-skillrunner-backend",
    );
    assert.isTrue(ensureResult.ok);
    assert.equal(ensureResult.stage, "ensure-skipped-paused");

    const toggleResult = await toggleLocalRuntimeAutoPull();
    assert.isTrue(toggleResult.ok);
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.autoStartPaused, false);
  });

  it("startup preflight keeps auto-start disabled when runtime info is missing", async function () {
    const result = await runManagedRuntimeStartupPreflightProbe();
    assert.isTrue(result.ok);
    assert.equal(result.stage, "startup-preflight-skip-no-runtime-info");
    const snapshot = getManagedLocalRuntimeStateSnapshot();
    assert.equal(snapshot.details?.autoStartPaused, true);
  });

  it("startup preflight enables auto-start when runtime info preflight succeeds", async function () {
    Zotero.Prefs.set(
      localRuntimeStatePrefKey,
      JSON.stringify({
        managedBackendId: "local-skillrunner-backend",
        installDir: "C:\\SkillRunner\\releases\\v0.5.2",
        ctlPath: "C:\\SkillRunner\\releases\\v0.5.2\\scripts\\skill-runnerctl.ps1",
        runtimeHost: "127.0.0.1",
        runtimePort: 29813,
        requestedPort: 29813,
        portFallbackSpan: 10,
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

    const result = await runManagedRuntimeStartupPreflightProbe();

    assert.isTrue(result.ok);
    assert.equal(result.stage, "startup-preflight-ok");
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
    assert.equal(snapshot.details?.hasRuntimeInfo, false);
    assert.equal(snapshot.details?.inFlightAction, "");
    assert.equal(snapshot.details?.monitoringState, "inactive");
  });
});
