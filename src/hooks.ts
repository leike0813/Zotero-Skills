import {
  BasicExampleFactory,
} from "./modules/examples";
import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";
import { registerSelectionSampleMenu } from "./modules/selectionSample";
import { ensureWorkflowMenuForWindow, refreshWorkflowMenus } from "./modules/workflowMenu";
import { rescanWorkflowRegistry } from "./modules/workflowRuntime";
import { openBackendManagerDialog } from "./modules/backendManager";
import { openWorkflowSettingsDialog } from "./modules/workflowSettingsDialog";
import { openTaskManagerDialog } from "./modules/taskManagerDialog";
import { openLogViewerDialog } from "./modules/logViewerDialog";
import { installWorkflowEditorHostBridge } from "./modules/workflowEditorHost";

const WORKFLOW_MENU_RETRY_INTERVAL_MS = 100;
const WORKFLOW_MENU_RETRY_MAX_ATTEMPTS = 20;

async function delayMs(ms: number) {
  const runtime = globalThis as {
    Zotero?: { Promise?: { delay?: (delayMs: number) => Promise<void> } };
  };
  if (typeof runtime.Zotero?.Promise?.delay === "function") {
    await runtime.Zotero.Promise.delay(ms);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getRuntimeToolkit() {
  const runtime = globalThis as {
    ztoolkit?: {
      unregisterAll?: () => void;
      log?: (...args: unknown[]) => void;
      ProgressWindow?: new (
        title: string,
        options?: { closeOnClick?: boolean; closeTime?: number },
      ) => {
        createLine: (options: {
          text: string;
          type?: string;
          progress?: number;
        }) => {
          show: () => {
            changeLine: (options: {
              progress?: number;
              text?: string;
            }) => void;
            startCloseTimer: (delayMs: number) => void;
          };
        };
      };
    };
  };
  return addon.data.ztoolkit || runtime.ztoolkit;
}

function unregisterToolkitSafely() {
  getRuntimeToolkit()?.unregisterAll?.();
}

export async function ensureWorkflowRegistryAndMenu(
  win: _ZoteroTypes.MainWindow,
  options?: {
    retryIntervalMs?: number;
    maxMenuRetryAttempts?: number;
  },
) {
  if (
    !addon.data.workflow?.workflowsDir ||
    !addon.data.workflow?.loaded?.workflows?.length
  ) {
    await rescanWorkflowRegistry();
  }

  const retryIntervalMs = Math.max(
    0,
    options?.retryIntervalMs ?? WORKFLOW_MENU_RETRY_INTERVAL_MS,
  );
  const maxMenuRetryAttempts = Math.max(
    1,
    options?.maxMenuRetryAttempts ?? WORKFLOW_MENU_RETRY_MAX_ATTEMPTS,
  );
  const menuId = `${addon.data.config.addonRef}-workflows-menu`;
  for (let attempt = 0; attempt < maxMenuRetryAttempts; attempt++) {
    ensureWorkflowMenuForWindow(win);
    if (win.document.getElementById(menuId)) {
      return;
    }
    if (attempt < maxMenuRetryAttempts - 1 && retryIntervalMs > 0) {
      await delayMs(retryIntervalMs);
    }
  }
}

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();
  installWorkflowEditorHostBridge();

  await rescanWorkflowRegistry();

  BasicExampleFactory.registerPrefs();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  await ensureWorkflowRegistryAndMenu(win);

  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  const ProgressWindow = getRuntimeToolkit()?.ProgressWindow;
  const popupWin = ProgressWindow
    ? new ProgressWindow(addon.data.config.addonName, {
        closeOnClick: true,
        closeTime: -1,
      })
        .createLine({
          text: getString("startup-begin"),
          type: "default",
          progress: 0,
        })
        .show()
    : null;

  if (popupWin) {
    await Zotero.Promise.delay(1000);
    popupWin.changeLine({
      progress: 30,
      text: `[30%] ${getString("startup-begin")}`,
    });
  }

  registerSelectionSampleMenu();

  if (popupWin) {
    await Zotero.Promise.delay(1000);

    popupWin.changeLine({
      progress: 100,
      text: `[100%] ${getString("startup-finish")}`,
    });
    popupWin.startCloseTimer(5000);
  }

}

async function onMainWindowUnload(win: Window): Promise<void> {
  unregisterToolkitSafely();
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  unregisterToolkitSafely();
  addon.data.dialog?.window?.close();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * This function is just an example of dispatcher for Notify events.
 * Any operations should be placed in a function to keep this funcion clear.
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  getRuntimeToolkit()?.log?.("notify", event, type, ids, extraData);
  return;
}

/**
 * This function is just an example of dispatcher for Preference UI events.
 * Any operations should be placed in a function to keep this funcion clear.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    case "scanWorkflows": {
      const requestedDir = String(data.workflowsDir || "").trim();
      const state = requestedDir
        ? await rescanWorkflowRegistry({ workflowsDir: requestedDir })
        : await rescanWorkflowRegistry();
      refreshWorkflowMenus();
      const messageLines = [
        `Workflow scan finished: loaded=${state.loaded.workflows.length}, warnings=${state.loaded.warnings.length}, errors=${state.loaded.errors.length}`,
      ];
      if (state.loaded.errors.length > 0) {
        messageLines.push(`First error: ${state.loaded.errors[0]}`);
      }
      if (state.loaded.warnings.length > 0) {
        messageLines.push(`First warning: ${state.loaded.warnings[0]}`);
      }
      if (typeof console !== "undefined") {
        if (state.loaded.errors.length > 0) {
          console.error(
            `[workflow-scan] dir=${state.workflowsDir} errors=${JSON.stringify(state.loaded.errors)} warnings=${JSON.stringify(state.loaded.warnings)}`,
          );
        } else {
          console.info(
            `[workflow-scan] dir=${state.workflowsDir} loaded=${state.loaded.workflows.length} warnings=${state.loaded.warnings.length}`,
          );
        }
      }
      const message = messageLines.join("\n");
      data.window?.alert?.(message);
      break;
    }
    case "openBackendManager":
      await openBackendManagerDialog({
        window: data.window,
      });
      break;
    case "openWorkflowSettings":
      await openWorkflowSettingsDialog({
        window: data.window,
        workflowId: typeof data.workflowId === "string" ? data.workflowId : undefined,
      });
      break;
    case "openTaskManager":
      await openTaskManagerDialog();
      break;
    case "openLogViewer":
      await openLogViewerDialog();
      break;
    default:
      return;
  }
}

function onShortcuts(_type: string) {
  return;
}

function onDialogEvents(_type: string) {
  return;
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};
