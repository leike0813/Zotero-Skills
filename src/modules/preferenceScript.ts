import { config } from "../../package.json";
import { getPref, setPref } from "../utils/prefs";
import { getEffectiveWorkflowDir } from "./workflowRuntime";
import { getString } from "../utils/locale";
import { subscribeManagedLocalRuntimeStateChange } from "./skillRunnerLocalRuntimeManager";

let unbindManagedLocalRuntimeStateChange: (() => void) | null = null;

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
  if (unbindManagedLocalRuntimeStateChange) {
    unbindManagedLocalRuntimeStateChange();
    unbindManagedLocalRuntimeStateChange = null;
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

  const localRuntimeDeployButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-deploy`,
  ) as XUL.Button | null;
  const localRuntimeStopButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-stop`,
  ) as XUL.Button | null;
  const localRuntimeUninstallButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-uninstall`,
  ) as XUL.Button | null;
  const localRuntimeOpenDebugConsoleButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-open-debug-console`,
  ) as XUL.Button | null;
  const localRuntimeOpenManagementButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-open-management`,
  ) as XUL.Button | null;
  const localRuntimeRefreshModelCacheButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-refresh-model-cache`,
  ) as XUL.Button | null;
  const localRuntimeLed = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-runtime-led`,
  ) as HTMLElement | null;
  const localRuntimeAutoStartIcon = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-autostart-icon`,
  ) as HTMLElement | null;
  const localRuntimeStatusText = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-status-text`,
  ) as HTMLElement | null;

  const runtimeActionButtons = [
    localRuntimeDeployButton,
    localRuntimeStopButton,
    localRuntimeUninstallButton,
    localRuntimeOpenManagementButton,
    localRuntimeRefreshModelCacheButton,
  ].filter(Boolean) as XUL.Button[];

  const setButtonDisabled = (button: XUL.Button | null, disabled: boolean) => {
    if (!button) {
      return;
    }
    if (disabled) {
      button.setAttribute("disabled", "true");
      return;
    }
    if (
      typeof (button as { removeAttribute?: (name: string) => void })
        .removeAttribute === "function"
    ) {
      (button as { removeAttribute: (name: string) => void }).removeAttribute(
        "disabled",
      );
    } else {
      button.setAttribute("disabled", "false");
    }
  };

  const setRuntimeActionButtonsDisabled = (disabled: boolean) => {
    for (const button of runtimeActionButtons) {
      setButtonDisabled(button, disabled);
    }
  };

  const setLocalRuntimeStatusText = (text: string) => {
    if (!localRuntimeStatusText) {
      return;
    }
    localRuntimeStatusText.textContent = text;
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

  const getRuntimeStateLabel = (value: unknown, hasRuntimeInfo: boolean) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!hasRuntimeInfo) {
      return getString("pref-skillrunner-local-runtime-state-no-runtime" as any);
    }
    if (normalized === "running") {
      return getString("pref-skillrunner-local-runtime-state-running" as any);
    }
    if (normalized === "starting") {
      return getString("pref-skillrunner-local-runtime-state-reconciling" as any);
    }
    if (normalized === "stopped") {
      return getString("pref-skillrunner-local-runtime-state-stopped" as any);
    }
    if (
      normalized === "reconciling_after_heartbeat_fail" ||
      normalized === "degraded"
    ) {
      return getString("pref-skillrunner-local-runtime-state-reconciling" as any);
    }
    return getString("pref-skillrunner-local-runtime-state-unknown" as any);
  };

  const updateLocalRuntimeIndicatorsFromResult = (result: unknown) => {
    const typed = (result || {}) as {
      details?: Record<string, unknown>;
    };
    const details = typed.details || {};
    const runtimeState = String(details.runtimeState || "").trim().toLowerCase();
    const hasRuntimeInfo = details.hasRuntimeInfo === true;
    const autoStartEnabled = details.autoStartPaused === false;
    let runtimeClass = "is-gray";
    if (hasRuntimeInfo) {
      if (runtimeState === "running") {
        runtimeClass = "is-green";
      } else if (runtimeState === "reconciling_after_heartbeat_fail") {
        runtimeClass = "is-orange";
      } else if (runtimeState === "stopped") {
        runtimeClass = "is-red";
      } else if (runtimeState === "starting" || runtimeState === "degraded") {
        runtimeClass = "is-orange";
      } else {
        runtimeClass = "is-red";
      }
    }
    if (localRuntimeLed) {
      localRuntimeLed.className = `zs-runtime-led ${runtimeClass}`;
      localRuntimeLed.setAttribute(
        "title",
        getRuntimeStateLabel(details.runtimeState, hasRuntimeInfo),
      );
    }
    if (localRuntimeAutoStartIcon) {
      localRuntimeAutoStartIcon.className = `zs-autostart-icon ${autoStartEnabled ? "is-green" : "is-red"}`;
      localRuntimeAutoStartIcon.setAttribute(
        "title",
        autoStartEnabled
          ? getString("pref-skillrunner-local-auto-start-on" as any)
          : getString("pref-skillrunner-local-auto-start-off" as any),
      );
    }
    return details;
  };

  const applyRuntimeButtonGate = (details: Record<string, unknown> | null) => {
    const runtimeState = String(details?.runtimeState || "")
      .trim()
      .toLowerCase();
    const hasRuntimeInfo = details?.hasRuntimeInfo === true;
    const inFlightAction = String(details?.inFlightAction || "").trim();
    const actionBusy = inFlightAction.length > 0 || runtimeState === "starting";
    const running = runtimeState === "running";

    setButtonDisabled(localRuntimeDeployButton, actionBusy || running);
    setButtonDisabled(localRuntimeStopButton, actionBusy || !running);
    setButtonDisabled(
      localRuntimeUninstallButton,
      actionBusy || running || !hasRuntimeInfo,
    );
    setButtonDisabled(
      localRuntimeOpenManagementButton,
      actionBusy || !running,
    );
    setButtonDisabled(
      localRuntimeRefreshModelCacheButton,
      actionBusy || !running,
    );
    setButtonDisabled(localRuntimeOpenDebugConsoleButton, false);
  };

  const refreshLocalRuntimeStateSummary = async () => {
    try {
      const state = await addon.hooks.onPrefsEvent("stateSkillRunnerLocalRuntime", {
        window: addon.data.prefs?.window,
      });
      const details = updateLocalRuntimeIndicatorsFromResult(state);
      applyRuntimeButtonGate(details);
      return details;
    } catch {
      updateLocalRuntimeIndicatorsFromResult({
        details: {
          runtimeState: "unknown",
          hasRuntimeInfo: false,
          autoStartPaused: true,
        },
      });
      applyRuntimeButtonGate(null);
      return null;
    }
  };
  unbindManagedLocalRuntimeStateChange = subscribeManagedLocalRuntimeStateChange(
    () => {
      void refreshLocalRuntimeStateSummary();
    },
  );
  const prefsWindow = addon.data.prefs?.window as
    | (Window & {
        addEventListener?: (
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: AddEventListenerOptions | boolean,
        ) => void;
      })
    | undefined;
  if (typeof prefsWindow?.addEventListener === "function") {
    prefsWindow.addEventListener(
      "unload",
      () => {
        if (unbindManagedLocalRuntimeStateChange) {
          unbindManagedLocalRuntimeStateChange();
          unbindManagedLocalRuntimeStateChange = null;
        }
      },
      { once: true },
    );
  }

  const runLocalRuntimeAction = async (
    type: string,
    payload?: Record<string, unknown>,
  ) => {
    setRuntimeActionButtonsDisabled(true);
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
    }
  };

  const openLocalRuntimeDebugConsole = async () => {
    return addon.hooks.onPrefsEvent("openSkillRunnerLocalDeployDebugConsole", {
      window: addon.data.prefs?.window,
    });
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
        const nextWorkflowDir = normalizedWorkflowDir || getEffectiveWorkflowDir();
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

  if (localRuntimeStatusText) {
    setLocalRuntimeStatusText(
      getString("pref-skillrunner-local-status-idle" as any),
    );
  }
  updateLocalRuntimeIndicatorsFromResult({
    details: {
      runtimeState: "unknown",
      hasRuntimeInfo: false,
      autoStartPaused: true,
    },
  });
  void refreshLocalRuntimeStateSummary();

  if (localRuntimeDeployButton) {
    localRuntimeDeployButton.addEventListener("command", () => {
      void runLocalRuntimeAction("deploySkillRunnerLocalRuntime");
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

  if (localRuntimeOpenDebugConsoleButton) {
    localRuntimeOpenDebugConsoleButton.addEventListener("command", () => {
      void (async () => {
        try {
          await openLocalRuntimeDebugConsole();
        } catch {
          // keep debug-console action silent in status text to avoid polluting runtime action feedback
        } finally {
          await refreshLocalRuntimeStateSummary();
        }
      })();
    });
  }

  if (localRuntimeOpenManagementButton) {
    localRuntimeOpenManagementButton.addEventListener("command", () => {
      void runLocalRuntimeAction("openSkillRunnerManagedBackendPage");
    });
  }

  if (localRuntimeRefreshModelCacheButton) {
    localRuntimeRefreshModelCacheButton.addEventListener("command", () => {
      void runLocalRuntimeAction("refreshSkillRunnerManagedModelCache");
    });
  }
}
