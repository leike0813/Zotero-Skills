import { config } from "../../package.json";
import { getPref, setPref } from "../utils/prefs";
import { getEffectiveWorkflowDir } from "./workflowRuntime";

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
}
