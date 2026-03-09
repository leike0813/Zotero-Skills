import type { DialogHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import type { BackendInstance } from "../backends/types";
import { getString } from "../utils/locale";
import { resolveAddonRef } from "../utils/runtimeBridge";
import { isWindowAlive } from "../utils/window";
import {
  type SkillRunnerManagementChatHistoryPayload,
  type SkillRunnerManagementPending,
  type SkillRunnerManagementRunState,
  type SkillRunnerManagementSseFrame,
} from "../providers/skillrunner/managementClient";
import { buildSkillRunnerManagementClient } from "./skillRunnerManagementClientFactory";

type SkillRunnerConversationEntry = {
  seq: number;
  ts?: string;
  text: string;
  raw: unknown;
};

type RunSessionState = {
  requestId: string;
  status: string;
  updatedAt?: string;
  pending?: SkillRunnerManagementPending;
  messages: SkillRunnerConversationEntry[];
  lastSeq: number;
  error?: string;
  loading: boolean;
};

type RunDialogSnapshot = {
  title: string;
  backendTitle: string;
  requestId: string;
  status: string;
  updatedAt?: string;
  pendingOwner?: string;
  pendingInteractionId?: number;
  pendingPrompt?: string;
  loading: boolean;
  error?: string;
  messages: Array<{ seq: number; ts?: string; text: string }>;
  labels: {
    requestId: string;
    status: string;
    updatedAt: string;
    pendingOwner: string;
    pendingInteractionId: string;
    loading: string;
    error: string;
    replyPlaceholder: string;
    reply: string;
    cancel: string;
    close: string;
    chatEmpty: string;
  };
};

type RunDialogActionEnvelope = {
  type: "run-dialog:action";
  action: string;
  payload?: Record<string, unknown>;
};

type RunDialogEntry = {
  key: string;
  backend: BackendInstance;
  requestId: string;
  dialog: DialogHelper;
  frameWindow: Window | null;
  stopObserver?: () => void;
  removeMessageListener?: () => void;
  session: RunSessionState;
};

const runDialogMap = new Map<string, RunDialogEntry>();

function localize(
  key: string,
  fallback: string,
  options?: { args?: Record<string, unknown> },
) {
  try {
    const resolved = String(
      options ? getString(key as any, options) : getString(key as any),
    ).trim();
    return resolved || fallback;
  } catch {
    return fallback;
  }
}

function compactError(error: unknown) {
  const text = String(error || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "unknown error";
  }
  return text.length > 220 ? `${text.slice(0, 220)}...` : text;
}

function isTerminalStatus(status: string) {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }
  const runtime = globalThis as {
    Zotero?: { Promise?: { delay?: (delayMs: number) => Promise<void> } };
  };
  if (typeof runtime.Zotero?.Promise?.delay === "function") {
    await runtime.Zotero.Promise.delay(ms);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function formatSkillRunnerEventText(event: Record<string, unknown>) {
  const kind = String(event.kind || event.type || event.event || "").trim();
  const role = String(event.role || "").trim();
  const summary = String(
    event.summary || event.text || event.content || event.message || "",
  ).trim();
  if (summary) {
    const prefixParts = [kind, role].filter(Boolean);
    const prefix = prefixParts.length ? `[${prefixParts.join("/")}] ` : "";
    return `${prefix}${summary}`;
  }
  return JSON.stringify(event);
}

function mergeHistoryEventsIntoSession(args: {
  session: RunSessionState;
  historyPayload: SkillRunnerManagementChatHistoryPayload;
}) {
  const events = args.historyPayload.events || [];
  let changed = false;
  for (const event of events) {
    if (!event || typeof event !== "object") {
      continue;
    }
    const seq = Number((event as { seq?: unknown }).seq || 0);
    if (!Number.isFinite(seq) || seq <= args.session.lastSeq) {
      continue;
    }
    args.session.messages.push({
      seq,
      ts: String((event as { ts?: unknown }).ts || "").trim() || undefined,
      text: formatSkillRunnerEventText(event),
      raw: event,
    });
    args.session.lastSeq = seq;
    changed = true;
  }
  if (changed && args.session.messages.length > 500) {
    args.session.messages = args.session.messages.slice(-500);
  }
}

function resolveRunDialogPageUrl() {
  const addonRef = String(config.addonRef || "").trim() || resolveAddonRef("");
  if (!addonRef) {
    return "about:blank";
  }
  return `chrome://${addonRef}/content/dashboard/run-dialog.html`;
}

function resolveRunDialogKey(backendId: string, requestId: string) {
  return `${backendId}::${requestId}`;
}

function createRunDialogFrame(doc: Document, pageUrl: string) {
  const isChromeLocalPage = /^chrome:\/\//i.test(String(pageUrl || ""));
  if (isChromeLocalPage) {
    const frame = doc.createElement("iframe");
    frame.setAttribute("data-zs-role", "skillrunner-run-dialog-frame");
    frame.src = pageUrl;
    frame.style.width = "100%";
    frame.style.height = "100%";
    frame.style.minHeight = "780px";
    frame.style.border = "none";
    return frame;
  }
  const createXul = (doc as { createXULElement?: (tag: string) => Element })
    .createXULElement;
  if (typeof createXul === "function") {
    const browser = createXul.call(doc, "browser");
    browser.setAttribute("data-zs-role", "skillrunner-run-dialog-frame");
    browser.setAttribute("disableglobalhistory", "true");
    browser.setAttribute("remote", "true");
    browser.setAttribute("maychangeremoteness", "true");
    browser.setAttribute("type", "content");
    browser.setAttribute("flex", "1");
    browser.setAttribute("src", pageUrl);
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
  const frame = doc.createElement("iframe");
  frame.setAttribute("data-zs-role", "skillrunner-run-dialog-frame");
  frame.src = pageUrl;
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.style.minHeight = "780px";
  frame.style.border = "none";
  return frame;
}

function resolveFrameWindow(frame: Element | null) {
  if (!frame) {
    return null;
  }
  const candidate = frame as Element & { contentWindow?: Window | null };
  return candidate.contentWindow || null;
}

function buildRunDialogSnapshot(entry: RunDialogEntry): RunDialogSnapshot {
  const pending = entry.session.pending?.pending as
    | { interaction_id?: number; prompt?: string }
    | undefined;
  return {
    title: localize(
      "task-dashboard-run-dialog-title",
      "Run Details: {requestId}",
      {
        args: { requestId: entry.requestId },
      },
    ),
    backendTitle: localize("task-dashboard-skillrunner-title", "SkillRunner Backend: {id}", {
      args: { id: entry.backend.id },
    }),
    requestId: entry.requestId,
    status: entry.session.status,
    updatedAt: entry.session.updatedAt,
    pendingOwner: entry.session.pending?.pending_owner,
    pendingInteractionId:
      typeof pending?.interaction_id === "number"
        ? pending.interaction_id
        : undefined,
    pendingPrompt: String(pending?.prompt || "").trim() || undefined,
    loading: entry.session.loading,
    error: entry.session.error,
    messages: entry.session.messages.map((entryItem) => ({
      seq: entryItem.seq,
      ts: entryItem.ts,
      text: entryItem.text,
    })),
    labels: {
      requestId: localize("task-dashboard-run-request-id", "Request ID"),
      status: localize("task-manager-column-status", "Status"),
      updatedAt: localize("task-dashboard-run-updated-at", "Updated At"),
      pendingOwner: localize("task-dashboard-run-pending-owner", "Pending Owner"),
      pendingInteractionId: localize(
        "task-dashboard-run-pending-interaction-id",
        "Pending Interaction ID",
      ),
      loading: localize("task-dashboard-run-loading", "Loading"),
      error: localize("task-dashboard-run-error", "Error"),
      replyPlaceholder: localize(
        "task-dashboard-skillrunner-reply-placeholder",
        "Reply text...",
      ),
      reply: localize("task-dashboard-skillrunner-reply", "Reply"),
      cancel: localize("task-dashboard-skillrunner-cancel", "Cancel Run"),
      close: localize("task-manager-close", "Close"),
      chatEmpty: localize(
        "task-dashboard-skillrunner-chat-empty",
        "No chat events yet.",
      ),
    },
  };
}

function pushSnapshot(
  entry: RunDialogEntry,
  messageType: "run-dialog:init" | "run-dialog:snapshot",
) {
  if (!entry.frameWindow) {
    return;
  }
  entry.frameWindow.postMessage(
    {
      type: messageType,
      payload: buildRunDialogSnapshot(entry),
    },
    "*",
  );
}

async function startRunObserver(entry: RunDialogEntry) {
  let stopped = false;
  const client = buildSkillRunnerManagementClient({
    backend: entry.backend,
    alertWindow: entry.dialog.window,
    localize,
  });
  entry.session.loading = true;
  entry.session.error = undefined;
  pushSnapshot(entry, "run-dialog:snapshot");

  const syncHistory = async () => {
    const historyPayload = await client.listRunChatHistory({
      requestId: entry.requestId,
      fromSeq: entry.session.lastSeq + 1,
    });
    mergeHistoryEventsIntoSession({
      session: entry.session,
      historyPayload,
    });
  };

  const syncStatus = async () => {
    const run = (await client.getRun({
      requestId: entry.requestId,
    })) as SkillRunnerManagementRunState;
    entry.session.status = String(run.status || entry.session.status || "unknown");
    entry.session.updatedAt =
      String(run.updated_at || "").trim() || entry.session.updatedAt;
    try {
      entry.session.pending = (await client.getPending({
        requestId: entry.requestId,
      })) as SkillRunnerManagementPending;
    } catch {
      entry.session.pending = undefined;
    }
  };

  const handleSseFrame = (frame: SkillRunnerManagementSseFrame) => {
    if (stopped) {
      return;
    }
    if (frame.event === "snapshot") {
      const payload = frame.data as { status?: unknown };
      entry.session.status = String(
        payload?.status || entry.session.status || "unknown",
      );
      pushSnapshot(entry, "run-dialog:snapshot");
      return;
    }
    if (
      frame.event !== "chat_event" ||
      !frame.data ||
      typeof frame.data !== "object"
    ) {
      return;
    }
    const event = frame.data as Record<string, unknown>;
    const seq = Number(event.seq || 0);
    if (!Number.isFinite(seq) || seq <= entry.session.lastSeq) {
      return;
    }
    entry.session.messages.push({
      seq,
      ts: String(event.ts || "").trim() || undefined,
      text: formatSkillRunnerEventText(event),
      raw: event,
    });
    entry.session.lastSeq = seq;
    if (entry.session.messages.length > 500) {
      entry.session.messages = entry.session.messages.slice(-500);
    }
    pushSnapshot(entry, "run-dialog:snapshot");
  };

  const runLoop = async () => {
    try {
      await syncStatus();
      await syncHistory();
      pushSnapshot(entry, "run-dialog:snapshot");
      while (!stopped) {
        await client.streamRunChat({
          requestId: entry.requestId,
          cursor: entry.session.lastSeq,
          onFrame: handleSseFrame,
        });
        if (stopped) {
          break;
        }
        await syncHistory();
        await syncStatus();
        pushSnapshot(entry, "run-dialog:snapshot");
        if (isTerminalStatus(entry.session.status)) {
          break;
        }
        await sleep(800);
      }
    } catch (error) {
      entry.session.error = compactError(error);
      pushSnapshot(entry, "run-dialog:snapshot");
    } finally {
      entry.session.loading = false;
      pushSnapshot(entry, "run-dialog:snapshot");
    }
  };
  void runLoop();
  return () => {
    stopped = true;
  };
}

async function handleRunDialogAction(
  entry: RunDialogEntry,
  envelope: RunDialogActionEnvelope,
) {
  const action = String(envelope.action || "").trim();
  const payload = envelope.payload || {};
  if (!action) {
    return;
  }
  if (action === "ready") {
    pushSnapshot(entry, "run-dialog:init");
    return;
  }
  if (action === "close-dialog") {
    entry.dialog.window?.close();
    return;
  }
  if (action === "cancel-run") {
    if (isTerminalStatus(entry.session.status)) {
      pushSnapshot(entry, "run-dialog:snapshot");
      return;
    }
    try {
      const client = buildSkillRunnerManagementClient({
        backend: entry.backend,
        alertWindow: entry.dialog.window,
        localize,
      });
      await client.cancelRun({
        requestId: entry.requestId,
      });
    } catch (error) {
      entry.dialog.window?.alert?.(
        localize(
          "task-dashboard-skillrunner-cancel-failed",
          "Failed to cancel run: {error}",
          {
            args: {
              error: compactError(error),
            },
          },
        ),
      );
    }
    pushSnapshot(entry, "run-dialog:snapshot");
    return;
  }
  if (action === "reply-run") {
    const replyText = String(payload.replyText || "").trim();
    const interactionId = Number(payload.interactionId || 0);
    if (!replyText) {
      entry.dialog.window?.alert?.(
        localize(
          "task-dashboard-skillrunner-reply-required",
          "Reply text is required.",
        ),
      );
      return;
    }
    if (!Number.isFinite(interactionId) || interactionId <= 0) {
      return;
    }
    try {
      const client = buildSkillRunnerManagementClient({
        backend: entry.backend,
        alertWindow: entry.dialog.window,
        localize,
      });
      await client.submitReply({
        requestId: entry.requestId,
        payload: {
          mode: "interaction",
          interaction_id: interactionId,
          response: replyText,
        },
      });
    } catch (error) {
      entry.dialog.window?.alert?.(
        localize(
          "task-dashboard-skillrunner-reply-failed",
          "Failed to submit reply: {error}",
          {
            args: {
              error: compactError(error),
            },
          },
        ),
      );
    }
    pushSnapshot(entry, "run-dialog:snapshot");
  }
}

export async function openSkillRunnerRunDialog(args: {
  backend: BackendInstance;
  requestId: string;
}) {
  const backendId = String(args.backend.id || "").trim();
  const requestId = String(args.requestId || "").trim();
  if (!backendId || !requestId) {
    return;
  }
  const dialogKey = resolveRunDialogKey(backendId, requestId);
  const existing = runDialogMap.get(dialogKey);
  if (existing && isWindowAlive(existing.dialog.window)) {
    existing.dialog.window?.focus();
    return;
  }
  if (existing) {
    runDialogMap.delete(dialogKey);
  }

  const pageUrl = resolveRunDialogPageUrl();
  const title = localize("task-dashboard-run-dialog-title", "Run Details: {requestId}", {
    args: { requestId },
  });

  let dialogHelper: DialogHelper | undefined;
  const entry: RunDialogEntry = {
    key: dialogKey,
    backend: args.backend,
    requestId,
    // assigned after open
    dialog: undefined as unknown as DialogHelper,
    frameWindow: null,
    session: {
      requestId,
      status: "unknown",
      messages: [],
      lastSeq: 0,
      loading: true,
    },
  };

  const dialogData: Record<string, unknown> = {
    loadCallback: () => {
      const doc = dialogHelper?.window?.document;
      const dialogWindow = dialogHelper?.window;
      if (!doc || !dialogWindow) {
        return;
      }
      const root = doc.getElementById("zs-skillrunner-run-dialog-root") as
        | HTMLElement
        | null;
      if (!root) {
        return;
      }
      root.innerHTML = "";
      const frame = createRunDialogFrame(doc, pageUrl);
      root.appendChild(frame);
      entry.frameWindow = resolveFrameWindow(frame);
      frame.addEventListener("load", () => {
        entry.frameWindow = resolveFrameWindow(frame);
        if (!entry.frameWindow) {
          dialogHelper?.window?.alert?.(
            localize(
              "task-dashboard-open-management-failed",
              "Run dialog host failed to resolve frame window.",
              {
                args: { error: "frame_window_unavailable" },
              },
            ),
          );
          return;
        }
        pushSnapshot(entry, "run-dialog:init");
      });

      const onMessage = (event: MessageEvent) => {
        const data = event.data as { type?: unknown };
        if (!data || data.type !== "run-dialog:action") {
          return;
        }
        void handleRunDialogAction(entry, data as RunDialogActionEnvelope);
      };
      dialogWindow.addEventListener("message", onMessage);
      entry.removeMessageListener = () => {
        dialogWindow.removeEventListener("message", onMessage);
      };

      void startRunObserver(entry).then((stop) => {
        entry.stopObserver = stop;
      });
      pushSnapshot(entry, "run-dialog:snapshot");
    },
    unloadCallback: () => {
      if (entry.stopObserver) {
        entry.stopObserver();
        entry.stopObserver = undefined;
      }
      if (entry.removeMessageListener) {
        entry.removeMessageListener();
        entry.removeMessageListener = undefined;
      }
      entry.frameWindow = null;
      runDialogMap.delete(dialogKey);
    },
  };

  const dialogBuilder = new ztoolkit.Dialog(1, 1)
    .addCell(0, 0, {
      tag: "div",
      namespace: "html",
      id: "zs-skillrunner-run-dialog-root",
      styles: {
        width: "1180px",
        height: "820px",
        padding: "0",
        margin: "0",
        display: "flex",
      },
    })
    .addButton(localize("task-manager-close", "Close"), "close")
    .setDialogData(dialogData);
  entry.dialog = dialogBuilder;
  dialogHelper = dialogBuilder.open(title);
  entry.dialog = dialogHelper;
  runDialogMap.set(dialogKey, entry);

  await (dialogData as { unloadLock?: { promise?: Promise<void> } }).unloadLock
    ?.promise;
}
