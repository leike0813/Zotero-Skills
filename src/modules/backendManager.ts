import {
  DEFAULT_BACKEND_ID,
  DEFAULT_BACKEND_TYPE,
  DEFAULT_SKILLRUNNER_ENDPOINT,
} from "../config/defaults";
import { refreshWorkflowMenus } from "./workflowMenu";
import { getPref, setPref } from "../utils/prefs";
import { loadBackendsRegistry } from "../backends/registry";
import { isWindowAlive } from "../utils/window";
import { getString } from "../utils/locale";
import type { BackendInstance } from "../backends/types";

const BACKENDS_CONFIG_PREF_KEY = "backendsConfigJson";
const PROVIDER_SECTIONS = [
  {
    type: DEFAULT_BACKEND_TYPE,
    labelKey: "backend-manager-provider-skillrunner",
  },
  {
    type: "generic-http",
    labelKey: "backend-manager-provider-generic-http",
  },
];

type EditableBackendRow = {
  id: string;
  type: string;
  baseUrl: string;
  authKind: "none" | "bearer";
  authToken: string;
  timeoutMs: string;
};

const HTML_NS = "http://www.w3.org/1999/xhtml";

function createHtmlElement<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
) {
  return doc.createElementNS(HTML_NS, tag) as HTMLElementTagNameMap[K];
}

function applySelectVisualStyle(control: HTMLElement, width?: string) {
  if (width) {
    control.style.width = width;
  }
  control.style.boxSizing = "border-box";
  control.style.position = "relative";
  control.style.display = "inline-block";
}

function getChoiceTrigger(control: Element) {
  return control.querySelector("[data-zs-choice-trigger='1']") as
    | HTMLButtonElement
    | null;
}

function getChoiceList(control: Element) {
  return control.querySelector("[data-zs-choice-list='1']") as
    | HTMLDivElement
    | null;
}

function closeChoiceList(control: Element) {
  const list = getChoiceList(control);
  if (list) {
    list.hidden = true;
    list.style.display = "none";
  }
}

function closeAllChoiceLists(doc: Document) {
  const lists = Array.from(
    doc.querySelectorAll("[data-zs-choice-list='1']"),
  ) as HTMLDivElement[];
  for (const list of lists) {
    list.hidden = true;
    list.style.display = "none";
  }
}

function dispatchChoiceChange(control: Element) {
  const doc = control.ownerDocument;
  if (!doc) {
    return;
  }
  const ev = doc.createEvent("Event");
  ev.initEvent("change", true, true);
  control.dispatchEvent(ev);
}

function setChoiceSelection(args: {
  control: Element;
  value: string;
  label: string;
  dispatchChange?: boolean;
}) {
  const { control, value, label, dispatchChange } = args;
  control.setAttribute("data-zs-choice-value", value);
  (control as { value?: string }).value = value;
  const triggerLabel = control.querySelector(
    "[data-zs-choice-trigger-label='1']",
  ) as HTMLSpanElement | null;
  if (triggerLabel) {
    triggerLabel.textContent = label || getString("choice-empty" as any);
  }
  if (dispatchChange) {
    dispatchChoiceChange(control);
  }
}

function getElementValue(control: Element) {
  if (control.getAttribute("data-zs-choice-control") === "1") {
    return String(control.getAttribute("data-zs-choice-value") || "").trim();
  }
  return String((control as HTMLInputElement | HTMLSelectElement).value || "").trim();
}

function setChoiceControlOptions(args: {
  control: Element;
  options: Array<{ value: string; text: string }>;
  selectedValue: string;
}) {
  const { control, options, selectedValue } = args;
  const list = getChoiceList(control);
  if (!list) {
    return;
  }
  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }
  for (const option of options) {
    const node = createHtmlElement(control.ownerDocument!, "button");
    node.type = "button";
    node.textContent = option.text;
    node.style.width = "100%";
    node.style.textAlign = "left";
    node.style.padding = "4px 6px";
    node.style.border = "none";
    node.style.background = "transparent";
    node.style.cursor = "pointer";
    node.style.color = "#111";
    node.addEventListener("mouseenter", () => {
      node.style.backgroundColor = "#f1f3f5";
    });
    node.addEventListener("mouseleave", () => {
      node.style.backgroundColor = "transparent";
    });
    const pick = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      setChoiceSelection({
        control,
        value: option.value,
        label: option.text,
        dispatchChange: true,
      });
      closeAllChoiceLists(control.ownerDocument!);
    };
    node.addEventListener("mousedown", pick);
    node.addEventListener("click", pick);
    node.addEventListener("command", pick as EventListener);
    list.appendChild(node);
  }
  const finalValue =
    options.find((entry) => entry.value === selectedValue)?.value ||
    (options[0]?.value ?? "");
  const finalLabel =
    options.find((entry) => entry.value === finalValue)?.text ||
    (options[0]?.text ?? "(empty)");
  setChoiceSelection({
    control,
    value: finalValue,
    label: finalLabel,
  });
}

function createChoiceControl(args: {
  doc: Document;
  options: Array<{ value: string; text: string }>;
  selectedValue: string;
}) {
  const { doc, options, selectedValue } = args;
  const select = createHtmlElement(doc, "div");
  select.setAttribute("data-zs-choice-control", "1");
  applySelectVisualStyle(select);

  const trigger = createHtmlElement(doc, "button");
  trigger.type = "button";
  trigger.setAttribute("data-zs-choice-trigger", "1");
  trigger.style.width = "100%";
  trigger.style.boxSizing = "border-box";
  trigger.style.padding = "2px 24px 2px 6px";
  trigger.style.border = "1px solid #8f8f9d";
  trigger.style.borderRadius = "4px";
  trigger.style.backgroundColor = "#fff";
  trigger.style.color = "#111";
  trigger.style.textAlign = "left";
  trigger.style.cursor = "pointer";
  trigger.style.position = "relative";
  select.appendChild(trigger);

  const triggerLabel = createHtmlElement(doc, "span");
  triggerLabel.setAttribute("data-zs-choice-trigger-label", "1");
  trigger.appendChild(triggerLabel);

  const arrow = createHtmlElement(doc, "span");
  arrow.textContent = "▾";
  arrow.style.position = "absolute";
  arrow.style.right = "8px";
  arrow.style.top = "50%";
  arrow.style.transform = "translateY(-50%)";
  arrow.style.pointerEvents = "none";
  trigger.appendChild(arrow);

  const list = createHtmlElement(doc, "div");
  list.setAttribute("data-zs-choice-list", "1");
  list.style.display = "none";
  list.hidden = true;
  list.style.position = "absolute";
  list.style.left = "0";
  list.style.right = "0";
  list.style.top = "calc(100% + 2px)";
  list.style.zIndex = "99999";
  list.style.border = "1px solid #8f8f9d";
  list.style.borderRadius = "4px";
  list.style.backgroundColor = "#fff";
  list.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
  list.style.maxHeight = "260px";
  list.style.overflowY = "auto";
  select.appendChild(list);

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const shouldOpen = list.style.display === "none";
    closeAllChoiceLists(doc);
    list.hidden = !shouldOpen;
    list.style.display = shouldOpen ? "block" : "none";
  });
  doc.addEventListener("click", (event) => {
    const target = event.target as Node | null;
    if (!target || !select.contains(target)) {
      closeAllChoiceLists(doc);
    }
  });

  setChoiceControlOptions({
    control: select,
    options,
    selectedValue,
  });
  return select;
}

function buildFallbackBackendRow(): EditableBackendRow {
  return {
    id: DEFAULT_BACKEND_ID,
    type: DEFAULT_BACKEND_TYPE,
    baseUrl: String(
      getPref("skillRunnerEndpoint") || DEFAULT_SKILLRUNNER_ENDPOINT,
    ).trim(),
    authKind: "none",
    authToken: "",
    timeoutMs: "600000",
  };
}

function normalizeRowFromBackend(backend: BackendInstance): EditableBackendRow {
  return {
    id: backend.id,
    type: backend.type,
    baseUrl: backend.baseUrl,
    authKind: backend.auth?.kind === "bearer" ? "bearer" : "none",
    authToken: backend.auth?.kind === "bearer" ? backend.auth.token || "" : "",
    timeoutMs:
      typeof backend.defaults?.timeout_ms === "number"
        ? String(backend.defaults.timeout_ms)
        : "",
  };
}

function appendCell(row: HTMLElement) {
  const doc = row.ownerDocument!;
  const cell = createHtmlElement(doc, "td");
  row.appendChild(cell);
  return cell;
}

function appendTextCell(
  row: HTMLElement,
  label: string,
  value: string,
  width = "220px",
) {
  const cell = appendCell(row);
  const input = createHtmlElement(row.ownerDocument!, "input");
  input.type = "text";
  input.value = value;
  input.setAttribute("data-zs-backend-field", label);
  input.style.width = width;
  cell.appendChild(input);
}

function appendSelectCell(
  row: HTMLElement,
  label: string,
  options: Array<{ value: string; text: string }>,
  selected: string,
) {
  const cell = appendCell(row);
  const control = createChoiceControl({
    doc: row.ownerDocument!,
    options,
    selectedValue: selected,
  });
  control.setAttribute("data-zs-backend-field", label);
  applySelectVisualStyle(control, "130px");
  cell.appendChild(control);
}

function appendRemoveCell(row: HTMLElement) {
  const cell = appendCell(row);
  const button = createHtmlElement(row.ownerDocument!, "button");
  button.type = "button";
  button.textContent = getString("backend-manager-remove" as any);
  button.addEventListener("click", () => {
    row.remove();
  });
  cell.appendChild(button);
}

function appendBackendRow(args: {
  tbody: HTMLElement;
  backend: EditableBackendRow;
}) {
  const row = createHtmlElement(args.tbody.ownerDocument!, "tr");
  row.setAttribute("data-zs-backend-row", "1");
  row.setAttribute("data-zs-backend-type", args.backend.type);

  appendTextCell(row, "id", args.backend.id, "190px");
  appendTextCell(row, "baseUrl", args.backend.baseUrl, "320px");
  appendSelectCell(
    row,
    "authKind",
    [
      {
        value: "none",
        text: getString("backend-manager-auth-none" as any),
      },
      {
        value: "bearer",
        text: getString("backend-manager-auth-bearer" as any),
      },
    ],
    args.backend.authKind,
  );
  appendTextCell(row, "authToken", args.backend.authToken, "220px");
  appendTextCell(row, "timeoutMs", args.backend.timeoutMs, "110px");
  appendRemoveCell(row);
  args.tbody.appendChild(row);
}

function appendProviderSection(args: {
  root: HTMLElement;
  provider: { type: string; labelKey: string };
}) {
  const doc = args.root.ownerDocument!;

  const section = createHtmlElement(doc, "div");
  section.style.marginBottom = "12px";
  section.setAttribute("data-zs-provider-section", args.provider.type);

  const header = createHtmlElement(doc, "div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.marginBottom = "6px";

  const title = createHtmlElement(doc, "h4");
  title.textContent = getString("backend-manager-provider-profiles-title" as any, {
    args: { provider: getString(args.provider.labelKey as any) },
  });
  title.style.margin = "0";
  header.appendChild(title);

  const addButton = createHtmlElement(doc, "button");
  addButton.type = "button";
  addButton.textContent = getString("backend-manager-provider-add" as any, {
    args: { provider: getString(args.provider.labelKey as any) },
  });
  addButton.setAttribute("data-zs-backend-action", "add");
  addButton.setAttribute("data-zs-provider-type", args.provider.type);
  header.appendChild(addButton);

  section.appendChild(header);

  const table = createHtmlElement(doc, "table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.setAttribute("data-zs-backend-table", args.provider.type);

  const thead = createHtmlElement(doc, "thead");
  const headerRow = createHtmlElement(doc, "tr");
  [
    "backend-manager-column-id",
    "backend-manager-column-base-url",
    "backend-manager-column-auth",
    "backend-manager-column-token",
    "backend-manager-column-timeout-ms",
    "backend-manager-column-actions",
  ].forEach((columnKey) => {
    const th = createHtmlElement(doc, "th");
    th.textContent = getString(columnKey as any);
    th.style.textAlign = "left";
    th.style.padding = "4px";
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = createHtmlElement(doc, "tbody");
  tbody.setAttribute("data-zs-backend-body", "1");
  tbody.setAttribute("data-zs-provider-type", args.provider.type);
  table.appendChild(tbody);

  section.appendChild(table);
  args.root.appendChild(section);
}

function ensureTableSkeleton(doc: Document, root: HTMLElement) {
  root.innerHTML = "";
  const wrapper = createHtmlElement(doc, "div");
  wrapper.style.minWidth = "1040px";

  PROVIDER_SECTIONS.forEach((provider) => {
    appendProviderSection({
      root: wrapper,
      provider,
    });
  });

  const help = createHtmlElement(doc, "p");
  help.textContent = getString("backend-manager-help" as any);
  help.style.marginTop = "8px";
  wrapper.appendChild(help);

  root.appendChild(wrapper);
}

function readRowField(row: Element, field: string) {
  const control = row.querySelector(
    `[data-zs-backend-field="${field}"]`,
  ) as Element | null;
  if (!control) {
    return "";
  }
  return getElementValue(control);
}

function collectBackendsFromDialog(doc: Document): {
  backends: BackendInstance[];
} {
  const rows = Array.from(
    doc.querySelectorAll("[data-zs-backend-row='1']"),
  ) as HTMLElement[];
  if (rows.length === 0) {
    throw new Error(getString("backend-manager-error-at-least-one" as any));
  }

  const seen = new Set<string>();
  const supportedTypes = new Set(PROVIDER_SECTIONS.map((entry) => entry.type));
  const backends: BackendInstance[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const type = String(row.getAttribute("data-zs-backend-type") || "").trim();
    const id = readRowField(row, "id");
    const baseUrl = readRowField(row, "baseUrl");
    const authKind = readRowField(row, "authKind") || "none";
    const authToken = readRowField(row, "authToken");
    const timeoutText = readRowField(row, "timeoutMs");

    if (!id) {
      throw new Error(
        getString("backend-manager-error-id-required" as any, {
          args: { row: i + 1 },
        }),
      );
    }
    if (seen.has(id)) {
      throw new Error(
        getString("backend-manager-error-duplicate-id" as any, {
          args: { row: i + 1, id },
        }),
      );
    }
    seen.add(id);
    if (!type || !supportedTypes.has(type)) {
      throw new Error(
        getString("backend-manager-error-unsupported-provider" as any, {
          args: { row: i + 1, type },
        }),
      );
    }
    if (!baseUrl) {
      throw new Error(
        getString("backend-manager-error-base-url-required" as any, {
          args: { row: i + 1 },
        }),
      );
    }
    try {
      const parsed = new URL(baseUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("protocol");
      }
    } catch {
      throw new Error(
        getString("backend-manager-error-base-url-invalid" as any, {
          args: { row: i + 1 },
        }),
      );
    }
    if (authKind === "bearer" && !authToken) {
      throw new Error(
        getString("backend-manager-error-bearer-required" as any, {
          args: { row: i + 1 },
        }),
      );
    }
    const timeoutMs = timeoutText ? Number(timeoutText) : undefined;
    if (
      typeof timeoutMs !== "undefined" &&
      (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    ) {
      throw new Error(
        getString("backend-manager-error-timeout-invalid" as any, {
          args: { row: i + 1 },
        }),
      );
    }

    backends.push({
      id,
      type,
      baseUrl,
      auth:
        authKind === "bearer"
          ? {
              kind: "bearer",
              token: authToken,
            }
          : {
              kind: "none",
            },
      ...(typeof timeoutMs === "number"
        ? {
            defaults: {
              timeout_ms: timeoutMs,
            },
          }
        : {}),
    });
  }

  return {
    backends,
  };
}

function getAlertWindow(window?: Window) {
  if (window && typeof window.alert === "function") {
    return window;
  }
  return ztoolkit.getGlobal("window") as Window | undefined;
}

export async function openBackendManagerDialog(args?: { window?: Window }) {
  if (isWindowAlive(addon.data.dialog?.window)) {
    addon.data.dialog?.window?.focus();
    return;
  }

  const alertWindow = getAlertWindow(args?.window);
  const loaded = await loadBackendsRegistry();
  const initialRows = loaded.fatalError
    ? [buildFallbackBackendRow()]
    : loaded.backends.map((entry) => normalizeRowFromBackend(entry));

  if (loaded.fatalError) {
    alertWindow?.alert?.(
      getString("backend-manager-error-invalid-config" as any, {
        args: { error: loaded.fatalError },
      }),
    );
  }

  const dialogData: Record<string, unknown> = {
    loadCallback: () => {
      const doc = addon.data.dialog?.window?.document;
      if (!doc) {
        return;
      }
      const root = doc.getElementById("zs-backend-manager-root") as
        | HTMLElement
        | null;
      if (!root) {
        return;
      }

      ensureTableSkeleton(doc, root);
      const bodies = Array.from(
        doc.querySelectorAll("[data-zs-backend-body='1'][data-zs-provider-type]"),
      ) as HTMLElement[];
      const bodyMap = new Map<string, HTMLElement>();
      bodies.forEach((body) => {
        const type = String(body.getAttribute("data-zs-provider-type") || "").trim();
        if (type) {
          bodyMap.set(type, body);
        }
      });

      initialRows.forEach((backend) => {
        const tbody = bodyMap.get(backend.type);
        if (!tbody) {
          return;
        }
        appendBackendRow({
          tbody,
          backend,
        });
      });

      const addButtons = Array.from(
        doc.querySelectorAll(
          "[data-zs-backend-action='add'][data-zs-provider-type]",
        ),
      ) as HTMLButtonElement[];
      addButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const providerType = String(
            button.getAttribute("data-zs-provider-type") || "",
          ).trim();
          const tbody = bodyMap.get(providerType);
          if (!tbody) {
            return;
          }
          appendBackendRow({
            tbody,
            backend: {
              id: "",
              type: providerType,
              baseUrl: "",
              authKind: "none",
              authToken: "",
              timeoutMs: "",
            },
          });
        });
      });
    },
    unloadCallback: () => {},
  };

  const dialogHelper = new ztoolkit.Dialog(1, 1)
    .addCell(0, 0, {
      tag: "div",
      namespace: "html",
      id: "zs-backend-manager-root",
      styles: {
        padding: "6px",
      },
    })
    .addButton(getString("backend-manager-save" as any), "save")
    .addButton(getString("backend-manager-cancel" as any), "cancel")
    .setDialogData(dialogData)
    .open(getString("backend-manager-title" as any));

  addon.data.dialog = dialogHelper;
  await (dialogData as { unloadLock?: { promise?: Promise<void> } }).unloadLock
    ?.promise;
  addon.data.dialog = undefined;

  if ((dialogData as { _lastButtonId?: string })._lastButtonId !== "save") {
    return;
  }

  try {
    const doc = dialogHelper.window?.document;
    if (!doc) {
      throw new Error(getString("backend-manager-error-window-unavailable" as any));
    }
    const collected = collectBackendsFromDialog(doc);
    setPref(
      BACKENDS_CONFIG_PREF_KEY,
      JSON.stringify({
        backends: collected.backends,
      }),
    );
    refreshWorkflowMenus();
    alertWindow?.alert?.(getString("backend-manager-saved" as any));
  } catch (error) {
    alertWindow?.alert?.(
      getString("backend-manager-save-failed" as any, {
        args: { error: String(error) },
      }),
    );
  }
}
