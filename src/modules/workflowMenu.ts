import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { buildSelectionContext } from "./selectionContext";
import { executeBuildRequests } from "../workflows/runtime";
import { executeWorkflowFromCurrentSelection } from "./workflowExecute";
import { getLoadedWorkflowEntries } from "./workflowRuntime";
import { resolveProvider } from "../providers/registry";
import { resolveWorkflowExecutionContext } from "./workflowSettings";
import type { LoadedWorkflow } from "../workflows/types";

const ROOT_MENU_ID = `${config.addonRef}-workflows-menu`;
const ROOT_POPUP_ID = `${config.addonRef}-workflows-popup`;
const MENU_ICON_URI = `chrome://${config.addonRef}/content/icons/favicon@0.5x.png`;

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

function appendRescanItem(win: _ZoteroTypes.MainWindow, popup: XULElement) {
  const item = win.document.createXULElement("menuitem");
  item.setAttribute(
    "label",
    getMenuLabel("menu-workflows-rescan", "Rescan Workflows"),
  );
  item.addEventListener("command", () => {
    void addon.hooks.onPrefsEvent("scanWorkflows", { window: win });
  });
  popup.appendChild(item);
}

function appendWorkflowSettingsItem(
  win: _ZoteroTypes.MainWindow,
  popup: XULElement,
  workflows: LoadedWorkflow[],
) {
  const menu = win.document.createXULElement("menu");
  menu.setAttribute(
    "label",
    getMenuLabel("menu-workflows-settings", "Workflow Settings..."),
  );
  const subPopup = win.document.createXULElement("menupopup") as XULElement;
  if (workflows.length === 0) {
    appendDisabledItem(
      win,
      subPopup,
      getMenuLabel("menu-workflows-empty", "No workflows loaded"),
    );
  } else {
    for (const workflow of workflows) {
      const item = win.document.createXULElement("menuitem");
      item.setAttribute("label", workflow.manifest.label);
      item.addEventListener("command", () => {
        void addon.hooks.onPrefsEvent("openWorkflowSettings", {
          window: win,
          workflowId: workflow.manifest.id,
        });
      });
      subPopup.appendChild(item);
    }
  }
  menu.appendChild(subPopup);
  popup.appendChild(menu);
}

function appendTaskManagerItem(win: _ZoteroTypes.MainWindow, popup: XULElement) {
  const item = win.document.createXULElement("menuitem");
  item.setAttribute(
    "label",
    getMenuLabel("menu-workflows-task-manager", "Open Task Manager..."),
  );
  item.addEventListener("command", () => {
    void addon.hooks.onPrefsEvent("openTaskManager", { window: win });
  });
  popup.appendChild(item);
}

function appendLogViewerItem(win: _ZoteroTypes.MainWindow, popup: XULElement) {
  const item = win.document.createXULElement("menuitem");
  item.setAttribute(
    "label",
    getMenuLabel("menu-workflows-open-logs", "Open Logs..."),
  );
  item.addEventListener("command", () => {
    void addon.hooks.onPrefsEvent("openLogViewer", { window: win });
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

async function rebuildWorkflowPopup(
  win: _ZoteroTypes.MainWindow,
  popup: XULElement,
) {
  clearPopupChildren(popup);
  const workflows = getLoadedWorkflowEntries();
  appendRescanItem(win, popup);
  appendWorkflowSettingsItem(win, popup, workflows);
  appendTaskManagerItem(win, popup);
  appendLogViewerItem(win, popup);
  appendMenuSeparator(win, popup);
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
        consumeRunOnce: false,
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
      disabledReason = compactError(error);
    }

    const label = disabledReason
      ? `${workflow.manifest.label} (${disabledReason})`
      : workflow.manifest.label;
    menuItem.setAttribute("label", label);
    if (disabledReason) {
      menuItem.setAttribute("disabled", "true");
    } else {
      menuItem.addEventListener("command", () => {
        void executeWorkflowFromCurrentSelection({
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
    void rebuildWorkflowPopup(win, popup);
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
