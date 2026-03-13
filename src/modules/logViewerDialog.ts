import type { DialogHelper } from "zotero-plugin-toolkit";
import { getString } from "../utils/locale";
import { resolveToolkitMember } from "../utils/runtimeBridge";
import { isWindowAlive } from "../utils/window";
import {
  buildRuntimeDiagnosticBundle,
  buildRuntimeIssueSummary,
  clearRuntimeLogs,
  formatRuntimeLogsAsNDJSON,
  formatRuntimeLogsAsPrettyJson,
  getRuntimeLogDiagnosticMode,
  listRuntimeLogs,
  setRuntimeLogDiagnosticMode,
  snapshotRuntimeLogs,
  subscribeRuntimeLogs,
  type RuntimeLogEntry,
  type RuntimeLogLevel,
  type RuntimeLogListFilters,
} from "./runtimeLogManager";

const HTML_NS = "http://www.w3.org/1999/xhtml";
const ALL_LEVELS: RuntimeLogLevel[] = ["debug", "info", "warn", "error"];

type LevelFilterState = Record<RuntimeLogLevel, boolean>;
type DialogCtor = new (rows: number, columns: number) => DialogHelper;

let logViewerDialog: DialogHelper | undefined;

export type LogViewerOpenArgs = {
  initialFilters?: Pick<
    RuntimeLogListFilters,
    "workflowId" | "requestId" | "jobId" | "backendId" | "backendType" | "runId"
  >;
  focusDiagnostic?: boolean;
};

function createHtmlElement<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
) {
  return doc.createElementNS(HTML_NS, tag) as HTMLElementTagNameMap[K];
}

function clearChildren(node: Element) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function resolveClipboardCtor() {
  return resolveToolkitMember<
    | (new () => { addText: (text: string, mime: string) => unknown; copy: () => unknown })
    | undefined
  >("Clipboard");
}

function copyText(text: string) {
  const Clipboard = resolveClipboardCtor();
  if (Clipboard) {
    const helper = new Clipboard() as {
      addText: (payload: string, mime: string) => { copy?: () => unknown } | void;
      copy?: () => unknown;
    };
    const chained = helper.addText(text, "text/unicode");
    if (chained && typeof chained.copy === "function") {
      chained.copy();
      return;
    }
    if (typeof helper.copy === "function") {
      helper.copy();
      return;
    }
    return;
  }
  try {
    const helper = (Components as any).classes?.["@mozilla.org/widget/clipboardhelper;1"]?.getService(
      Components.interfaces.nsIClipboardHelper,
    ) as { copyString?: (value: string) => void };
    if (helper?.copyString) {
      helper.copyString(text);
      return;
    }
  } catch {
    // ignore and throw below
  }
  throw new Error("clipboard unavailable");
}

function defaultFilterState(): LevelFilterState {
  return {
    debug: true,
    info: true,
    warn: true,
    error: true,
  };
}

export function createDefaultLogViewerLevelFilter() {
  return defaultFilterState();
}

function buildActiveLevels(levelFilter: LevelFilterState) {
  return ALL_LEVELS.filter((level) => levelFilter[level]);
}

export function filterLogsByLevels(
  entries: RuntimeLogEntry[],
  levelFilter: LevelFilterState,
) {
  const active = new Set(buildActiveLevels(levelFilter));
  return entries.filter((entry) => active.has(entry.level));
}

function formatCopyPayload(args: {
  entries: RuntimeLogEntry[];
  format: "pretty-json" | "ndjson";
}) {
  if (args.format === "ndjson") {
    return formatRuntimeLogsAsNDJSON(args.entries);
  }
  return formatRuntimeLogsAsPrettyJson(args.entries);
}

export function buildLogCopyPayload(args: {
  entries: RuntimeLogEntry[];
  format?: "pretty-json" | "ndjson";
}) {
  return formatCopyPayload({
    entries: args.entries,
    format: args.format || "pretty-json",
  });
}

function renderLogRows(args: {
  container: HTMLElement;
  entries: RuntimeLogEntry[];
  selectedEntryId: string;
  onSelect: (id: string) => void;
}) {
  const { container, entries, selectedEntryId, onSelect } = args;
  const doc = container.ownerDocument;
  if (!doc) {
    return;
  }
  clearChildren(container);
  if (entries.length === 0) {
    const empty = createHtmlElement(doc, "p");
    empty.textContent = getString("log-viewer-empty" as any);
    empty.style.margin = "8px 0";
    empty.style.color = "#666";
    container.appendChild(empty);
    return;
  }

  const table = createHtmlElement(doc, "table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.tableLayout = "fixed";

  const thead = createHtmlElement(doc, "thead");
  const tr = createHtmlElement(doc, "tr");
  const headers = [
    getString("log-viewer-column-time" as any),
    getString("log-viewer-column-level" as any),
    getString("log-viewer-column-scope" as any),
    getString("log-viewer-column-stage" as any),
    getString("log-viewer-column-message" as any),
  ];
  const widths = ["180px", "70px", "120px", "120px", "auto"];
  for (let i = 0; i < headers.length; i++) {
    const th = createHtmlElement(doc, "th");
    th.textContent = headers[i];
    th.style.textAlign = "left";
    th.style.padding = "6px";
    th.style.borderBottom = "1px solid #d0d0d0";
    th.style.width = widths[i];
    th.style.fontSize = "12px";
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = createHtmlElement(doc, "tbody");
  for (const entry of entries) {
    const row = createHtmlElement(doc, "tr");
    row.style.cursor = "pointer";
    if (selectedEntryId === entry.id) {
      row.style.backgroundColor = "#eef4ff";
    }
    row.addEventListener("click", () => onSelect(entry.id));

    const cells = [entry.ts, entry.level, entry.scope, entry.stage, entry.message];
    for (const value of cells) {
      const td = createHtmlElement(doc, "td");
      td.textContent = String(value || "");
      td.style.padding = "6px";
      td.style.borderBottom = "1px solid #f0f0f0";
      td.style.wordBreak = "break-word";
      td.style.verticalAlign = "top";
      td.style.fontSize = "12px";
      row.appendChild(td);
    }
    tbody.appendChild(row);

    const detailRow = createHtmlElement(doc, "tr");
    const detailCell = createHtmlElement(doc, "td");
    detailCell.colSpan = 5;
    detailCell.style.padding = "0 6px 8px";
    detailCell.style.borderBottom = "1px solid #f5f5f5";

    const details = createHtmlElement(doc, "details");
    const summary = createHtmlElement(doc, "summary");
    summary.textContent = getString("log-viewer-details" as any);
    summary.style.cursor = "pointer";
    summary.style.fontSize = "12px";
    details.appendChild(summary);

    const pre = createHtmlElement(doc, "pre");
    pre.style.margin = "6px 0 0";
    pre.style.maxHeight = "200px";
    pre.style.overflow = "auto";
    pre.style.background = "#fafafa";
    pre.style.border = "1px solid #eee";
    pre.style.padding = "6px";
    pre.style.fontSize = "11px";
    pre.textContent = JSON.stringify(entry, null, 2);
    details.appendChild(pre);

    detailCell.appendChild(details);
    detailRow.appendChild(detailCell);
    tbody.appendChild(detailRow);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

export async function openLogViewerDialog() {
  return openLogViewerDialogWithArgs();
}

function buildContextFiltersFromArgs(args?: LogViewerOpenArgs) {
  const source = args?.initialFilters;
  const normalized: RuntimeLogListFilters = {};
  if (!source) {
    return normalized;
  }
  const assign = (
    key: "workflowId" | "requestId" | "jobId" | "backendId" | "backendType" | "runId",
    value: unknown,
  ) => {
    const text = String(value || "").trim();
    if (text) {
      normalized[key] = text;
    }
  };
  assign("workflowId", source.workflowId);
  assign("requestId", source.requestId);
  assign("jobId", source.jobId);
  assign("backendId", source.backendId);
  assign("backendType", source.backendType);
  assign("runId", source.runId);
  return normalized;
}

function hasAnyContextFilter(filters: RuntimeLogListFilters) {
  return Boolean(
    filters.workflowId ||
      filters.requestId ||
      filters.jobId ||
      filters.backendId ||
      filters.backendType ||
      filters.runId,
  );
}

function formatContextFilterLabel(filters: RuntimeLogListFilters) {
  const pairs: string[] = [];
  if (filters.backendId) {
    pairs.push(`backend=${filters.backendId}`);
  }
  if (filters.backendType) {
    pairs.push(`backendType=${filters.backendType}`);
  }
  if (filters.workflowId) {
    pairs.push(`workflow=${filters.workflowId}`);
  }
  if (filters.runId) {
    pairs.push(`run=${filters.runId}`);
  }
  if (filters.requestId) {
    pairs.push(`request=${filters.requestId}`);
  }
  if (filters.jobId) {
    pairs.push(`job=${filters.jobId}`);
  }
  return pairs.join(", ");
}

export async function openLogViewerDialogWithArgs(args?: LogViewerOpenArgs) {
  if (isWindowAlive(logViewerDialog?.window)) {
    logViewerDialog?.window?.focus();
    return;
  }
  const Dialog = resolveToolkitMember<DialogCtor>("Dialog");
  if (!Dialog) {
    throw new Error("log viewer dialog is unavailable");
  }

  let selectedEntryId = "";
  let levelFilter = defaultFilterState();
  let contextFilters = buildContextFiltersFromArgs(args);
  let diagnosticMode = getRuntimeLogDiagnosticMode();
  let unsubscribe: (() => void) | undefined;
  const dialogData: Record<string, unknown> = {
    loadCallback: () => {
      const doc = logViewerDialog?.window?.document;
      if (!doc) {
        return;
      }
      const root = doc.getElementById("zs-log-viewer-root") as HTMLElement | null;
      if (!root) {
        return;
      }
      root.style.minWidth = "1100px";
      root.style.minHeight = "700px";
      root.style.maxWidth = "1400px";
      root.style.maxHeight = "900px";
      root.style.overflow = "hidden";
      root.style.display = "flex";
      root.style.flexDirection = "column";
      root.style.boxSizing = "border-box";

      const windowObject = doc.defaultView;
      if (windowObject) {
        try {
          windowObject.resizeTo(1200, 780);
        } catch {
          // ignore
        }
      }

      clearChildren(root);

      const toolbar = createHtmlElement(doc, "div");
      toolbar.style.display = "flex";
      toolbar.style.flexWrap = "wrap";
      toolbar.style.gap = "8px";
      toolbar.style.alignItems = "center";
      toolbar.style.marginBottom = "8px";
      root.appendChild(toolbar);

      const stats = createHtmlElement(doc, "span");
      stats.id = "zs-log-viewer-stats";
      stats.style.fontSize = "12px";
      stats.style.color = "#444";
      stats.style.marginRight = "12px";
      toolbar.appendChild(stats);

      const truncationNotice = createHtmlElement(doc, "span");
      truncationNotice.id = "zs-log-viewer-truncation";
      truncationNotice.style.fontSize = "12px";
      truncationNotice.style.color = "#b45309";
      truncationNotice.style.marginRight = "12px";
      toolbar.appendChild(truncationNotice);

      const budgetNotice = createHtmlElement(doc, "span");
      budgetNotice.id = "zs-log-viewer-budget";
      budgetNotice.style.fontSize = "12px";
      budgetNotice.style.color = "#1d4ed8";
      budgetNotice.style.marginRight = "12px";
      toolbar.appendChild(budgetNotice);

      const levelLabel = createHtmlElement(doc, "span");
      levelLabel.textContent = getString("log-viewer-level-filter-label" as any);
      levelLabel.style.fontSize = "12px";
      levelLabel.style.fontWeight = "600";
      toolbar.appendChild(levelLabel);

      const diagWrap = createHtmlElement(doc, "label");
      diagWrap.style.display = "inline-flex";
      diagWrap.style.alignItems = "center";
      diagWrap.style.gap = "4px";
      const diagInput = createHtmlElement(doc, "input");
      diagInput.type = "checkbox";
      diagInput.checked = diagnosticMode;
      diagInput.addEventListener("change", () => {
        diagnosticMode = diagInput.checked;
        setRuntimeLogDiagnosticMode(diagnosticMode);
        render();
      });
      diagWrap.appendChild(diagInput);
      const diagText = createHtmlElement(doc, "span");
      diagText.textContent = getString("log-viewer-diagnostic-mode" as any);
      diagText.style.fontSize = "12px";
      diagWrap.appendChild(diagText);
      toolbar.appendChild(diagWrap);

      for (const level of ALL_LEVELS) {
        const wrap = createHtmlElement(doc, "label");
        wrap.style.display = "inline-flex";
        wrap.style.alignItems = "center";
        wrap.style.gap = "4px";
        const input = createHtmlElement(doc, "input");
        input.type = "checkbox";
        input.checked = levelFilter[level];
        input.addEventListener("change", () => {
          levelFilter = {
            ...levelFilter,
            [level]: input.checked,
          };
          render();
        });
        wrap.appendChild(input);
        const text = createHtmlElement(doc, "span");
        text.textContent = level;
        text.style.fontSize = "12px";
        wrap.appendChild(text);
        toolbar.appendChild(wrap);
      }

      const actionBar = createHtmlElement(doc, "div");
      actionBar.style.display = "flex";
      actionBar.style.flexWrap = "wrap";
      actionBar.style.gap = "8px";
      actionBar.style.marginBottom = "8px";
      root.appendChild(actionBar);

      const contextBar = createHtmlElement(doc, "div");
      contextBar.style.display = "flex";
      contextBar.style.flexWrap = "wrap";
      contextBar.style.gap = "8px";
      contextBar.style.marginBottom = "8px";
      root.appendChild(contextBar);

      const contextLabel = createHtmlElement(doc, "span");
      contextLabel.style.fontSize = "12px";
      contextLabel.style.color = "#334155";
      contextBar.appendChild(contextLabel);

      const clearContextBtn = createHtmlElement(doc, "button");
      clearContextBtn.type = "button";
      clearContextBtn.textContent = getString("log-viewer-clear-context-filter" as any);
      clearContextBtn.addEventListener("click", () => {
        contextFilters = {};
        render();
      });
      contextBar.appendChild(clearContextBtn);

      const sanitizerHint = createHtmlElement(doc, "span");
      sanitizerHint.style.fontSize = "12px";
      sanitizerHint.style.color = "#475569";
      sanitizerHint.textContent = getString("log-viewer-sanitization-hint" as any);
      contextBar.appendChild(sanitizerHint);

      const status = createHtmlElement(doc, "span");
      status.style.fontSize = "12px";
      status.style.color = "#166534";
      status.style.marginLeft = "8px";

      const rows = createHtmlElement(doc, "div");
      rows.id = "zs-log-viewer-rows";
      rows.style.flex = "1";
      rows.style.minHeight = "0";
      rows.style.overflow = "auto";
      rows.style.border = "1px solid #ddd";
      rows.style.padding = "6px";
      root.appendChild(rows);

      const setStatus = (message: string, isError = false) => {
        status.textContent = message;
        status.style.color = isError ? "#b91c1c" : "#166534";
      };

      const getVisibleEntries = () =>
        filterLogsByLevels(
          listRuntimeLogs({
            ...contextFilters,
            order: "desc",
          }),
          levelFilter,
        );

      const copyEntries = (entriesToCopy: RuntimeLogEntry[], format: "pretty-json" | "ndjson") => {
        if (entriesToCopy.length === 0) {
          setStatus(getString("log-viewer-copy-empty" as any), true);
          return;
        }
        try {
          const payload = buildLogCopyPayload({
            entries: entriesToCopy,
            format,
          });
          copyText(payload);
          setStatus(
            getString("log-viewer-copy-success" as any, {
              args: { count: entriesToCopy.length },
            }),
          );
        } catch (error) {
          setStatus(
            getString("log-viewer-copy-failed" as any, {
              args: { error: String(error) },
            }),
            true,
          );
        }
      };

      const addAction = (label: string, onClick: () => void) => {
        const button = createHtmlElement(doc, "button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", onClick);
        actionBar.appendChild(button);
      };

      addAction(getString("log-viewer-copy-selected" as any), () => {
        const visible = getVisibleEntries();
        const selected = visible.find((entry) => entry.id === selectedEntryId);
        copyEntries(selected ? [selected] : [], "pretty-json");
      });
      addAction(getString("log-viewer-copy-visible" as any), () => {
        copyEntries(getVisibleEntries(), "pretty-json");
      });
      addAction(getString("log-viewer-copy-all" as any), () => {
        copyEntries(listRuntimeLogs({ order: "desc" }), "pretty-json");
      });
      addAction(getString("log-viewer-copy-visible-ndjson" as any), () => {
        copyEntries(getVisibleEntries(), "ndjson");
      });
      addAction(getString("log-viewer-copy-diagnostic-bundle" as any), () => {
        try {
          const bundle = buildRuntimeDiagnosticBundle({
            filters: {
              ...contextFilters,
              levels: buildActiveLevels(levelFilter),
            },
          });
          copyText(JSON.stringify(bundle, null, 2));
          setStatus(
            getString("log-viewer-copy-diagnostic-success" as any, {
              args: {
                count: bundle.entries.length,
              },
            }),
          );
        } catch (error) {
          setStatus(
            getString("log-viewer-copy-failed" as any, {
              args: { error: String(error) },
            }),
            true,
          );
        }
      });
      addAction(getString("log-viewer-copy-issue-summary" as any), () => {
        try {
          const summary = buildRuntimeIssueSummary({
            filters: {
              ...contextFilters,
              levels: buildActiveLevels(levelFilter),
            },
          });
          copyText(summary);
          setStatus(getString("log-viewer-copy-issue-summary-success" as any));
        } catch (error) {
          setStatus(
            getString("log-viewer-copy-failed" as any, {
              args: { error: String(error) },
            }),
            true,
          );
        }
      });
      addAction(getString("log-viewer-clear" as any), () => {
        clearRuntimeLogs();
        selectedEntryId = "";
      });
      actionBar.appendChild(status);

      const render = () => {
        const snapshot = snapshotRuntimeLogs();
        diagnosticMode = snapshot.diagnosticMode;
        diagInput.checked = diagnosticMode;
        const visible = filterLogsByLevels(
          listRuntimeLogs({
            ...contextFilters,
            order: "desc",
          }),
          levelFilter,
        );
        if (!visible.some((entry) => entry.id === selectedEntryId)) {
          selectedEntryId = visible[0]?.id || "";
        }
        stats.textContent = getString("log-viewer-stats" as any, {
          args: {
            visible: visible.length,
            total: snapshot.entries.length,
          },
        });
        if (snapshot.droppedEntries > 0) {
          truncationNotice.textContent = getString("log-viewer-truncated" as any, {
            args: {
              dropped: snapshot.droppedEntries,
              maxEntries: snapshot.maxEntries,
            },
          });
        } else {
          truncationNotice.textContent = "";
        }
        const budgetBits = [
          `mode=${snapshot.retentionMode}`,
          `bytes=${snapshot.estimatedBytes}/${snapshot.maxBytes || "∞"}`,
        ];
        if (snapshot.droppedByReason.entry_limit > 0) {
          budgetBits.push(`entry_limit=${snapshot.droppedByReason.entry_limit}`);
        }
        if (snapshot.droppedByReason.byte_budget > 0) {
          budgetBits.push(`byte_budget=${snapshot.droppedByReason.byte_budget}`);
        }
        if (snapshot.droppedByReason.expired > 0) {
          budgetBits.push(`expired=${snapshot.droppedByReason.expired}`);
        }
        budgetNotice.textContent = getString("log-viewer-budget" as any, {
          args: {
            value: budgetBits.join(", "),
          },
        });
        if (hasAnyContextFilter(contextFilters)) {
          contextLabel.textContent = getString("log-viewer-context-filter" as any, {
            args: {
              filter: formatContextFilterLabel(contextFilters),
            },
          });
          clearContextBtn.style.display = "";
        } else {
          contextLabel.textContent = getString("log-viewer-context-filter-none" as any);
          clearContextBtn.style.display = "none";
        }

        renderLogRows({
          container: rows,
          entries: visible,
          selectedEntryId,
          onSelect: (id) => {
            selectedEntryId = id;
            render();
          },
        });
      };

      render();
      if (args?.focusDiagnostic) {
        setStatus(getString("log-viewer-diagnostic-focus" as any));
      }
      unsubscribe = subscribeRuntimeLogs(() => {
        render();
      });
    },
    unloadCallback: () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = undefined;
      }
    },
  };

  logViewerDialog = new Dialog(1, 1)
    .addCell(0, 0, {
      tag: "div",
      namespace: "html",
      id: "zs-log-viewer-root",
      styles: {
        padding: "8px",
      },
    })
    .addButton(getString("log-viewer-close" as any), "close")
    .setDialogData(dialogData)
    .open(getString("log-viewer-title" as any));

  await (dialogData as { unloadLock?: { promise?: Promise<void> } }).unloadLock
    ?.promise;
  logViewerDialog = undefined;
}
