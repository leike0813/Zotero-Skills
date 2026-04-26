import { ACP_OPENCODE_BACKEND_ID } from "../config/defaults";
import { joinPath } from "../utils/path";
import {
  PLUGIN_TASK_DOMAIN_ACP,
  deletePluginTaskRequestEntry,
  getPluginDataDirectoryPath,
  getPluginTaskRequestEntry,
  listPluginTaskRowEntries,
  replacePluginTaskRowEntries,
  upsertPluginTaskRequestEntry,
} from "./pluginStateStore";
import {
  cloneAcpConversationItem,
  cloneAcpSelectableOption,
  createEmptyAcpConversationSnapshot,
  normalizeAcpStatus,
  type AcpAuthMethod,
  type AcpAvailableCommand,
  type AcpConversationItem,
  type AcpConversationSnapshot,
  type AcpDiagnosticsEntry,
  type AcpHostContext,
  type AcpPendingPermissionRequest,
  type AcpSelectableOption,
  type AcpUsageSummary,
} from "./acpTypes";

const ACP_SCOPE_ACTIVE = "active";
const ACP_FRONTEND_REQUEST_ID = "frontend";

function conversationRequestId(backendId: string) {
  return `conversation:${backendId}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value: unknown) {
  return String(value || "").trim();
}

function normalizeChatDisplayMode(value: unknown) {
  return normalizeString(value) === "bubble" ? "bubble" : "plain";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseSelectableOption(value: unknown): AcpSelectableOption | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const id = normalizeString(value.id);
  const label = normalizeString(value.label);
  if (!id || !label) {
    return undefined;
  }
  return {
    id,
    label,
    description: normalizeString(value.description) || undefined,
  };
}

function parseSelectableOptionArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AcpSelectableOption[];
  }
  return value
    .map((entry) => parseSelectableOption(entry))
    .filter((entry): entry is AcpSelectableOption => !!entry);
}

function parseAuthMethods(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AcpAuthMethod[];
  }
  const normalized: AcpAuthMethod[] = [];
  for (const entry of value) {
      if (!isRecord(entry)) {
        continue;
      }
      const id = normalizeString(entry.id);
      const name = normalizeString(entry.name);
      if (!id || !name) {
        continue;
      }
      normalized.push({
        id,
        name,
        description: normalizeString(entry.description) || undefined,
      });
  }
  return normalized;
}

function parseAvailableCommands(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AcpAvailableCommand[];
  }
  const normalized: AcpAvailableCommand[] = [];
  for (const entry of value) {
      if (!isRecord(entry)) {
        continue;
      }
      const name = normalizeString(entry.name);
      if (!name) {
        continue;
      }
      normalized.push({
        name,
        title: normalizeString(entry.title) || undefined,
        description: normalizeString(entry.description) || undefined,
      });
  }
  return normalized;
}

function parseUsage(value: unknown): AcpUsageSummary | null {
  if (!isRecord(value)) {
    return null;
  }
  const used = Number(value.used || 0);
  const size = Number(value.size || 0);
  if (!Number.isFinite(used) || !Number.isFinite(size)) {
    return null;
  }
  return {
    used: Math.max(0, Math.floor(used)),
    size: Math.max(0, Math.floor(size)),
    costText: normalizeString(value.costText) || undefined,
  };
}

function parsePendingPermissionRequest(
  value: unknown,
): AcpPendingPermissionRequest | null {
  if (!isRecord(value)) {
    return null;
  }
  const requestId = normalizeString(value.requestId);
  if (!requestId) {
    return null;
  }
  const options = Array.isArray(value.options)
    ? value.options.reduce((acc, entry) => {
        if (!isRecord(entry)) {
          return acc;
        }
        const optionId = normalizeString(entry.optionId);
        const name = normalizeString(entry.name);
        if (!optionId || !name) {
          return acc;
        }
        acc.push({
          optionId,
          kind: normalizeString(entry.kind),
          name,
          description: normalizeString(entry.description) || undefined,
        });
        return acc;
      }, [] as AcpPendingPermissionRequest["options"])
    : [];
  return {
    requestId,
    sessionId: normalizeString(value.sessionId),
    toolCallId: normalizeString(value.toolCallId),
    toolTitle: normalizeString(value.toolTitle),
    requestedAt: normalizeString(value.requestedAt) || nowIso(),
    options,
  };
}

function parseDiagnostics(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AcpDiagnosticsEntry[];
  }
  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return undefined;
      }
      const id = normalizeString(entry.id);
      if (!id) {
        return undefined;
      }
      const level = normalizeString(entry.level);
      const normalized: AcpDiagnosticsEntry = {
        id,
        ts: normalizeString(entry.ts) || nowIso(),
        kind: normalizeString(entry.kind),
        level:
          level === "warn" || level === "error"
            ? (level as "warn" | "error")
            : "info",
        message: normalizeString(entry.message),
        detail: normalizeString(entry.detail),
        stage: normalizeString(entry.stage) || undefined,
        errorName: normalizeString(entry.errorName) || undefined,
        stack: normalizeString(entry.stack) || undefined,
        cause: normalizeString(entry.cause) || undefined,
        code:
          typeof entry.code === "number" || typeof entry.code === "string"
            ? entry.code
            : undefined,
        data: entry.data,
        raw: entry.raw,
      };
      return normalized;
    })
    .filter((entry): entry is AcpDiagnosticsEntry => !!entry);
}

function parseHostContext(value: unknown): AcpHostContext | null {
  if (!isRecord(value)) {
    return null;
  }
  const target = normalizeString(value.target) === "reader" ? "reader" : "library";
  const currentItem =
    isRecord(value.currentItem) &&
    (Number(value.currentItem.id || 0) > 0 ||
      normalizeString(value.currentItem.key) ||
      normalizeString(value.currentItem.title))
      ? {
          id:
            Number.isFinite(Number(value.currentItem.id || 0)) &&
            Number(value.currentItem.id || 0) > 0
              ? Math.floor(Number(value.currentItem.id || 0))
              : undefined,
          key: normalizeString(value.currentItem.key) || undefined,
          title: normalizeString(value.currentItem.title) || undefined,
        }
      : undefined;
  return {
    target,
    libraryId: normalizeString(value.libraryId) || undefined,
    selectionEmpty: value.selectionEmpty === true,
    currentItem,
  };
}

function parseConversationItem(payload: string) {
  try {
    const parsed = JSON.parse(String(payload || "{}")) as Record<string, unknown>;
    if (!isRecord(parsed)) {
      return null;
    }
    if (normalizeString(parsed.kind) === "message") {
      return {
        id: normalizeString(parsed.id),
        kind: "message",
        role:
          parsed.role === "assistant" || parsed.role === "system"
            ? parsed.role
            : "user",
        text: String(parsed.text || ""),
        createdAt: normalizeString(parsed.createdAt) || nowIso(),
        updatedAt: normalizeString(parsed.updatedAt) || undefined,
        state:
          parsed.state === "streaming" || parsed.state === "error"
            ? parsed.state
            : "complete",
      } satisfies AcpConversationItem;
    }
    if (normalizeString(parsed.kind) === "thought") {
      return {
        id: normalizeString(parsed.id),
        kind: "thought",
        text: String(parsed.text || ""),
        createdAt: normalizeString(parsed.createdAt) || nowIso(),
        updatedAt: normalizeString(parsed.updatedAt) || undefined,
        state:
          parsed.state === "streaming" || parsed.state === "error"
            ? parsed.state
            : "complete",
      } satisfies AcpConversationItem;
    }
    if (normalizeString(parsed.kind) === "tool_call") {
      const state = normalizeString(parsed.state);
      return {
        id: normalizeString(parsed.id),
        kind: "tool_call",
        toolCallId: normalizeString(parsed.toolCallId),
        title: String(parsed.title || ""),
        toolKind: normalizeString(parsed.toolKind) || undefined,
        state:
          state === "pending" ||
          state === "in_progress" ||
          state === "failed"
            ? (state as "pending" | "in_progress" | "failed")
            : "completed",
        summary: normalizeString(parsed.summary) || undefined,
        createdAt: normalizeString(parsed.createdAt) || nowIso(),
        updatedAt: normalizeString(parsed.updatedAt) || undefined,
      } satisfies AcpConversationItem;
    }
    if (normalizeString(parsed.kind) === "plan") {
      return {
        id: normalizeString(parsed.id),
        kind: "plan",
        entries: Array.isArray(parsed.entries)
          ? parsed.entries
              .map((entry) => {
                if (!isRecord(entry)) {
                  return undefined;
                }
                return {
                  content: normalizeString(entry.content),
                  priority: normalizeString(entry.priority),
                  status: normalizeString(entry.status),
                };
              })
              .filter(
                (entry): entry is NonNullable<
                  Exclude<AcpConversationItem, { kind: "message" | "thought" | "tool_call" | "status" }>["entries"][number]
                > => !!entry,
              )
          : [],
        createdAt: normalizeString(parsed.createdAt) || nowIso(),
        updatedAt: normalizeString(parsed.updatedAt) || undefined,
      } satisfies AcpConversationItem;
    }
    if (normalizeString(parsed.kind) === "status") {
      const level = normalizeString(parsed.level);
      return {
        id: normalizeString(parsed.id),
        kind: "status",
        level:
          level === "warn" || level === "error"
            ? (level as "warn" | "error")
            : "info",
        label: normalizeString(parsed.label),
        text: String(parsed.text || ""),
        createdAt: normalizeString(parsed.createdAt) || nowIso(),
        updatedAt: normalizeString(parsed.updatedAt) || undefined,
      } satisfies AcpConversationItem;
    }
    if (normalizeString(parsed.role)) {
      return {
        id: normalizeString(parsed.id),
        kind: "message",
        role:
          parsed.role === "assistant" || parsed.role === "system"
            ? parsed.role
            : "user",
        text: String(parsed.text || ""),
        createdAt: normalizeString(parsed.createdAt) || nowIso(),
        updatedAt: normalizeString(parsed.updatedAt) || undefined,
        state:
          parsed.state === "streaming" || parsed.state === "error"
            ? parsed.state
            : "complete",
      } satisfies AcpConversationItem;
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeSnapshotPayload(args: {
  backendId: string;
  payload: string;
}) {
  const snapshot = createEmptyAcpConversationSnapshot();
  snapshot.backendId = args.backendId;
  try {
    const parsed = JSON.parse(
      String(args.payload || "{}"),
    ) as Partial<AcpConversationSnapshot>;
    snapshot.conversationId = normalizeString(parsed.conversationId);
    snapshot.sessionId = normalizeString(parsed.sessionId);
    snapshot.status = normalizeAcpStatus(parsed.status);
    snapshot.busy = parsed.busy === true;
    snapshot.showDiagnostics = parsed.showDiagnostics === true;
    snapshot.statusExpanded = parsed.statusExpanded === true;
    snapshot.chatDisplayMode = normalizeChatDisplayMode(parsed.chatDisplayMode);
    snapshot.lastError = String(parsed.lastError || "");
    snapshot.prerequisiteError = String(parsed.prerequisiteError || "");
    snapshot.authMethods = parseAuthMethods(parsed.authMethods);
    snapshot.authMethodIds =
      snapshot.authMethods.length > 0
        ? snapshot.authMethods.map((entry) => entry.id)
        : Array.isArray(parsed.authMethodIds)
          ? parsed.authMethodIds
              .map((entry) => normalizeString(entry))
              .filter(Boolean)
          : [];
    snapshot.commandLabel = normalizeString(parsed.commandLabel);
    snapshot.commandLine = normalizeString(parsed.commandLine);
    snapshot.agentLabel = normalizeString(parsed.agentLabel);
    snapshot.agentVersion = normalizeString(parsed.agentVersion);
    snapshot.sessionTitle = normalizeString(parsed.sessionTitle);
    snapshot.sessionUpdatedAt = normalizeString(parsed.sessionUpdatedAt);
    snapshot.modeOptions = parseSelectableOptionArray(parsed.modeOptions);
    snapshot.currentMode = parseSelectableOption(parsed.currentMode);
    snapshot.modelOptions = parseSelectableOptionArray(parsed.modelOptions);
    snapshot.currentModel = parseSelectableOption(parsed.currentModel);
    snapshot.displayModelOptions = parseSelectableOptionArray(
      parsed.displayModelOptions,
    );
    snapshot.currentDisplayModel = parseSelectableOption(
      parsed.currentDisplayModel,
    );
    snapshot.reasoningEffortOptions = parseSelectableOptionArray(
      parsed.reasoningEffortOptions,
    );
    snapshot.currentReasoningEffort = parseSelectableOption(
      parsed.currentReasoningEffort,
    );
    snapshot.availableCommands = parseAvailableCommands(parsed.availableCommands);
    snapshot.lastStopReason = normalizeString(parsed.lastStopReason);
    snapshot.usage = parseUsage(parsed.usage);
    snapshot.pendingPermissionRequest = parsePendingPermissionRequest(
      parsed.pendingPermissionRequest,
    );
    snapshot.diagnostics = parseDiagnostics(parsed.diagnostics);
    snapshot.lastHostContext = parseHostContext(parsed.lastHostContext);
    snapshot.sessionCwd = normalizeString(parsed.sessionCwd);
    snapshot.workspaceDir = normalizeString(parsed.workspaceDir);
    snapshot.runtimeDir = normalizeString(parsed.runtimeDir);
    snapshot.stderrTail = normalizeString(parsed.stderrTail);
    snapshot.lastLifecycleEvent = normalizeString(parsed.lastLifecycleEvent);
    snapshot.updatedAt = normalizeString(parsed.updatedAt) || nowIso();
  } catch {
    snapshot.updatedAt = nowIso();
  }
  return snapshot;
}

export function resolveAcpStoragePaths(backendIdRaw: string) {
  const backendId = String(backendIdRaw || "").trim() || ACP_OPENCODE_BACKEND_ID;
  const dataRoot = getPluginDataDirectoryPath();
  const normalizedRoot = String(dataRoot || "").replace(/\\/g, "/");
  const root =
    normalizedRoot.endsWith("/.zotero-skills-runtime") ||
    normalizedRoot.endsWith(".zotero-skills-runtime")
      ? joinPath(dataRoot, "acp")
      : joinPath(dataRoot, "zotero-skills", "acp");
  return {
    workspaceDir: joinPath(root, "workspaces", backendId),
    runtimeDir: joinPath(root, "runtime", backendId),
  };
}

export function resolveAcpSessionCwd() {
  const runtime = globalThis as {
    Zotero?: { DataDirectory?: { dir?: string } };
    process?: { cwd?: () => string };
  };
  const dataDir = normalizeString(runtime.Zotero?.DataDirectory?.dir);
  if (dataDir) {
    return dataDir;
  }
  return normalizeString(runtime.process?.cwd?.());
}

export function loadAcpConversationState(backendIdRaw: string) {
  const backendId = String(backendIdRaw || "").trim() || ACP_OPENCODE_BACKEND_ID;
  const requestEntry = getPluginTaskRequestEntry(
    PLUGIN_TASK_DOMAIN_ACP,
    conversationRequestId(backendId),
  );
  const snapshot = requestEntry
    ? normalizeSnapshotPayload({
        backendId,
        payload: requestEntry.payload,
      })
    : {
        ...createEmptyAcpConversationSnapshot(),
        backendId,
        updatedAt: nowIso(),
      };
  const items = listPluginTaskRowEntries(PLUGIN_TASK_DOMAIN_ACP, ACP_SCOPE_ACTIVE)
    .filter(
      (entry) =>
        String(entry.backendId || "").trim() === backendId &&
        String(entry.requestId || "").trim() === conversationRequestId(backendId),
    )
    .map((entry) => parseConversationItem(entry.payload))
    .filter((entry) => !!entry)
    .sort((left, right) =>
      String((left as AcpConversationItem).createdAt || "").localeCompare(
        String((right as AcpConversationItem).createdAt || ""),
      ),
    );
  return {
    snapshot,
    items: items as AcpConversationItem[],
  };
}

export function loadAcpFrontendState() {
  const requestEntry = getPluginTaskRequestEntry(
    PLUGIN_TASK_DOMAIN_ACP,
    ACP_FRONTEND_REQUEST_ID,
  );
  if (!requestEntry) {
    return {
      activeBackendId: "",
    };
  }
  try {
    const parsed = JSON.parse(String(requestEntry.payload || "{}")) as {
      activeBackendId?: unknown;
    };
    return {
      activeBackendId: normalizeString(parsed.activeBackendId),
    };
  } catch {
    return {
      activeBackendId: "",
    };
  }
}

export function saveAcpFrontendState(args: { activeBackendId: string }) {
  upsertPluginTaskRequestEntry(PLUGIN_TASK_DOMAIN_ACP, {
    requestId: ACP_FRONTEND_REQUEST_ID,
    backendId: "",
    state: "active",
    updatedAt: nowIso(),
    payload: JSON.stringify({
      activeBackendId: normalizeString(args.activeBackendId),
    }),
  });
}

export function saveAcpConversationState(snapshot: AcpConversationSnapshot) {
  const backendId = String(snapshot.backendId || "").trim() || ACP_OPENCODE_BACKEND_ID;
  const requestId = conversationRequestId(backendId);
  upsertPluginTaskRequestEntry(PLUGIN_TASK_DOMAIN_ACP, {
    requestId,
    backendId,
    state: snapshot.status,
    updatedAt: String(snapshot.updatedAt || nowIso()),
    payload: JSON.stringify({
      conversationId: snapshot.conversationId,
      sessionId: snapshot.sessionId,
      status: snapshot.status,
      busy: snapshot.busy,
      showDiagnostics: snapshot.showDiagnostics,
      statusExpanded: snapshot.statusExpanded,
      chatDisplayMode: snapshot.chatDisplayMode,
      lastError: snapshot.lastError,
      prerequisiteError: snapshot.prerequisiteError,
      authMethods: snapshot.authMethods.map((entry) => ({ ...entry })),
      authMethodIds: snapshot.authMethodIds,
      commandLabel: snapshot.commandLabel,
      commandLine: snapshot.commandLine,
      agentLabel: snapshot.agentLabel,
      agentVersion: snapshot.agentVersion,
      sessionTitle: snapshot.sessionTitle,
      sessionUpdatedAt: snapshot.sessionUpdatedAt,
      modeOptions: snapshot.modeOptions.map((entry) => ({ ...entry })),
      currentMode: cloneAcpSelectableOption(snapshot.currentMode),
      modelOptions: snapshot.modelOptions.map((entry) => ({ ...entry })),
      currentModel: cloneAcpSelectableOption(snapshot.currentModel),
      displayModelOptions: snapshot.displayModelOptions.map((entry) => ({
        ...entry,
      })),
      currentDisplayModel: cloneAcpSelectableOption(
        snapshot.currentDisplayModel,
      ),
      reasoningEffortOptions: snapshot.reasoningEffortOptions.map((entry) => ({
        ...entry,
      })),
      currentReasoningEffort: cloneAcpSelectableOption(
        snapshot.currentReasoningEffort,
      ),
      availableCommands: snapshot.availableCommands.map((entry) => ({ ...entry })),
      lastStopReason: snapshot.lastStopReason,
      usage: snapshot.usage ? { ...snapshot.usage } : null,
      pendingPermissionRequest: snapshot.pendingPermissionRequest
        ? {
            ...snapshot.pendingPermissionRequest,
            options: snapshot.pendingPermissionRequest.options.map((entry) => ({
              ...entry,
            })),
          }
        : null,
      diagnostics: snapshot.diagnostics.map((entry) => ({ ...entry })),
      lastHostContext: snapshot.lastHostContext
        ? JSON.parse(JSON.stringify(snapshot.lastHostContext))
        : null,
      sessionCwd: snapshot.sessionCwd,
      workspaceDir: snapshot.workspaceDir,
      runtimeDir: snapshot.runtimeDir,
      stderrTail: snapshot.stderrTail,
      lastLifecycleEvent: snapshot.lastLifecycleEvent,
      updatedAt: snapshot.updatedAt || nowIso(),
    }),
  });
  replacePluginTaskRowEntries(
    PLUGIN_TASK_DOMAIN_ACP,
    ACP_SCOPE_ACTIVE,
    [
      ...listPluginTaskRowEntries(PLUGIN_TASK_DOMAIN_ACP, ACP_SCOPE_ACTIVE).filter(
        (entry) =>
          String(entry.backendId || "").trim() !== backendId ||
          String(entry.requestId || "").trim() !== requestId,
      ),
      ...snapshot.items
        .filter((item) => normalizeString(item.id))
        .map((item) => ({
          taskId: item.id,
          requestId,
          backendId,
          state:
            item.kind === "message" || item.kind === "thought" || item.kind === "tool_call"
              ? String(item.state || "")
              : item.kind === "status"
                ? item.level
                : "complete",
          updatedAt: String(item.updatedAt || item.createdAt || nowIso()),
          payload: JSON.stringify(cloneAcpConversationItem(item)),
        })),
    ],
  );
}

export function clearAcpConversationState(backendIdRaw: string) {
  const backendId = String(backendIdRaw || "").trim() || ACP_OPENCODE_BACKEND_ID;
  const requestId = conversationRequestId(backendId);
  deletePluginTaskRequestEntry(
    PLUGIN_TASK_DOMAIN_ACP,
    requestId,
  );
  const preservedRows = listPluginTaskRowEntries(
    PLUGIN_TASK_DOMAIN_ACP,
    ACP_SCOPE_ACTIVE,
  ).filter(
    (entry) =>
      String(entry.backendId || "").trim() !== backendId ||
      String(entry.requestId || "").trim() !== requestId,
  );
  replacePluginTaskRowEntries(PLUGIN_TASK_DOMAIN_ACP, ACP_SCOPE_ACTIVE, preservedRows);
}
