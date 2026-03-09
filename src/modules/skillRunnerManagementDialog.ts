import type { DialogHelper } from "zotero-plugin-toolkit";
import { getString } from "../utils/locale";
import { isWindowAlive } from "../utils/window";

const HTML_NS = "http://www.w3.org/1999/xhtml";

let managementDialog: DialogHelper | undefined;

function createHtmlElement<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
) {
  return doc.createElementNS(HTML_NS, tag) as HTMLElementTagNameMap[K];
}

function createManagementFrame(doc: Document, uiUrl: string) {
  const createXul = (doc as { createXULElement?: (tag: string) => Element })
    .createXULElement;
  if (typeof createXul === "function") {
    const browser = createXul.call(doc, "browser");
    browser.setAttribute("data-zs-role", "skillrunner-management-frame");
    browser.setAttribute("disableglobalhistory", "true");
    browser.setAttribute("remote", "true");
    browser.setAttribute("maychangeremoteness", "true");
    browser.setAttribute("type", "content");
    browser.setAttribute("flex", "1");
    browser.setAttribute("src", uiUrl);
    (
      browser as Element & { style?: CSSStyleDeclaration }
    ).style?.setProperty("width", "100%");
    (
      browser as Element & { style?: CSSStyleDeclaration }
    ).style?.setProperty("height", "100%");
    (
      browser as Element & { style?: CSSStyleDeclaration }
    ).style?.setProperty("min-height", "780px");
    return browser;
  }
  const frame = createHtmlElement(doc, "iframe");
  frame.setAttribute("data-zs-role", "skillrunner-management-frame");
  frame.src = uiUrl;
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.style.minHeight = "780px";
  frame.style.border = "none";
  return frame;
}

function buildDialogTitle(args: { backendId: string; baseUrl: string }) {
  return getString("backend-manager-management-title" as any, {
    args: {
      id: args.backendId,
      baseUrl: args.baseUrl,
    },
  });
}

export function buildSkillRunnerManagementUiUrl(baseUrl: string) {
  const normalizedBaseUrl = String(baseUrl || "").trim();
  if (!normalizedBaseUrl) {
    throw new Error(
      getString("backend-manager-error-management-base-url-required" as any),
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(normalizedBaseUrl);
  } catch {
    throw new Error(
      getString("backend-manager-error-management-base-url-invalid" as any),
    );
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(
      getString("backend-manager-error-management-base-url-invalid" as any),
    );
  }
  return `${parsed.origin}/ui`;
}

export async function openSkillRunnerManagementDialog(args: {
  backendId: string;
  baseUrl: string;
  uiUrl?: string;
}) {
  const normalizedBaseUrl = String(args.baseUrl || "").trim();
  const normalizedBackendId = String(args.backendId || "").trim() || "unknown";
  const uiUrl = String(args.uiUrl || "").trim() || buildSkillRunnerManagementUiUrl(normalizedBaseUrl);
  const title = buildDialogTitle({
    backendId: normalizedBackendId,
    baseUrl: normalizedBaseUrl,
  });

  if (isWindowAlive(managementDialog?.window)) {
    const existingWindow = managementDialog?.window;
    const frame = existingWindow?.document?.querySelector(
      "[data-zs-role='skillrunner-management-frame']",
    ) as (Element & { src?: string }) | null;
    if (frame) {
      frame.setAttribute("src", uiUrl);
      if ("src" in frame) {
        frame.src = uiUrl;
      }
    }
    if (existingWindow?.document) {
      existingWindow.document.title = title;
    }
    existingWindow?.focus?.();
    return;
  }

  const dialogData: Record<string, unknown> = {
    loadCallback: () => {
      const doc = managementDialog?.window?.document;
      if (!doc) {
        return;
      }
      const root = doc.getElementById("zs-skillrunner-management-root") as
        | HTMLElement
        | null;
      if (!root) {
        return;
      }
      root.innerHTML = "";
      const frame = createManagementFrame(doc, uiUrl);
      root.appendChild(frame);
    },
    unloadCallback: () => {},
  };

  managementDialog = new ztoolkit.Dialog(1, 1)
    .addCell(0, 0, {
      tag: "div",
      namespace: "html",
      id: "zs-skillrunner-management-root",
      styles: {
        width: "1280px",
        height: "820px",
        padding: "0",
        margin: "0",
        display: "flex",
      },
    })
    .addButton(getString("backend-manager-management-close" as any), "close")
    .setDialogData(dialogData)
    .open(title);

  await (dialogData as { unloadLock?: { promise?: Promise<void> } }).unloadLock
    ?.promise;
  managementDialog = undefined;
}
