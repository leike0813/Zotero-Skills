import { config } from "../../package.json";
import { getPref, setPref } from "../utils/prefs";
import { getEffectiveWorkflowDir } from "./workflowRuntime";

const DEFAULT_SKILLRUNNER_ENDPOINT = "http://127.0.0.1:8030";

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

  const endpointInput = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-skillrunner-endpoint`,
  ) as HTMLInputElement | null;
  const workflowDirInput = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-workflow-dir`,
  ) as HTMLInputElement | null;
  const scanButton = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-workflow-scan`,
  ) as XUL.Button | null;
  if (!endpointInput) {
    return;
  }

  const endpoint = String(getPref("skillRunnerEndpoint") || "").trim();
  const normalizedEndpoint = endpoint || DEFAULT_SKILLRUNNER_ENDPOINT;
  if (!endpoint) {
    setPref("skillRunnerEndpoint", normalizedEndpoint);
  }
  endpointInput.value = normalizedEndpoint;

  endpointInput.addEventListener("change", (event: Event) => {
    const value = (event.target as HTMLInputElement).value.trim();
    const nextValue = value || DEFAULT_SKILLRUNNER_ENDPOINT;
    setPref("skillRunnerEndpoint", nextValue);
    endpointInput.value = nextValue;
  });

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
      void addon.hooks.onPrefsEvent("scanWorkflows", {
        window: addon.data.prefs?.window,
      });
    });
  }
}
