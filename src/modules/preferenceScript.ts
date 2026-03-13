import { config } from "../../package.json";
import { getPref, setPref } from "../utils/prefs";
import { getEffectiveWorkflowDir } from "./workflowRuntime";
import { getString } from "../utils/locale";
import { getDefaultSkillRunnerLocalRuntimeVersion } from "./skillRunnerLocalRuntimeManager";

export async function registerPrefsScripts(window: Window) {
  if (!addon.data.prefs) {
    addon.data.prefs = { window };
  } else {
    addon.data.prefs.window = window;
  }
  bindPrefEvents();
}

function bindPrefEvents() {
  const doc = addon.data.prefs?.window.document;
  if (!doc) {
    return;
  }

  const workflowDirInput = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-workflow-dir`,
  ) as HTMLInputElement | null;
  const scanButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-workflow-scan`,
  ) as XUL.Button | null;
  const workflowSettingsButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-workflow-settings`,
  ) as XUL.Button | null;
  const backendManageButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-backend-manage`,
  ) as XUL.Button | null;
  const localRuntimeVersionInput = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-version`,
  ) as HTMLInputElement | null;
  const localRuntimeDeployButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-deploy`,
  ) as XUL.Button | null;
  const localRuntimeStatusButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-status`,
  ) as XUL.Button | null;
  const localRuntimeStartButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-start`,
  ) as XUL.Button | null;
  const localRuntimeStopButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-stop`,
  ) as XUL.Button | null;
  const localRuntimeUninstallButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-uninstall`,
  ) as XUL.Button | null;
  const localRuntimeDoctorButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-doctor`,
  ) as XUL.Button | null;
  const localRuntimeCopyCommandsButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-copy-commands`,
  ) as XUL.Button | null;
  const localRuntimeOpenDebugConsoleButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-open-debug-console`,
  ) as XUL.Button | null;
  const localRuntimeAutoPullToggleButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-auto-pull-toggle`,
  ) as XUL.Button | null;
  const localRuntimeStatusText = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-status-text`,
  ) as HTMLElement | null;
  const localRuntimeStateText = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-state-text`,
  ) as HTMLElement | null;

  const localRuntimeButtons = [
    localRuntimeDeployButton,
    localRuntimeStatusButton,
    localRuntimeStartButton,
    localRuntimeStopButton,
    localRuntimeUninstallButton,
    localRuntimeDoctorButton,
    localRuntimeCopyCommandsButton,
    localRuntimeOpenDebugConsoleButton,
    localRuntimeAutoPullToggleButton,
  ].filter(Boolean) as XUL.Button[];

  const setLocalRuntimeStatusText = (text: string) => {
    if (!localRuntimeStatusText) {
      return;
    }
    localRuntimeStatusText.textContent = text;
  };

  const setLocalRuntimeStateText = (text: string) => {
    if (!localRuntimeStateText) {
      return;
    }
    localRuntimeStateText.textContent = text;
  };

  const setLocalRuntimeButtonsDisabled = (disabled: boolean) => {
    for (const button of localRuntimeButtons) {
      if (!button) {
        continue;
      }
      if (disabled) {
        button.setAttribute("disabled", "true");
      } else {
        if (typeof (button as { removeAttribute?: (name: string) => void }).removeAttribute === "function") {
          (button as { removeAttribute: (name: string) => void }).removeAttribute(
            "disabled",
          );
        } else {
          button.setAttribute("disabled", "false");
        }
      }
    }
  };

  const formatLocalRuntimeStatusMessage = (result: unknown) => {
    const typed = (result || {}) as {
      ok?: unknown;
      message?: unknown;
      conflict?: unknown;
    };
    const message = String(typed.message || "").trim() || "unknown";
    if (typed.conflict === true) {
      return `${getString("pref-skillrunner-local-status-conflict-prefix" as any)} ${message}`;
    }
    if (typed.ok === true) {
      return `${getString("pref-skillrunner-local-status-ok-prefix" as any)} ${message}`;
    }
    return `${getString("pref-skillrunner-local-status-failed-prefix" as any)} ${message}`;
  };

  const getRuntimeStateLabel = (value: unknown) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "running") {
      return getString("pref-skillrunner-local-runtime-state-running" as any);
    }
    if (normalized === "starting") {
      return getString("pref-skillrunner-local-runtime-state-starting" as any);
    }
    if (normalized === "stopped") {
      return getString("pref-skillrunner-local-runtime-state-stopped" as any);
    }
    if (normalized === "degraded") {
      return getString("pref-skillrunner-local-runtime-state-degraded" as any);
    }
    if (normalized === "broken") {
      return getString("pref-skillrunner-local-runtime-state-broken" as any);
    }
    return getString("pref-skillrunner-local-runtime-state-unknown" as any);
  };

  const getLeaseStateLabel = (value: unknown) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "acquired") {
      return getString("pref-skillrunner-local-lease-state-acquired" as any);
    }
    if (normalized === "conflict") {
      return getString("pref-skillrunner-local-lease-state-conflict" as any);
    }
    if (normalized === "failed") {
      return getString("pref-skillrunner-local-lease-state-failed" as any);
    }
    return getString("pref-skillrunner-local-lease-state-pending" as any);
  };

  const getAutoStartStateLabel = (value: unknown) => {
    return value === true
      ? getString("pref-skillrunner-local-auto-start-off" as any)
      : getString("pref-skillrunner-local-auto-start-on" as any);
  };

  const getUILocale = () => {
    const runtime = globalThis as {
      Zotero?: {
        locale?: string;
      };
    };
    const zoteroLocale = String(runtime.Zotero?.locale || "").trim();
    if (zoteroLocale) {
      return zoteroLocale.toLowerCase();
    }
    const intlLocale = String(Intl.DateTimeFormat().resolvedOptions().locale || "").trim();
    return intlLocale.toLowerCase();
  };

  const resolveLocalizedActionLabel = (key: string) => {
    const resolved = String(getString(key as any) || "").trim();
    if (resolved && resolved !== key && resolved !== `${config.addonRef}-${key}`) {
      return resolved;
    }
    const isZh = getUILocale().startsWith("zh");
    if (key === "pref-skillrunner-local-auto-pull-enable") {
      return isZh ? "开启自动拉起" : "Enable Auto-start";
    }
    return isZh ? "关闭自动拉起" : "Disable Auto-start";
  };

  const setAutoPullToggleButtonLabel = (autoStartPaused: unknown) => {
    if (!localRuntimeAutoPullToggleButton) {
      return;
    }
    const key =
      autoStartPaused === true
        ? "pref-skillrunner-local-auto-pull-enable"
        : "pref-skillrunner-local-auto-pull-disable";
    localRuntimeAutoPullToggleButton.setAttribute(
      "label",
      resolveLocalizedActionLabel(key),
    );
  };

  const updateLocalRuntimeStateSummaryFromResult = (result: unknown) => {
    const typed = (result || {}) as {
      details?: Record<string, unknown>;
    };
    const details = typed.details || {};
    const runtime = getRuntimeStateLabel(details.runtimeState);
    const lease = getLeaseStateLabel(details.leaseState);
    const autoStart = getAutoStartStateLabel(details.autoStartPaused);
    setAutoPullToggleButtonLabel(details.autoStartPaused);
    setLocalRuntimeStateText(
      getString("pref-skillrunner-local-state-summary-template" as any, {
        args: {
          runtime,
          lease,
          autoStart,
        },
      }),
    );
  };

  const refreshLocalRuntimeStateSummary = async () => {
    try {
      const state = await addon.hooks.onPrefsEvent("stateSkillRunnerLocalRuntime", {
        window: addon.data.prefs?.window,
      });
      updateLocalRuntimeStateSummaryFromResult(state);
    } catch {
      setLocalRuntimeStateText(
        getString("pref-skillrunner-local-state-summary-idle" as any),
      );
      setAutoPullToggleButtonLabel(true);
    }
  };

  const runLocalRuntimeAction = async (type: string, payload?: Record<string, unknown>) => {
    setLocalRuntimeButtonsDisabled(true);
    setLocalRuntimeStatusText(getString("pref-skillrunner-local-status-working" as any));
    try {
      const response = await addon.hooks.onPrefsEvent(type, {
        window: addon.data.prefs?.window,
        ...(payload || {}),
      });
      setLocalRuntimeStatusText(formatLocalRuntimeStatusMessage(response));
      await refreshLocalRuntimeStateSummary();
    } catch (error) {
      setLocalRuntimeStatusText(
        `${getString("pref-skillrunner-local-status-failed-prefix" as any)} ${String(error)}`,
      );
      await refreshLocalRuntimeStateSummary();
    } finally {
      setLocalRuntimeButtonsDisabled(false);
    }
  };

  const openLocalRuntimeDebugConsole = async () => {
    return addon.hooks.onPrefsEvent("openSkillRunnerLocalDeployDebugConsole", {
      window: addon.data.prefs?.window,
    });
  };

  const copyTextToClipboard = async (text: string) => {
    const runtime = globalThis as {
      Zotero?: {
        Utilities?: {
          Internal?: {
            copyTextToClipboard?: (value: string) => void;
          };
        };
      };
      navigator?: {
        clipboard?: {
          writeText?: (value: string) => Promise<void>;
        };
      };
    };
    const copyByZotero = runtime.Zotero?.Utilities?.Internal?.copyTextToClipboard;
    if (typeof copyByZotero === "function") {
      copyByZotero(text);
      return;
    }
    const writeText = runtime.navigator?.clipboard?.writeText;
    if (typeof writeText === "function") {
      await writeText(text);
      return;
    }
    throw new Error("clipboard API unavailable");
  };

  if (workflowDirInput) {
    const workflowDir = String(getPref("workflowDir") || "").trim();
    const normalizedWorkflowDir = workflowDir || getEffectiveWorkflowDir();
    workflowDirInput.value = normalizedWorkflowDir;
    setPref("workflowDir", normalizedWorkflowDir);
    workflowDirInput.addEventListener("change", (event: Event) => {
      const value = (event.target as HTMLInputElement).value.trim();
      const nextValue = value || getEffectiveWorkflowDir();
      setPref("workflowDir", nextValue);
      workflowDirInput.value = nextValue;
    });
  }

  if (scanButton) {
    scanButton.addEventListener("command", () => {
      const rawWorkflowDir = workflowDirInput?.value || "";
      const normalizedWorkflowDir = rawWorkflowDir.trim();
      if (workflowDirInput) {
        const nextWorkflowDir =
          normalizedWorkflowDir || getEffectiveWorkflowDir();
        setPref("workflowDir", nextWorkflowDir);
        workflowDirInput.value = nextWorkflowDir;
      }
      void addon.hooks.onPrefsEvent("scanWorkflows", {
        window: addon.data.prefs?.window,
        workflowsDir: normalizedWorkflowDir || undefined,
      });
    });
  }

  if (workflowSettingsButton) {
    workflowSettingsButton.addEventListener("command", () => {
      void addon.hooks.onPrefsEvent("openWorkflowSettings", {
        window: addon.data.prefs?.window,
        source: "preferences",
      });
    });
  }

  if (backendManageButton) {
    backendManageButton.addEventListener("command", () => {
      void addon.hooks.onPrefsEvent("openBackendManager", {
        window: addon.data.prefs?.window,
      });
    });
  }

  if (localRuntimeVersionInput) {
    const prefVersion = String(getPref("skillRunnerLocalRuntimeVersion") || "").trim();
    const normalizedVersion = prefVersion || getDefaultSkillRunnerLocalRuntimeVersion();
    localRuntimeVersionInput.value = normalizedVersion;
    setPref("skillRunnerLocalRuntimeVersion", normalizedVersion);
    localRuntimeVersionInput.addEventListener("change", (event: Event) => {
      const value = String((event.target as HTMLInputElement).value || "").trim();
      const nextValue = value || getDefaultSkillRunnerLocalRuntimeVersion();
      setPref("skillRunnerLocalRuntimeVersion", nextValue);
      localRuntimeVersionInput.value = nextValue;
    });
  }

  if (localRuntimeStatusText) {
    setLocalRuntimeStatusText(
      getString("pref-skillrunner-local-status-idle" as any),
    );
  }
  if (localRuntimeStateText) {
    setLocalRuntimeStateText(
      getString("pref-skillrunner-local-state-summary-idle" as any),
    );
  }
  setAutoPullToggleButtonLabel(true);
  void refreshLocalRuntimeStateSummary();

  if (localRuntimeDeployButton) {
    localRuntimeDeployButton.addEventListener("command", () => {
      const version = String(localRuntimeVersionInput?.value || "").trim();
      setLocalRuntimeButtonsDisabled(true);
      setLocalRuntimeStatusText(getString("pref-skillrunner-local-status-working" as any));
      void (async () => {
        try {
          try {
            await openLocalRuntimeDebugConsole();
          } catch {
            // Keep deploy flow running even if debug console fails to open.
          }
          const response = await addon.hooks.onPrefsEvent("deploySkillRunnerLocalRuntime", {
            window: addon.data.prefs?.window,
            version,
          });
          setLocalRuntimeStatusText(formatLocalRuntimeStatusMessage(response));
          await refreshLocalRuntimeStateSummary();
        } catch (error) {
          setLocalRuntimeStatusText(
            `${getString("pref-skillrunner-local-status-failed-prefix" as any)} ${String(error)}`,
          );
          await refreshLocalRuntimeStateSummary();
        } finally {
          setLocalRuntimeButtonsDisabled(false);
        }
      })();
    });
  }

  if (localRuntimeStatusButton) {
    localRuntimeStatusButton.addEventListener("command", () => {
      void runLocalRuntimeAction("statusSkillRunnerLocalRuntime");
    });
  }

  if (localRuntimeStartButton) {
    localRuntimeStartButton.addEventListener("command", () => {
      void runLocalRuntimeAction("startSkillRunnerLocalRuntime");
    });
  }

  if (localRuntimeStopButton) {
    localRuntimeStopButton.addEventListener("command", () => {
      void runLocalRuntimeAction("stopSkillRunnerLocalRuntime");
    });
  }

  if (localRuntimeUninstallButton) {
    localRuntimeUninstallButton.addEventListener("command", () => {
      void runLocalRuntimeAction("uninstallSkillRunnerLocalRuntime");
    });
  }

  if (localRuntimeDoctorButton) {
    localRuntimeDoctorButton.addEventListener("command", () => {
      void runLocalRuntimeAction("doctorSkillRunnerLocalRuntime");
    });
  }

  if (localRuntimeCopyCommandsButton) {
    localRuntimeCopyCommandsButton.addEventListener("command", () => {
      const version = String(localRuntimeVersionInput?.value || "").trim();
      setLocalRuntimeButtonsDisabled(true);
      setLocalRuntimeStatusText(getString("pref-skillrunner-local-status-working" as any));
      void (async () => {
        try {
          const response = (await addon.hooks.onPrefsEvent(
            "copySkillRunnerLocalDeployCommands",
            {
              window: addon.data.prefs?.window,
              version,
            },
          )) as {
            details?: { commands?: unknown };
          };
          const commands = String(response?.details?.commands || "").trim();
          if (!commands) {
            throw new Error("manual deploy commands are empty");
          }
          await copyTextToClipboard(commands);
          setLocalRuntimeStatusText(
            `${getString("pref-skillrunner-local-status-ok-prefix" as any)} ${getString("pref-skillrunner-local-copy-commands-copied" as any)}`,
          );
          await refreshLocalRuntimeStateSummary();
        } catch (error) {
          setLocalRuntimeStatusText(
            `${getString("pref-skillrunner-local-status-failed-prefix" as any)} ${String(error)}`,
          );
          await refreshLocalRuntimeStateSummary();
        } finally {
          setLocalRuntimeButtonsDisabled(false);
        }
      })();
    });
  }

  if (localRuntimeOpenDebugConsoleButton) {
    localRuntimeOpenDebugConsoleButton.addEventListener("command", () => {
      setLocalRuntimeButtonsDisabled(true);
      setLocalRuntimeStatusText(getString("pref-skillrunner-local-status-working" as any));
      void (async () => {
        try {
          await openLocalRuntimeDebugConsole();
          setLocalRuntimeStatusText(
            `${getString("pref-skillrunner-local-status-ok-prefix" as any)} ${getString("pref-skillrunner-local-debug-console-opened" as any)}`,
          );
          await refreshLocalRuntimeStateSummary();
        } catch (error) {
          setLocalRuntimeStatusText(
            `${getString("pref-skillrunner-local-status-failed-prefix" as any)} ${String(error)}`,
          );
          await refreshLocalRuntimeStateSummary();
        } finally {
          setLocalRuntimeButtonsDisabled(false);
        }
      })();
    });
  }

  if (localRuntimeAutoPullToggleButton) {
    localRuntimeAutoPullToggleButton.addEventListener("command", () => {
      void runLocalRuntimeAction("toggleSkillRunnerLocalRuntimeAutoPull");
    });
  }
}
