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
  const localRuntimeUninstallOptionsDialog = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-uninstall-options-dialog`,
  ) as HTMLElement | null;
  const localRuntimeUninstallOptionClearData = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-uninstall-option-clear-data`,
  ) as HTMLInputElement | null;
  const localRuntimeUninstallOptionClearAgentHome = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-uninstall-option-clear-agent-home`,
  ) as HTMLInputElement | null;
  const localRuntimeUninstallOptionsConfirmButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-uninstall-options-confirm`,
  ) as XUL.Button | null;
  const localRuntimeUninstallOptionsCancelButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-uninstall-options-cancel`,
  ) as XUL.Button | null;
  const localRuntimeProgressRow = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-progress-row`,
  ) as HTMLElement | null;
  const localRuntimeProgressmeter = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-progressmeter`,
  ) as (HTMLElement & { value?: string | number }) | null;
  const localRuntimeProgressText = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-local-progress-text`,
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

  const setProgressVisible = (visible: boolean) => {
    if (!localRuntimeProgressRow) {
      return;
    }
    if (visible) {
      localRuntimeProgressRow.classList.add("is-visible");
      return;
    }
    localRuntimeProgressRow.classList.remove("is-visible");
  };

  const getProgressStageLabel = (stage: string, fallbackLabel: string) => {
    const normalized = String(stage || "").trim().toLowerCase();
    const labelKeyByStage: Record<string, string> = {
      "deploy-release-assets-probe": "pref-skillrunner-local-progress-deploy-step-1",
      "deploy-release-download-checksum":
        "pref-skillrunner-local-progress-deploy-step-2",
      "deploy-release-extract": "pref-skillrunner-local-progress-deploy-step-3",
      "deploy-bootstrap": "pref-skillrunner-local-progress-deploy-step-4",
      "deploy-post-bootstrap": "pref-skillrunner-local-progress-deploy-step-5",
      "uninstall-down": "pref-skillrunner-local-progress-uninstall-step-down",
      "uninstall-profile":
        "pref-skillrunner-local-progress-uninstall-step-profile",
    };
    if (normalized.startsWith("uninstall-delete-")) {
      return getString("pref-skillrunner-local-progress-uninstall-step-delete" as any);
    }
    const key = labelKeyByStage[normalized];
    if (key) {
      return getString(key as any);
    }
    return String(fallbackLabel || "").trim();
  };

  const updateLocalRuntimeProgressFromDetails = (
    details: Record<string, unknown> | null,
  ) => {
    const progress = (details?.actionProgress || null) as
      | {
          action?: unknown;
          current?: unknown;
          total?: unknown;
          percent?: unknown;
          stage?: unknown;
          label?: unknown;
        }
      | null;
    if (!progress || !progress.action) {
      setProgressVisible(false);
      if (localRuntimeProgressmeter) {
        localRuntimeProgressmeter.style.width = "0%";
      }
      if (localRuntimeProgressText) {
        localRuntimeProgressText.textContent = "";
      }
      return;
    }
    const percentRaw = Number(progress.percent || 0);
    const percent = Number.isFinite(percentRaw)
      ? Math.max(0, Math.min(100, Math.floor(percentRaw)))
      : 0;
    const current = Number(progress.current || 0);
    const total = Number(progress.total || 0);
    const stageLabel = getProgressStageLabel(
      String(progress.stage || ""),
      String(progress.label || ""),
    );
    const actionLabel =
      String(progress.action || "").trim().toLowerCase() === "uninstall"
        ? getString("pref-skillrunner-local-progress-uninstall-title" as any)
        : getString("pref-skillrunner-local-progress-deploy-title" as any);
    if (localRuntimeProgressmeter) {
      localRuntimeProgressmeter.style.width = String(percent) + "%";
    }
    if (localRuntimeProgressText) {
      localRuntimeProgressText.textContent =
        `${actionLabel} ${current}/${total} · ${stageLabel}`.trim();
    }
    setProgressVisible(true);
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
    updateLocalRuntimeProgressFromDetails(details);
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
      updateLocalRuntimeProgressFromDetails(null);
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

  const confirmWithWindow = (message: string) => {
    const hostWindow = addon.data.prefs?.window as
      | (Window & { confirm?: (text: string) => boolean })
      | undefined;
    if (typeof hostWindow?.confirm === "function") {
      return hostWindow.confirm(message);
    }
    return true;
  };

  const confirmDeployForPlan = (planDetails: Record<string, unknown>) => {
    const layout = (planDetails.installLayout || {}) as {
      paths?: Array<{ path?: unknown; purpose?: unknown }>;
    };
    const pathLines = Array.isArray(layout.paths)
      ? layout.paths
          .map((entry) => {
            const path = String(entry.path || "").trim();
            const purpose = String(entry.purpose || "").trim();
            if (!path) {
              return "";
            }
            return `- ${path}${purpose ? ` (${purpose})` : ""}`;
          })
          .filter(Boolean)
      : [];
    const message = [
      getString("pref-skillrunner-local-deploy-confirm-message" as any),
      "",
      getString("pref-skillrunner-local-deploy-confirm-layout-title" as any),
      ...pathLines,
    ]
      .filter(Boolean)
      .join("\n");
    return confirmWithWindow(message);
  };

  const hideUninstallOptionsDialog = () => {
    if (!localRuntimeUninstallOptionsDialog) {
      return;
    }
    localRuntimeUninstallOptionsDialog.classList.remove("is-visible");
  };

  const showUninstallOptionsDialog = () => {
    if (
      !localRuntimeUninstallOptionsDialog ||
      !localRuntimeUninstallOptionClearData ||
      !localRuntimeUninstallOptionClearAgentHome ||
      !localRuntimeUninstallOptionsConfirmButton ||
      !localRuntimeUninstallOptionsCancelButton
    ) {
      const clearData = confirmWithWindow(
        getString("pref-skillrunner-local-uninstall-option-clear-data" as any),
      );
      const clearAgentHome = confirmWithWindow(
        getString("pref-skillrunner-local-uninstall-option-clear-agent-home" as any),
      );
      return Promise.resolve({
        clearData,
        clearAgentHome,
      });
    }
    localRuntimeUninstallOptionClearData.checked = false;
    localRuntimeUninstallOptionClearAgentHome.checked = false;
    localRuntimeUninstallOptionsDialog.classList.add("is-visible");
    return new Promise<{
      clearData: boolean;
      clearAgentHome: boolean;
    } | null>((resolve) => {
      const removeListener = (
        target: XUL.Button,
        listener: (event?: unknown) => void,
      ) => {
        const typed = target as unknown as {
          removeEventListener?: (type: string, listener: (event?: unknown) => void) => void;
        };
        if (typeof typed.removeEventListener === "function") {
          typed.removeEventListener("command", listener);
        }
      };
      const cleanup = () => {
        removeListener(localRuntimeUninstallOptionsConfirmButton, onConfirm);
        removeListener(localRuntimeUninstallOptionsCancelButton, onCancel);
        hideUninstallOptionsDialog();
      };
      const onConfirm = () => {
        const result = {
          clearData: localRuntimeUninstallOptionClearData.checked === true,
          clearAgentHome: localRuntimeUninstallOptionClearAgentHome.checked === true,
        };
        cleanup();
        resolve(result);
      };
      const onCancel = () => {
        cleanup();
        resolve(null);
      };
      localRuntimeUninstallOptionsConfirmButton.addEventListener("command", onConfirm);
      localRuntimeUninstallOptionsCancelButton.addEventListener("command", onCancel);
    });
  };

  const confirmUninstallPreview = (previewDetails: Record<string, unknown>) => {
    const removableTargets = Array.isArray(previewDetails.removableTargets)
      ? (previewDetails.removableTargets as Array<{ path?: unknown; purpose?: unknown }>)
      : [];
    const preservedTargets = Array.isArray(previewDetails.preservedTargets)
      ? (previewDetails.preservedTargets as Array<{ path?: unknown; purpose?: unknown }>)
      : [];
    const removableLines = removableTargets
      .map((entry) => {
        const path = String(entry.path || "").trim();
        const purpose = String(entry.purpose || "").trim();
        if (!path) {
          return "";
        }
        return `- ${path}${purpose ? ` (${purpose})` : ""}`;
      })
      .filter(Boolean);
    const preservedLines = preservedTargets
      .map((entry) => {
        const path = String(entry.path || "").trim();
        const purpose = String(entry.purpose || "").trim();
        if (!path) {
          return "";
        }
        return `- ${path}${purpose ? ` (${purpose})` : ""}`;
      })
      .filter(Boolean);
    const message = [
      getString("pref-skillrunner-local-uninstall-final-confirm-message" as any),
      "",
      getString("pref-skillrunner-local-uninstall-final-confirm-remove-title" as any),
      ...removableLines,
      "",
      getString("pref-skillrunner-local-uninstall-final-confirm-preserve-title" as any),
      ...preservedLines,
    ]
      .filter((line) => typeof line === "string")
      .join("\n");
    return confirmWithWindow(message);
  };

  const runLocalRuntimeOneclick = async () => {
    setRuntimeActionButtonsDisabled(true);
    setLocalRuntimeStatusText(getString("pref-skillrunner-local-status-working" as any));
    try {
      const planResponse = (await addon.hooks.onPrefsEvent(
        "planSkillRunnerLocalRuntimeOneclick",
        {
          window: addon.data.prefs?.window,
        },
      )) as { ok?: unknown; message?: unknown; details?: Record<string, unknown> };
      if (planResponse.ok !== true) {
        setLocalRuntimeStatusText(formatLocalRuntimeStatusMessage(planResponse));
        await refreshLocalRuntimeStateSummary();
        return;
      }
      const plannedAction = String(planResponse.details?.plannedAction || "")
        .trim()
        .toLowerCase();
      if (plannedAction === "deploy") {
        const confirmed = confirmDeployForPlan(planResponse.details || {});
        if (!confirmed) {
          setLocalRuntimeStatusText(
            getString("pref-skillrunner-local-status-cancelled" as any),
          );
          await refreshLocalRuntimeStateSummary();
          return;
        }
      }
      const response = await addon.hooks.onPrefsEvent("deploySkillRunnerLocalRuntime", {
        window: addon.data.prefs?.window,
        forcedBranch: plannedAction === "start" ? "start" : "deploy",
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

  const runLocalRuntimeUninstall = async () => {
    setRuntimeActionButtonsDisabled(true);
    setLocalRuntimeStatusText(getString("pref-skillrunner-local-status-working" as any));
    try {
      const options = await showUninstallOptionsDialog();
      if (!options) {
        setLocalRuntimeStatusText(
          getString("pref-skillrunner-local-status-cancelled" as any),
        );
        await refreshLocalRuntimeStateSummary();
        return;
      }
      const preview = (await addon.hooks.onPrefsEvent(
        "previewSkillRunnerLocalRuntimeUninstall",
        {
          window: addon.data.prefs?.window,
          clearData: options.clearData,
          clearAgentHome: options.clearAgentHome,
        },
      )) as { ok?: unknown; message?: unknown; details?: Record<string, unknown> };
      if (preview.ok !== true) {
        setLocalRuntimeStatusText(formatLocalRuntimeStatusMessage(preview));
        await refreshLocalRuntimeStateSummary();
        return;
      }
      const confirmed = confirmUninstallPreview(preview.details || {});
      if (!confirmed) {
        setLocalRuntimeStatusText(
          getString("pref-skillrunner-local-status-cancelled" as any),
        );
        await refreshLocalRuntimeStateSummary();
        return;
      }
      const response = await addon.hooks.onPrefsEvent("uninstallSkillRunnerLocalRuntime", {
        window: addon.data.prefs?.window,
        clearData: options.clearData,
        clearAgentHome: options.clearAgentHome,
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
      void runLocalRuntimeOneclick();
    });
  }

  if (localRuntimeStopButton) {
    localRuntimeStopButton.addEventListener("command", () => {
      void runLocalRuntimeAction("stopSkillRunnerLocalRuntime");
    });
  }

  if (localRuntimeUninstallButton) {
    localRuntimeUninstallButton.addEventListener("command", () => {
      void runLocalRuntimeUninstall();
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
