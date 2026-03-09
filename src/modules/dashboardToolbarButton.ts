import { config } from "../../package.json";
import { getString } from "../utils/locale";

const DASHBOARD_BUTTON_ID = `${config.addonRef}-tb-dashboard`;
const PRIMARY_ICON_URI = `chrome://${config.addonRef}/content/icons/favicon@0.5x.png`;
const FALLBACK_ICON_URI = `chrome://${config.addonRef}/content/icons/favicon.png`;

function localize(key: string, fallback: string) {
  try {
    const resolved = String(getString(key as any)).trim();
    return resolved || fallback;
  } catch {
    return fallback;
  }
}

function resolveToolbarHost(win: _ZoteroTypes.MainWindow) {
  const doc = win.document;
  return (
    doc.getElementById("zotero-items-toolbar") ||
    doc.getElementById("zotero-toolbar-item-tree") ||
    doc.getElementById("zotero-tabs-toolbar")
  );
}

function asElementLike(
  value: unknown,
): (Element & { parentNode: Node | null }) | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as { parentNode?: unknown };
  if (!("parentNode" in candidate)) {
    return null;
  }
  return value as Element & { parentNode: Node | null };
}

function resolveInsertAnchor(host: Element, doc: Document) {
  const directAnchorIds = [
    "zotero-tb-search",
    "zotero-tb-search-spinner",
    "zotero-tb-sync",
    "zotero-tb-sync-error",
  ];
  for (const id of directAnchorIds) {
    const anchor = doc.getElementById(id);
    if (anchor && anchor.parentNode === host) {
      return anchor;
    }
  }
  const nestedAnchor =
    doc.getElementById("zotero-tb-search") ||
    doc.getElementById("zotero-tb-search-spinner") ||
    doc.getElementById("zotero-tb-sync") ||
    doc.getElementById("zotero-tb-sync-error");
  if (!nestedAnchor) {
    return null;
  }
  let candidate: Element | null = nestedAnchor;
  while (candidate && candidate.parentNode && candidate.parentNode !== host) {
    candidate = asElementLike(candidate.parentNode);
  }
  if (candidate && candidate.parentNode === host) {
    return candidate;
  }
  return null;
}

function applyButtonStyling(
  button: Element & { style?: CSSStyleDeclaration },
  iconUri: string,
) {
  button.style?.setProperty("list-style-image", `url("${iconUri}")`);
  button.style?.setProperty("width", "24px");
  button.style?.setProperty("height", "24px");
  button.style?.setProperty("min-width", "24px");
  button.style?.setProperty("min-height", "24px");
  button.style?.setProperty("padding-inline", "0");
  button.style?.setProperty("padding-block", "0");
  button.style?.setProperty("margin-inline", "2px");
  button.style?.setProperty("--toolbarbutton-inner-padding", "0");
}

function syncButtonIconFill(
  button: Element & {
    style?: CSSStyleDeclaration;
    querySelector?: (selector: string) => Element | null;
    getBoundingClientRect?: () => { width: number; height: number };
  },
  win: _ZoteroTypes.MainWindow,
) {
  const apply = () => {
    const rect = button.getBoundingClientRect?.();
    const side =
      rect && Number.isFinite(rect.width) && Number.isFinite(rect.height)
        ? Math.max(16, Math.floor(Math.min(rect.width, rect.height)))
        : 24;
    const iconSize = `${Math.max(14, side - 2)}px`;
    button.style?.setProperty("--toolbarbutton-icon-fill-size", iconSize);
    const icon = button.querySelector?.(".toolbarbutton-icon") as
      | (Element & { style?: CSSStyleDeclaration })
      | null;
    icon?.style?.setProperty("width", iconSize);
    icon?.style?.setProperty("height", iconSize);
  };
  apply();
  if (typeof (win as { setTimeout?: unknown }).setTimeout === "function") {
    (win as { setTimeout: (handler: () => void, timeout?: number) => number }).setTimeout(
      apply,
      0,
    );
  }
}

export function ensureDashboardToolbarButton(win: _ZoteroTypes.MainWindow) {
  const doc = win.document;
  const host = resolveToolbarHost(win);
  if (!host) {
    return;
  }

  const existing = doc.getElementById(DASHBOARD_BUTTON_ID);
  if (existing) {
    return;
  }

  const button = doc.createXULElement("toolbarbutton");
  const tooltip = localize("task-dashboard-toolbar-open", "Open Dashboard");
  button.id = DASHBOARD_BUTTON_ID;
  button.setAttribute("class", "zotero-tb-button");
  button.setAttribute("tooltiptext", tooltip);
  button.setAttribute("aria-label", tooltip);
  button.setAttribute("image", PRIMARY_ICON_URI);
  applyButtonStyling(button as Element & { style?: CSSStyleDeclaration }, PRIMARY_ICON_URI);
  button.addEventListener("error", () => {
    button.setAttribute("image", FALLBACK_ICON_URI);
    applyButtonStyling(
      button as Element & { style?: CSSStyleDeclaration },
      FALLBACK_ICON_URI,
    );
  });
  button.addEventListener("command", () => {
    void addon.hooks.onPrefsEvent("openDashboard", { window: win });
  });
  const anchor = resolveInsertAnchor(host, doc);
  if (anchor) {
    host.insertBefore(button, anchor);
  } else {
    host.appendChild(button);
  }
  syncButtonIconFill(
    button as Element & {
      style?: CSSStyleDeclaration;
      querySelector?: (selector: string) => Element | null;
      getBoundingClientRect?: () => { width: number; height: number };
    },
    win,
  );
}

export function removeDashboardToolbarButton(win: Window | _ZoteroTypes.MainWindow) {
  const doc = (win as _ZoteroTypes.MainWindow)?.document;
  if (!doc) {
    return;
  }
  const existing = doc.getElementById(DASHBOARD_BUTTON_ID);
  existing?.remove();
}
