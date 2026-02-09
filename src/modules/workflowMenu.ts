import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { buildSelectionContext } from "./selectionContext";
import { executeBuildRequests } from "../workflows/runtime";
import { executeWorkflowFromCurrentSelection } from "./workflowExecute";
import { getLoadedWorkflowEntries } from "./workflowRuntime";

const ROOT_MENU_ID = `${config.addonRef}-workflows-menu`;
const ROOT_POPUP_ID = `${config.addonRef}-workflows-popup`;

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
  if (workflows.length === 0) {
    appendDisabledItem(win, popup, getString("menu-workflows-empty"));
    return;
  }

  const selectedItems = win.ZoteroPane?.getSelectedItems?.() || [];
  if (selectedItems.length === 0) {
    for (const workflow of workflows) {
      appendDisabledItem(
        win,
        popup,
        `${workflow.manifest.label} (${getString("menu-workflow-no-selection")})`,
      );
    }
    return;
  }

  const selectionContext = await buildSelectionContext(selectedItems);
  for (const workflow of workflows) {
    const menuItem = win.document.createXULElement("menuitem");
    let disabledReason = "";
    try {
      await executeBuildRequests({
        workflow,
        selectionContext,
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
  menu.setAttribute("label", getString("menu-workflows-root"));
  const popup = win.document.createXULElement("menupopup") as XULElement;
  popup.id = ROOT_POPUP_ID;
  popup.addEventListener("popupshowing", () => {
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
