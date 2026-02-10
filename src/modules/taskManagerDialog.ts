import type { DialogHelper } from "zotero-plugin-toolkit";
import { getString } from "../utils/locale";
import { isWindowAlive } from "../utils/window";
import {
  clearFinishedWorkflowTasks,
  listWorkflowTasks,
  subscribeWorkflowTasks,
} from "./taskRuntime";

const HTML_NS = "http://www.w3.org/1999/xhtml";

let taskManagerDialog: DialogHelper | undefined;

function createHtmlElement<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
) {
  return doc.createElementNS(HTML_NS, tag) as HTMLElementTagNameMap[K];
}

function resolveTaskStateLabel(state: string) {
  if (state === "queued") {
    return getString("task-manager-status-queued" as any);
  }
  if (state === "running") {
    return getString("task-manager-status-running" as any);
  }
  return getString("task-manager-status-completed" as any);
}

function clearChildren(element: Element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function renderTaskRows(root: HTMLElement) {
  clearChildren(root);
  const tasks = listWorkflowTasks();
  const doc = root.ownerDocument;
  if (!doc) {
    return;
  }

  if (tasks.length === 0) {
    const empty = createHtmlElement(doc, "p");
    empty.textContent = getString("task-manager-empty" as any);
    empty.style.margin = "8px 0";
    empty.style.color = "#666";
    root.appendChild(empty);
    return;
  }

  const table = createHtmlElement(doc, "table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";

  const thead = createHtmlElement(doc, "thead");
  const headRow = createHtmlElement(doc, "tr");
  const columns = [
    getString("task-manager-column-task" as any),
    getString("task-manager-column-workflow" as any),
    getString("task-manager-column-status" as any),
  ];
  for (const title of columns) {
    const th = createHtmlElement(doc, "th");
    th.textContent = title;
    th.style.textAlign = "left";
    th.style.padding = "6px";
    th.style.borderBottom = "1px solid #d0d0d0";
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = createHtmlElement(doc, "tbody");
  for (const task of tasks) {
    const row = createHtmlElement(doc, "tr");
    const cells = [
      task.taskName,
      task.workflowLabel,
      resolveTaskStateLabel(task.state),
    ];
    for (const value of cells) {
      const td = createHtmlElement(doc, "td");
      td.textContent = value;
      td.style.padding = "6px";
      td.style.borderBottom = "1px solid #f0f0f0";
      row.appendChild(td);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  root.appendChild(table);
}

export async function openTaskManagerDialog() {
  if (isWindowAlive(taskManagerDialog?.window)) {
    taskManagerDialog?.window?.focus();
    return;
  }

  clearFinishedWorkflowTasks();

  let unsubscribeTasks: (() => void) | undefined;
  let refreshTimer: number | undefined;
  const dialogData: Record<string, unknown> = {
    loadCallback: () => {
      const doc = taskManagerDialog?.window?.document;
      if (!doc) {
        return;
      }
      const root = doc.getElementById("zs-task-manager-root") as
        | HTMLElement
        | null;
      if (!root) {
        return;
      }
      renderTaskRows(root);
      unsubscribeTasks = subscribeWorkflowTasks(() => {
        const currentRoot = taskManagerDialog?.window?.document.getElementById(
          "zs-task-manager-root",
        ) as HTMLElement | null;
        if (!currentRoot) {
          return;
        }
        renderTaskRows(currentRoot);
      });
      const dialogWindow = taskManagerDialog?.window;
      if (dialogWindow) {
        refreshTimer = dialogWindow.setInterval(() => {
          const currentRoot = dialogWindow.document.getElementById(
            "zs-task-manager-root",
          ) as HTMLElement | null;
          if (!currentRoot) {
            return;
          }
          renderTaskRows(currentRoot);
        }, 500);
      }
    },
    unloadCallback: () => {
      if (unsubscribeTasks) {
        unsubscribeTasks();
        unsubscribeTasks = undefined;
      }
      if (refreshTimer) {
        taskManagerDialog?.window?.clearInterval(refreshTimer);
        refreshTimer = undefined;
      }
    },
  };

  taskManagerDialog = new ztoolkit.Dialog(1, 1)
    .addCell(0, 0, {
      tag: "div",
      namespace: "html",
      id: "zs-task-manager-root",
      styles: {
        padding: "8px",
        minWidth: "700px",
      },
    })
    .addButton(getString("task-manager-close" as any), "close")
    .setDialogData(dialogData)
    .open(getString("task-manager-title" as any));

  await (dialogData as { unloadLock?: { promise?: Promise<void> } }).unloadLock
    ?.promise;

  taskManagerDialog = undefined;
}
