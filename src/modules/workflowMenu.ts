import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { buildSelectionContext } from "./selectionContext";
import { executeBuildRequests } from "../workflows/runtime";
import { executeWorkflowFromCurrentSelection } from "./workflowExecute";
import { getLoadedWorkflowEntries, getLoadedWorkflowSourceById } from "./workflowRuntime";
import { resolveProvider } from "../providers/registry";
import { resolveWorkflowExecutionContext } from "./workflowSettings";
import { appendRuntimeLog } from "./runtimeLogManager";
import { alertWindow } from "./workflowExecution/feedbackSeam";

const ROOT_MENU_ID = `${config.addonRef}-workflows-menu`;
const ROOT_POPUP_ID = `${config.addonRef}-workflows-popup`;
const MENU_ICON_URI = `chrome://${config.addonRef}/content/icons/favicon@0.5x.png`;

export type WorkflowActionPopupBuildOptions = {
  includeTaskManagerItem?: boolean;
};

function getMenuLabel(id: string, fallback: string) {
  const localized = getString(id as any);
  const fallbackKey = `${config.addonRef}-${id}`;
  return localized === fallbackKey ? fallback : localized;
}

function getItemMenuPopup(win: _ZoteroTypes.MainWindow) {
  return win.document.getElementById("zotero-itemmenu") as XULElement | null;
}

function clearPopupChildren(popup: XULElement) {
  while (popup.firstChild) {
    popup.removeChild(popup.firstChild);
  }
}

function appendDisabledItem(
  win: _ZoteroTypes.MainWindow,
  popup: XULElement,
  label: string,
) {
  const item = win.document.createXULElement("menuitem");
  item.setAttribute("label", label);
  item.setAttribute("disabled", "true");
  popup.appendChild(item);
}

function appendTaskManagerItem(win: _ZoteroTypes.MainWindow, popup: XULElement) {
  const item = win.document.createXULElement("menuitem");
  item.setAttribute(
    "label",
    getMenuLabel("menu-workflows-task-manager", "Open Dashboard..."),
  );
  item.addEventListener("command", () => {
    void addon.hooks.onPrefsEvent("openDashboard", { window: win });
  });
  popup.appendChild(item);
}

function appendMenuSeparator(win: _ZoteroTypes.MainWindow, popup: XULElement) {
  const separator = win.document.createXULElement("menuseparator");
  popup.appendChild(separator);
}

function compactError(error: unknown) {
  const text = String(error || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "invalid selection";
  }
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

function isNoValidInputUnitsError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === "NO_VALID_INPUT_UNITS"
  ) {
    return true;
  }
  return /has no valid input units after filtering/i.test(String(error || ""));
}

function resolveDisabledReason(error: unknown) {
  if (isNoValidInputUnitsError(error)) {
    return getMenuLabel("menu-workflow-no-valid-input", "no valid input");
  }
  return compactError(error);
}

function buildTriggerFailureMessage(workflowLabel: string, error: unknown) {
  const reason = compactError(error);
  try {
    const localized = String(
      getString("workflow-execute-cannot-run" as any, {
        args: {
          workflowLabel,
          reason,
        },
      }),
    ).trim();
    if (localized && !localized.includes("workflow-execute-cannot-run")) {
      return localized;
    }
  } catch {
    // ignore localization failures
  }
  return `Workflow ${workflowLabel} cannot run: ${reason}`;
}

async function triggerWorkflowFromMenu(args: {
  win: _ZoteroTypes.MainWindow;
  workflow: ReturnType<typeof getLoadedWorkflowEntries>[number];
}) {
  try {
    await executeWorkflowFromCurrentSelection({
      win: args.win,
      workflow: args.workflow,
      requireSettingsGate: true,
    });
  } catch (error) {
    appendRuntimeLog({
      level: "error",
      scope: "workflow-trigger",
      workflowId: args.workflow.manifest.id,
      providerId: String(args.workflow.manifest.provider || "").trim(),
      stage: "menu-trigger-failed",
      message: "workflow menu trigger failed before execution completed",
      details: {
        workflowSource: getLoadedWorkflowSourceById(args.workflow.manifest.id),
        reason: compactError(error),
      },
      error,
    });
    alertWindow(
      args.win,
      buildTriggerFailureMessage(args.workflow.manifest.label, error),
    );
  }
}

export async function rebuildWorkflowActionPopup(
  win: _ZoteroTypes.MainWindow,
  popup: XULElement,
  options?: WorkflowActionPopupBuildOptions,
) {
  const includeTaskManagerItem = options?.includeTaskManagerItem !== false;
  clearPopupChildren(popup);
  const workflows = getLoadedWorkflowEntries();
  if (includeTaskManagerItem) {
    appendTaskManagerItem(win, popup);
    appendMenuSeparator(win, popup);
  }
  if (workflows.length === 0) {
    appendDisabledItem(
      win,
      popup,
      getMenuLabel("menu-workflows-empty", "No workflows loaded"),
    );
    return;
  }

  const selectedItems = win.ZoteroPane?.getSelectedItems?.() || [];
  if (selectedItems.length === 0) {
    for (const workflow of workflows) {
      appendDisabledItem(
        win,
        popup,
        `${workflow.manifest.label} (${getMenuLabel("menu-workflow-no-selection", "no selection")})`,
      );
    }
    return;
  }

  const selectionContext = await buildSelectionContext(selectedItems);
  for (const workflow of workflows) {
    const menuItem = win.document.createXULElement("menuitem");
    let disabledReason = "";
    try {
      const executionContext = await resolveWorkflowExecutionContext({
        workflow,
      });
      resolveProvider({
        requestKind: executionContext.requestKind,
        backend: executionContext.backend,
      });
      await executeBuildRequests({
        workflow,
        selectionContext,
        executionOptions: {
          workflowParams: executionContext.workflowParams,
          providerOptions: executionContext.providerOptions,
        },
      });
    } catch (error) {
      disabledReason = resolveDisabledReason(error);
    }

    const label = disabledReason
      ? `${workflow.manifest.label} (${disabledReason})`
      : workflow.manifest.label;
    menuItem.setAttribute("label", label);
    if (disabledReason) {
      menuItem.setAttribute("disabled", "true");
    } else {
      menuItem.addEventListener("command", () => {
        void triggerWorkflowFromMenu({
          win,
          workflow,
        });
      });
    }
    popup.appendChild(menuItem);
  }
}

export function ensureWorkflowMenuForWindow(win: _ZoteroTypes.MainWindow) {
  const itemPopup = getItemMenuPopup(win);
  if (!itemPopup) {
    return;
  }

  const existing = win.document.getElementById(ROOT_MENU_ID);
  if (existing) {
    existing.remove();
  }

  const menu = win.document.createXULElement("menu");
  menu.id = ROOT_MENU_ID;
  menu.setAttribute(
    "label",
    getMenuLabel("menu-workflows-root", "Zotero-Skills"),
  );
  menu.setAttribute("class", "menu-iconic");
  menu.setAttribute("image", MENU_ICON_URI);
  const popup = win.document.createXULElement("menupopup") as XULElement;
  popup.id = ROOT_POPUP_ID;
  popup.addEventListener("popupshowing", (event: Event) => {
    if (event.target !== popup) {
      return;
    }
    void rebuildWorkflowActionPopup(win, popup, {
      includeTaskManagerItem: true,
    });
  });
  menu.appendChild(popup);
  itemPopup.appendChild(menu);
}

export function refreshWorkflowMenus() {
  const wins = Zotero.getMainWindows?.() || [];
  for (const win of wins) {
    ensureWorkflowMenuForWindow(win);
  }
}
