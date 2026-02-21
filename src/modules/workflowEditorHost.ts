import { resolveToolkitMember } from "../utils/runtimeBridge";

const HTML_NS = "http://www.w3.org/1999/xhtml";
const ROOT_ID = "zs-workflow-editor-root";
const GLOBAL_OPEN_KEY = "__zsWorkflowEditorHostOpen";
const GLOBAL_REGISTER_KEY = "__zsWorkflowEditorHostRegisterRenderer";
const GLOBAL_UNREGISTER_KEY = "__zsWorkflowEditorHostUnregisterRenderer";

type WorkflowEditorLayout = {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  padding?: number;
};

type WorkflowEditorLabels = {
  save?: string;
  cancel?: string;
};

type WorkflowEditorRenderArgs<TState = unknown, TContext = unknown> = {
  doc: Document;
  root: HTMLElement;
  state: TState;
  context?: TContext;
  host: {
    rerender: () => void;
    patchState: (updater: (state: TState) => void) => void;
  };
};

export type WorkflowEditorRenderer<TState = unknown, TContext = unknown> = {
  render: (args: WorkflowEditorRenderArgs<TState, TContext>) => void;
  serialize?: (args: { state: TState; context?: TContext }) => unknown;
};

export type WorkflowEditorOpenArgs<TState = unknown, TContext = unknown> = {
  rendererId: string;
  title: string;
  initialState: TState;
  context?: TContext;
  renderer?: WorkflowEditorRenderer<TState, TContext>;
  layout?: WorkflowEditorLayout;
  labels?: WorkflowEditorLabels;
};

export type WorkflowEditorOpenResult = {
  saved: boolean;
  result?: unknown;
  reason?: string;
};

type WorkflowEditorBridge = {
  open: (args: WorkflowEditorOpenArgs) => Promise<WorkflowEditorOpenResult>;
  registerRenderer: (
    rendererId: string,
    renderer: WorkflowEditorRenderer,
  ) => void;
  unregisterRenderer: (rendererId: string) => void;
};

type DialogCtor = new (rows: number, columns: number) => {
  addCell: (...args: unknown[]) => any;
  addButton: (...args: unknown[]) => any;
  setDialogData: (data: Record<string, unknown>) => any;
  open: (title: string) => unknown;
};

const rendererRegistry = new Map<string, WorkflowEditorRenderer>();
let sessionQueue: Promise<void> = Promise.resolve();

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

function cloneSerializable<T>(value: T): T {
  if (typeof value === "undefined") {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveDialogCtor() {
  return resolveToolkitMember<DialogCtor>("Dialog");
}

function serializeEditorResult(args: {
  renderer: WorkflowEditorRenderer;
  state: unknown;
  context: unknown;
}) {
  return typeof args.renderer.serialize === "function"
    ? args.renderer.serialize({
        state: args.state,
        context: args.context,
      })
    : cloneSerializable(args.state);
}

function toComparableSnapshot(value: unknown) {
  try {
    const encoded = JSON.stringify(value);
    if (typeof encoded === "string") {
      return encoded;
    }
    return `__primitive__:${String(encoded)}`;
  } catch {
    return null;
  }
}

function hasUnsavedChanges(args: {
  renderer: WorkflowEditorRenderer;
  state: unknown;
  context: unknown;
  initialSnapshot: string | null;
}) {
  if (args.initialSnapshot === null) {
    return true;
  }
  let currentResult: unknown;
  try {
    currentResult = serializeEditorResult({
      renderer: args.renderer,
      state: args.state,
      context: args.context,
    });
  } catch {
    return true;
  }
  const currentSnapshot = toComparableSnapshot(currentResult);
  if (currentSnapshot === null) {
    return true;
  }
  return currentSnapshot !== args.initialSnapshot;
}

function resolveDirtyCloseDecision(args: {
  win: _ZoteroTypes.MainWindow | null;
  title: string;
  message: string;
  saveLabel: string;
  discardLabel: string;
  cancelLabel: string;
}) {
  const runtime = globalThis as {
    Zotero?: {
      Prompt?: {
        BUTTON_TITLE_SAVE?: number;
        BUTTON_TITLE_DONT_SAVE?: number;
        BUTTON_TITLE_CANCEL?: number;
        confirm?: (args: {
          window?: _ZoteroTypes.MainWindow | null;
          title: string;
          text: string;
          button0: string | number;
          button1: string | number;
          button2?: string | number;
          defaultButton: number;
        }) => number;
      };
    };
  };
  try {
    const prompt = runtime.Zotero?.Prompt;
    if (prompt && typeof prompt.confirm === "function") {
      const clicked = prompt.confirm({
        window: args.win || null,
        title: args.title,
        text: args.message,
        button0: prompt.BUTTON_TITLE_SAVE ?? args.saveLabel,
        button1: prompt.BUTTON_TITLE_DONT_SAVE ?? args.discardLabel,
        button2: prompt.BUTTON_TITLE_CANCEL ?? args.cancelLabel,
        defaultButton: 0,
      });
      if (clicked === 0) {
        return "save" as const;
      }
      if (clicked === 1) {
        return "discard" as const;
      }
      return "cancel" as const;
    }
  } catch {
    // ignore and fallback to window.confirm
  }
  if (args.win && typeof args.win.confirm === "function") {
    if (args.win.confirm(`${args.title}\n\n${args.message}`)) {
      return "save" as const;
    }
    if (
      args.win.confirm(
        `${args.title}\n\nDiscard changes and close?\n\n(OK = Discard, Cancel = Keep Editing)`,
      )
    ) {
      return "discard" as const;
    }
    return "cancel" as const;
  }
  return "cancel" as const;
}

function normalizeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, parsed);
}

function normalizeLayout(layout?: WorkflowEditorLayout) {
  const width = normalizeNumber(layout?.width, 1100);
  const height = normalizeNumber(layout?.height, 760);
  const minWidth = normalizeNumber(layout?.minWidth, 940);
  const minHeight = normalizeNumber(layout?.minHeight, 620);
  const maxWidth = normalizeNumber(layout?.maxWidth, 1500);
  const maxHeight = normalizeNumber(layout?.maxHeight, 1080);
  const padding = normalizeNumber(layout?.padding, 8);
  return {
    width: Math.min(Math.max(width, minWidth), maxWidth),
    height: Math.min(Math.max(height, minHeight), maxHeight),
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    padding,
  };
}

function applyWindowSizing(doc: Document, layout: ReturnType<typeof normalizeLayout>) {
  const win = doc.defaultView;
  if (win) {
    try {
      win.resizeTo(layout.width, layout.height);
    } catch {
      // ignore window manager restrictions
    }
  }
}

function resolveRenderer(args: WorkflowEditorOpenArgs) {
  const rendererId = String(args.rendererId || "").trim();
  if (!rendererId) {
    throw new Error("workflow editor requires rendererId");
  }
  if (args.renderer) {
    rendererRegistry.set(rendererId, args.renderer as WorkflowEditorRenderer);
  }
  const renderer = rendererRegistry.get(rendererId);
  if (!renderer) {
    throw new Error(`workflow editor renderer not found: ${rendererId}`);
  }
  return renderer;
}

async function openDialogSession(
  args: WorkflowEditorOpenArgs,
): Promise<WorkflowEditorOpenResult> {
  const renderer = resolveRenderer(args);
  const Dialog = resolveDialogCtor();
  if (!Dialog) {
    throw new Error("workflow editor dialog is unavailable");
  }

  const layout = normalizeLayout(args.layout);
  const labels = {
    save: String(args.labels?.save || "Save"),
    cancel: String(args.labels?.cancel || "Cancel"),
  };

  const state = cloneSerializable(args.initialState);
  const context = cloneSerializable(args.context);
  let initialSnapshot: string | null = null;
  try {
    initialSnapshot = toComparableSnapshot(
      serializeEditorResult({
        renderer,
        state,
        context,
      }),
    );
  } catch {
    initialSnapshot = null;
  }

  const dialogData: Record<string, unknown> = {
    loadCallback: () => {
      const doc = addon.data.dialog?.window?.document;
      if (!doc) {
        return;
      }
      const root = doc.getElementById(ROOT_ID);
      if (!root) {
        return;
      }

      applyWindowSizing(doc, layout);

      const host = {
        rerender: () => {
          clearChildren(root);
          renderer.render({
            doc,
            root: root as HTMLElement,
            state,
            context,
            host,
          });
        },
        patchState: (updater: (target: unknown) => void) => {
          updater(state);
          host.rerender();
        },
      };

      (root as HTMLElement).style.width = `${layout.width - 80}px`;
      (root as HTMLElement).style.maxWidth = `${layout.maxWidth - 80}px`;
      (root as HTMLElement).style.minWidth = `${layout.minWidth - 80}px`;
      (root as HTMLElement).style.minHeight = `${layout.minHeight - 120}px`;
      (root as HTMLElement).style.maxHeight = `${layout.maxHeight - 120}px`;
      (root as HTMLElement).style.boxSizing = "border-box";
      (root as HTMLElement).style.padding = `${layout.padding}px`;
      // Keep popups from native controls (e.g., <select>) usable inside editor renderers.
      (root as HTMLElement).style.overflow = "visible";

      host.rerender();
    },
    unloadCallback: () => {},
  };

  let dialogWindow: _ZoteroTypes.MainWindow | null = null;
  const closeDialogWith = (buttonId: "save" | "cancel" | "discard") => {
    (dialogData as { _lastButtonId?: string })._lastButtonId = buttonId;
    dialogWindow?.close?.();
  };
  const handleAttemptClose = () => {
    const dirty = hasUnsavedChanges({
      renderer,
      state,
      context,
      initialSnapshot,
    });
    if (!dirty) {
      closeDialogWith("cancel");
      return;
    }
    const action = resolveDirtyCloseDecision({
      win: dialogWindow,
      title: String(args.title || "Workflow Editor"),
      message: "You have unsaved changes. Save before closing?",
      saveLabel: labels.save,
      discardLabel: "Don't Save",
      cancelLabel: "Cancel",
    });
    if (action === "save") {
      closeDialogWith("save");
      return;
    }
    if (action === "discard") {
      closeDialogWith("discard");
      return;
    }
  };

  const dialog = new Dialog(1, 1)
    .addCell(0, 0, {
      tag: "div",
      namespace: "html",
      id: ROOT_ID,
      styles: {
        padding: "0px",
      },
    })
    .addButton(labels.save, "save")
    .addButton(labels.cancel, "cancel", {
      noClose: true,
      callback: () => {
        handleAttemptClose();
      },
    })
    .setDialogData(dialogData)
    .open(String(args.title || "Workflow Editor"));
  dialogWindow = (dialog as { window?: _ZoteroTypes.MainWindow }).window || null;

  addon.data.dialog = dialog as typeof addon.data.dialog;
  await (dialogData as { unloadLock?: { promise?: Promise<void> } }).unloadLock
    ?.promise;
  addon.data.dialog = undefined;

  const clicked = String(
    (dialogData as { _lastButtonId?: string })._lastButtonId || "",
  ).trim();
  if (clicked === "discard") {
    return {
      saved: false,
      reason: "discarded",
    };
  }
  if (clicked !== "save") {
    return {
      saved: false,
      reason: "canceled",
    };
  }
  const result = serializeEditorResult({
    renderer,
    state,
    context,
  });
  return {
    saved: true,
    result,
  };
}

function enqueueSession<T>(task: () => Promise<T>) {
  const run = sessionQueue.then(task, task);
  sessionQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function openWorkflowEditorSession(args: WorkflowEditorOpenArgs) {
  return enqueueSession(() => openDialogSession(args));
}

export function registerWorkflowEditorRenderer(
  rendererId: string,
  renderer: WorkflowEditorRenderer,
) {
  const normalizedId = String(rendererId || "").trim();
  if (!normalizedId) {
    throw new Error("rendererId is required");
  }
  rendererRegistry.set(normalizedId, renderer);
}

export function unregisterWorkflowEditorRenderer(rendererId: string) {
  const normalizedId = String(rendererId || "").trim();
  if (!normalizedId) {
    return;
  }
  rendererRegistry.delete(normalizedId);
}

export function installWorkflowEditorHostBridge() {
  const runtime = globalThis as {
    [GLOBAL_OPEN_KEY]?: (
      args: WorkflowEditorOpenArgs,
    ) => Promise<WorkflowEditorOpenResult>;
    [GLOBAL_REGISTER_KEY]?: (
      rendererId: string,
      renderer: WorkflowEditorRenderer,
    ) => void;
    [GLOBAL_UNREGISTER_KEY]?: (rendererId: string) => void;
  };

  runtime[GLOBAL_OPEN_KEY] = (args: WorkflowEditorOpenArgs) =>
    openWorkflowEditorSession(args);
  runtime[GLOBAL_REGISTER_KEY] = (
    rendererId: string,
    renderer: WorkflowEditorRenderer,
  ) => registerWorkflowEditorRenderer(rendererId, renderer);
  runtime[GLOBAL_UNREGISTER_KEY] = (rendererId: string) =>
    unregisterWorkflowEditorRenderer(rendererId);

  const addonData = addon.data as typeof addon.data & {
    workflowEditorHost?: WorkflowEditorBridge;
  };
  addonData.workflowEditorHost = {
    open: runtime[GLOBAL_OPEN_KEY],
    registerRenderer: runtime[GLOBAL_REGISTER_KEY],
    unregisterRenderer: runtime[GLOBAL_UNREGISTER_KEY],
  };
}

export function clearWorkflowEditorRendererRegistry() {
  rendererRegistry.clear();
}

export function createWorkflowEditorPanelContainer(doc: Document) {
  const panel = createHtmlElement(doc, "div");
  panel.style.width = "100%";
  panel.style.height = "100%";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.overflow = "hidden";
  panel.style.boxSizing = "border-box";
  return panel;
}
