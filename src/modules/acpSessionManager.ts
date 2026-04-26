import { loadBackendsRegistry } from "../backends/registry";
import type { BackendInstance } from "../backends/types";
import {
  ACP_BACKEND_TYPE,
  ACP_OPENCODE_BACKEND_ID,
} from "../config/defaults";
import {
  AcpAuthRequiredError,
  createAcpConnectionAdapter,
  type AcpConnectionAdapter,
  type AcpConnectionAdapterFactoryArgs,
} from "./acpConnectionAdapter";
import {
  clearAcpConversationState,
  loadAcpConversationState,
  loadAcpFrontendState,
  resolveAcpSessionCwd,
  resolveAcpStoragePaths,
  saveAcpConversationState,
  saveAcpFrontendState,
} from "./acpConversationStore";
import { describeAcpError, serializeAcpError } from "./acpDiagnostics";
import {
  cloneAcpConversationItem,
  cloneAcpSelectableOption,
  createEmptyAcpConversationSnapshot,
  normalizeAcpStatus,
  type AcpAuthMethod,
  type AcpChatDisplayMode,
  type AcpConversationItem,
  type AcpConversationMessageItem,
  type AcpConversationPlanItem,
  type AcpConversationSnapshot,
  type AcpConversationStatusItem,
  type AcpConversationThoughtItem,
  type AcpConversationToolCallItem,
  type AcpDiagnosticsBundle,
  type AcpDiagnosticsEntry,
  type AcpFrontendSnapshot,
  type AcpHostContext,
  type AcpSelectableOption,
} from "./acpTypes";
import type { RequestPermissionOutcome } from "./acpProtocol";

type AcpSnapshotListener = (snapshot: AcpConversationSnapshot) => void;
type AcpFrontendSnapshotListener = (snapshot: AcpFrontendSnapshot) => void;

export type AcpSessionSlot = {
  backendId: string;
  adapter: AcpConnectionAdapter | null;
  snapshot: AcpConversationSnapshot;
  unsubscribeUpdate: (() => void) | null;
  unsubscribeClose: (() => void) | null;
  unsubscribeDiagnostics: (() => void) | null;
  unsubscribePermission: (() => void) | null;
  suppressCloseEvent: boolean;
  activeAssistantItemId: string;
  activeThoughtItemId: string;
  activePlanItemId: string;
  pendingPermissionResolver:
    | ((outcome: RequestPermissionOutcome) => void)
    | null;
  uiEmitTimer: ReturnType<typeof setTimeout> | null;
  persistTimer: ReturnType<typeof setTimeout> | null;
};

type AcpEmitOptions = {
  persist?: boolean;
  throttleUi?: boolean;
  throttlePersist?: boolean;
};

let adapterFactory: (
  args: AcpConnectionAdapterFactoryArgs,
) => Promise<AcpConnectionAdapter> = createAcpConnectionAdapter;
let initialized = false;
let activeBackendId = "";
let cachedAcpBackends: BackendInstance[] = [];
const slots = new Map<string, AcpSessionSlot>();
const listeners = new Set<AcpSnapshotListener>();
const frontendListeners = new Set<AcpFrontendSnapshotListener>();
const MAX_DIAGNOSTICS = 40;
const STREAMING_UI_EMIT_THROTTLE_MS = 80;
const STREAMING_PERSIST_THROTTLE_MS = 1500;

function nowIso() {
  return new Date().toISOString();
}

function nextOpaqueId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeBackendId(value: unknown) {
  return String(value || "").trim();
}

function compactError(error: unknown) {
  return describeAcpError(error, "unknown error")
    .replace(/\s+/g, " ")
    .trim();
}

function serializeRuntimeHost() {
  const runtime = globalThis as {
    Zotero?: { version?: string; isWin?: boolean };
    navigator?: { userAgent?: string; platform?: string };
    process?: { platform?: string };
    ChromeUtils?: unknown;
    TextEncoder?: unknown;
    TextDecoder?: unknown;
    AbortController?: unknown;
    ReadableStream?: unknown;
    WritableStream?: unknown;
  };
  return {
    zoteroVersion: String(runtime.Zotero?.version || "").trim() || undefined,
    platform:
      String(runtime.navigator?.platform || "").trim() ||
      String(runtime.process?.platform || "").trim() ||
      undefined,
    isWin: runtime.Zotero?.isWin,
    hasChromeUtils: typeof runtime.ChromeUtils !== "undefined",
    hasTextEncoder: typeof runtime.TextEncoder === "function",
    hasTextDecoder: typeof runtime.TextDecoder === "function",
    hasAbortController: typeof runtime.AbortController === "function",
    hasReadableStream: typeof runtime.ReadableStream === "function",
    hasWritableStream: typeof runtime.WritableStream === "function",
  };
}

function cloneSnapshotValue(value: AcpConversationSnapshot) {
  return {
    ...value,
    authMethods: value.authMethods.map((entry) => ({ ...entry })),
    authMethodIds: [...value.authMethodIds],
    modeOptions: value.modeOptions.map((entry) => ({ ...entry })),
    currentMode: cloneAcpSelectableOption(value.currentMode),
    modelOptions: value.modelOptions.map((entry) => ({ ...entry })),
    currentModel: cloneAcpSelectableOption(value.currentModel),
    displayModelOptions: value.displayModelOptions.map((entry) => ({ ...entry })),
    currentDisplayModel: cloneAcpSelectableOption(value.currentDisplayModel),
    reasoningEffortOptions: value.reasoningEffortOptions.map((entry) => ({
      ...entry,
    })),
    currentReasoningEffort: cloneAcpSelectableOption(
      value.currentReasoningEffort,
    ),
    availableCommands: value.availableCommands.map((entry) => ({ ...entry })),
    usage: value.usage ? { ...value.usage } : null,
    pendingPermissionRequest: value.pendingPermissionRequest
      ? {
          ...value.pendingPermissionRequest,
          options: value.pendingPermissionRequest.options.map((entry) => ({
            ...entry,
          })),
        }
      : null,
    diagnostics: value.diagnostics.map((entry) => ({ ...entry })),
    items: value.items.map((entry) => cloneAcpConversationItem(entry)),
    lastHostContext: value.lastHostContext
      ? JSON.parse(JSON.stringify(value.lastHostContext))
      : null,
  } satisfies AcpConversationSnapshot;
}

function ensureInitialized() {
  if (initialized) {
    return;
  }
  activeBackendId =
    loadAcpFrontendState().activeBackendId || ACP_OPENCODE_BACKEND_ID;
  getOrCreateSlot(activeBackendId);
  initialized = true;
}

function hydrateSnapshot(backendId: string) {
  const restored = loadAcpConversationState(backendId);
  const snapshot = {
    ...createEmptyAcpConversationSnapshot(),
    ...restored.snapshot,
    backendId,
    items: restored.items,
    updatedAt: restored.snapshot.updatedAt || nowIso(),
  };
  if (!snapshot.conversationId) {
    snapshot.conversationId = nextOpaqueId("acp-conversation");
  }
  snapshot.status = normalizeAcpStatus(snapshot.status);
  snapshot.chatDisplayMode =
    snapshot.chatDisplayMode === "bubble" ? "bubble" : "plain";
  snapshot.statusExpanded = snapshot.statusExpanded === true;
  snapshot.authMethodIds = snapshot.authMethods.map((entry) => entry.id);
  deriveModelEffortState(snapshot);
  return snapshot;
}

function getOrCreateSlot(backendIdRaw?: string) {
  const backendId =
    normalizeBackendId(backendIdRaw) ||
    activeBackendId ||
    ACP_OPENCODE_BACKEND_ID;
  const existing = slots.get(backendId);
  if (existing) {
    return existing;
  }
  const slot: AcpSessionSlot = {
    backendId,
    adapter: null,
    snapshot: hydrateSnapshot(backendId),
    unsubscribeUpdate: null,
    unsubscribeClose: null,
    unsubscribeDiagnostics: null,
    unsubscribePermission: null,
    suppressCloseEvent: false,
    activeAssistantItemId: "",
    activeThoughtItemId: "",
    activePlanItemId: "",
    pendingPermissionResolver: null,
    uiEmitTimer: null,
    persistTimer: null,
  };
  slots.set(backendId, slot);
  return slot;
}

function getActiveSlot() {
  ensureInitialized();
  return getOrCreateSlot(activeBackendId);
}

function isActiveSlot(slot: AcpSessionSlot) {
  return normalizeBackendId(slot.backendId) === normalizeBackendId(activeBackendId);
}

function updateSnapshotTimestamp(slot: AcpSessionSlot) {
  slot.snapshot.authMethodIds = slot.snapshot.authMethods.map((entry) => entry.id);
  slot.snapshot.updatedAt = nowIso();
}

function persistSlotSnapshotNow(slot: AcpSessionSlot) {
  if (slot.snapshot.backendId) {
    saveAcpConversationState(slot.snapshot);
  }
}

function notifyConversationListenersNow(slot: AcpSessionSlot) {
  if (!isActiveSlot(slot)) {
    return;
  }
  const cloned = cloneSnapshotValue(slot.snapshot);
  for (const listener of listeners) {
    listener(cloned);
  }
}

function notifyFrontendListenersNow() {
  const frontend = buildFrontendSnapshot();
  for (const listener of frontendListeners) {
    listener(frontend);
  }
}

function flushPendingPersistence(slot: AcpSessionSlot) {
  if (slot.persistTimer) {
    clearTimeout(slot.persistTimer);
    slot.persistTimer = null;
  }
  persistSlotSnapshotNow(slot);
}

function flushPendingUiEmit(slot: AcpSessionSlot) {
  if (slot.uiEmitTimer) {
    clearTimeout(slot.uiEmitTimer);
    slot.uiEmitTimer = null;
  }
  notifyConversationListenersNow(slot);
  notifyFrontendListenersNow();
}

function schedulePersistenceFlush(slot: AcpSessionSlot) {
  if (slot.persistTimer) {
    return;
  }
  slot.persistTimer = setTimeout(() => {
    slot.persistTimer = null;
    persistSlotSnapshotNow(slot);
  }, STREAMING_PERSIST_THROTTLE_MS);
}

function scheduleUiEmit(slot: AcpSessionSlot) {
  if (slot.uiEmitTimer) {
    return;
  }
  slot.uiEmitTimer = setTimeout(() => {
    slot.uiEmitTimer = null;
    notifyConversationListenersNow(slot);
    notifyFrontendListenersNow();
  }, STREAMING_UI_EMIT_THROTTLE_MS);
}

function emitSlotSnapshot(slot: AcpSessionSlot, options: AcpEmitOptions = {}) {
  updateSnapshotTimestamp(slot);
  const persist = options.persist !== false;
  if (persist) {
    if (options.throttlePersist) {
      schedulePersistenceFlush(slot);
    } else {
      flushPendingPersistence(slot);
    }
  }
  if (options.throttleUi) {
    scheduleUiEmit(slot);
  } else {
    flushPendingUiEmit(slot);
  }
}

async function refreshAcpBackends() {
  const loaded = await loadBackendsRegistry();
  if (loaded.fatalError) {
    throw new Error(loaded.fatalError);
  }
  cachedAcpBackends = loaded.backends.filter(
    (entry) => normalizeBackendId(entry.type) === ACP_BACKEND_TYPE,
  );
  const ids = new Set(cachedAcpBackends.map((entry) => entry.id));
  if ((!activeBackendId || !ids.has(activeBackendId)) && cachedAcpBackends[0]) {
    activeBackendId = cachedAcpBackends[0].id;
    saveAcpFrontendState({ activeBackendId });
  }
  for (const backend of cachedAcpBackends) {
    const slot = getOrCreateSlot(backend.id);
    slot.snapshot.backend = backend;
  }
  return cachedAcpBackends;
}

async function resolveBackendForSlot(slot: AcpSessionSlot) {
  const backends = await refreshAcpBackends();
  const backend = backends.find((entry) => entry.id === slot.backendId) || null;
  if (!backend) {
    throw new Error(`ACP backend "${slot.backendId}" is not available`);
  }
  const paths = resolveAcpStoragePaths(backend.id);
  slot.snapshot.backend = backend;
  slot.snapshot.backendId = backend.id;
  slot.snapshot.sessionCwd = resolveAcpSessionCwd();
  slot.snapshot.workspaceDir = paths.workspaceDir;
  slot.snapshot.runtimeDir = paths.runtimeDir;
  return backend;
}

function appendDiagnostic(slot: AcpSessionSlot, entry: AcpDiagnosticsEntry) {
  slot.snapshot.diagnostics = [
    ...slot.snapshot.diagnostics,
    { ...entry },
  ].slice(-MAX_DIAGNOSTICS);
  slot.snapshot.lastLifecycleEvent = String(entry.kind || "").trim();
  if (String(entry.kind || "").trim() === "stderr") {
    slot.snapshot.stderrTail = String(entry.detail || "").trim();
  }
}

function appendErrorDiagnostic(args: {
  slot: AcpSessionSlot;
  kind: string;
  message: string;
  error: unknown;
  stage: string;
}) {
  const serialized = serializeAcpError(args.error, args.stage);
  appendDiagnostic(args.slot, {
    id: nextOpaqueId("acp-diag"),
    ts: nowIso(),
    kind: args.kind,
    level: "error",
    message: args.message,
    detail: serialized.detail,
    stage: serialized.stage,
    errorName: serialized.errorName,
    stack: serialized.stack,
    cause:
      serialized.cause === undefined
        ? undefined
        : typeof serialized.cause === "string"
          ? serialized.cause
          : JSON.stringify(serialized.cause),
    code: serialized.code,
    data: serialized.data,
    raw: serialized.raw,
  });
}

function upsertStatusItem(slot: AcpSessionSlot, args: {
  level: "info" | "warn" | "error";
  label: string;
  text: string;
}) {
  const item: AcpConversationStatusItem = {
    id: nextOpaqueId("acp-status"),
    kind: "status",
    level: args.level,
    label: args.label,
    text: args.text,
    createdAt: nowIso(),
  };
  slot.snapshot.items = [...slot.snapshot.items, item];
}

function pushItem(slot: AcpSessionSlot, item: AcpConversationItem) {
  slot.snapshot.items = [...slot.snapshot.items, item];
}

function finalizeStreamingItems(
  slot: AcpSessionSlot,
  finalState: "complete" | "error",
) {
  if (slot.activeAssistantItemId) {
    const target = slot.snapshot.items.find(
      (entry) =>
        entry.id === slot.activeAssistantItemId && entry.kind === "message",
    ) as AcpConversationMessageItem | undefined;
    if (target) {
      target.state = finalState;
      target.updatedAt = nowIso();
    }
    slot.activeAssistantItemId = "";
  }
  if (slot.activeThoughtItemId) {
    const target = slot.snapshot.items.find(
      (entry) =>
        entry.id === slot.activeThoughtItemId && entry.kind === "thought",
    ) as AcpConversationThoughtItem | undefined;
    if (target) {
      target.state = finalState;
      target.updatedAt = nowIso();
    }
    slot.activeThoughtItemId = "";
  }
  slot.activePlanItemId = "";
}

function normalizeModeOption(args: {
  id: string;
  name?: string | null;
  description?: string | null;
}): AcpSelectableOption {
  return {
    id: String(args.id || "").trim(),
    label: String(args.name || args.id || "").trim(),
    description: String(args.description || "").trim() || undefined,
  };
}

function applyModeState(
  slot: AcpSessionSlot,
  value: {
    currentModeId?: string | null;
    availableModes?: Array<{ id: string; name: string; description?: string | null }> | null;
  },
) {
  const availableModes = Array.isArray(value.availableModes)
    ? value.availableModes
        .map((entry) =>
          normalizeModeOption({
            id: entry.id,
            name: entry.name,
            description: entry.description,
          }),
        )
        .filter((entry) => entry.id && entry.label)
    : slot.snapshot.modeOptions;
  slot.snapshot.modeOptions = availableModes;
  const currentModeId = String(
    value.currentModeId || slot.snapshot.currentMode?.id || "",
  ).trim();
  slot.snapshot.currentMode =
    availableModes.find((entry) => entry.id === currentModeId) ||
    (currentModeId
      ? {
          id: currentModeId,
          label: currentModeId,
        }
    : undefined);
}

const KNOWN_REASONING_EFFORT_ORDER = [
  "default",
  "low",
  "medium",
  "high",
  "xhigh",
];

type ParsedModelEffort = {
  raw: AcpSelectableOption;
  baseId: string;
  baseLabel: string;
  effortId: string;
};

type FoldedModelGroup = {
  baseId: string;
  baseLabel: string;
  variants: ParsedModelEffort[];
};

function normalizeEffortId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function toTitleCase(value: string) {
  return String(value || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stripKnownEffortSuffix(value: string, effortId: string) {
  const escaped = effortId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(value || "")
    .replace(new RegExp(`\\s*@\\s*${escaped}\\s*$`, "i"), "")
    .replace(new RegExp(`\\s*\\(\\s*${escaped}\\s*\\)\\s*$`, "i"), "")
    .replace(new RegExp(`\\s+-\\s+${escaped}\\s*$`, "i"), "")
    .replace(new RegExp(`[-_]${escaped}\\s*$`, "i"), "")
    .replace(new RegExp(`\\s+${escaped}\\s*$`, "i"), "")
    .trim();
}

function parseEffortFromModelText(value: string) {
  const text = String(value || "").trim();
  const atMatch = /^(.*)@([A-Za-z][A-Za-z0-9_-]*)$/.exec(text);
  if (atMatch && atMatch[1].trim() && atMatch[2].trim()) {
    return {
      baseId: atMatch[1].trim(),
      effortId: normalizeEffortId(atMatch[2]),
    };
  }

  const known = KNOWN_REASONING_EFFORT_ORDER.join("|");
  const bracketMatch = new RegExp(`^(.*)\\(\\s*(${known})\\s*\\)$`, "i").exec(text);
  if (bracketMatch && bracketMatch[1].trim()) {
    return {
      baseId: bracketMatch[1].trim(),
      effortId: normalizeEffortId(bracketMatch[2]),
    };
  }

  const dashMatch = new RegExp(`^(.*)(?:\\s+-\\s+|[-_])(${known})$`, "i").exec(text);
  if (dashMatch && dashMatch[1].trim()) {
    return {
      baseId: dashMatch[1].trim(),
      effortId: normalizeEffortId(dashMatch[2]),
    };
  }

  return null;
}

function parseModelEffortVariant(option: AcpSelectableOption): ParsedModelEffort | null {
  const parsed = parseEffortFromModelText(option.id) ||
    parseEffortFromModelText(option.label);
  if (!parsed) {
    return null;
  }
  const strippedLabel =
    stripKnownEffortSuffix(option.label, parsed.effortId) ||
    stripKnownEffortSuffix(parsed.baseId, parsed.effortId);
  return {
    raw: option,
    baseId: parsed.baseId,
    baseLabel: strippedLabel || parsed.baseId,
    effortId: parsed.effortId,
  };
}

function compareEffortIds(left: string, right: string) {
  const leftIndex = KNOWN_REASONING_EFFORT_ORDER.indexOf(left);
  const rightIndex = KNOWN_REASONING_EFFORT_ORDER.indexOf(right);
  if (leftIndex >= 0 || rightIndex >= 0) {
    return (leftIndex >= 0 ? leftIndex : 999) - (rightIndex >= 0 ? rightIndex : 999);
  }
  return left.localeCompare(right);
}

function buildFoldedModelGroups(modelOptions: AcpSelectableOption[]) {
  const grouped = new Map<string, FoldedModelGroup>();
  for (const option of modelOptions) {
    const parsed = parseModelEffortVariant(option);
    if (!parsed) {
      continue;
    }
    const existing = grouped.get(parsed.baseId);
    if (existing) {
      existing.variants.push(parsed);
    } else {
      grouped.set(parsed.baseId, {
        baseId: parsed.baseId,
        baseLabel: parsed.baseLabel,
        variants: [parsed],
      });
    }
  }

  for (const [baseId, group] of Array.from(grouped.entries())) {
    const uniqueEfforts = new Set(group.variants.map((entry) => entry.effortId));
    if (uniqueEfforts.size <= 1) {
      grouped.delete(baseId);
      continue;
    }
    group.variants = group.variants
      .slice()
      .sort((left, right) => compareEffortIds(left.effortId, right.effortId));
  }
  return grouped;
}

function deriveModelEffortState(snapshot: AcpConversationSnapshot) {
  const rawOptions = snapshot.modelOptions.map((entry) => ({ ...entry }));
  const groups = buildFoldedModelGroups(rawOptions);
  const displayOptions: AcpSelectableOption[] = [];
  const emittedGroups = new Set<string>();

  for (const option of rawOptions) {
    const parsed = parseModelEffortVariant(option);
    if (parsed && groups.has(parsed.baseId)) {
      if (!emittedGroups.has(parsed.baseId)) {
        const group = groups.get(parsed.baseId);
        displayOptions.push({
          id: parsed.baseId,
          label: group?.baseLabel || parsed.baseLabel || parsed.baseId,
          description: option.description,
        });
        emittedGroups.add(parsed.baseId);
      }
      continue;
    }
    displayOptions.push({ ...option });
  }

  snapshot.displayModelOptions = displayOptions;
  const currentRawId = String(snapshot.currentModel?.id || "").trim();
  const currentParsed = currentRawId
    ? parseModelEffortVariant({
        id: currentRawId,
        label: snapshot.currentModel?.label || currentRawId,
        description: snapshot.currentModel?.description,
      })
    : null;
  const activeGroup =
    currentParsed && groups.has(currentParsed.baseId)
      ? groups.get(currentParsed.baseId)
      : null;

  if (activeGroup) {
    snapshot.currentDisplayModel =
      displayOptions.find((entry) => entry.id === activeGroup.baseId) || {
        id: activeGroup.baseId,
        label: activeGroup.baseLabel,
      };
    snapshot.reasoningEffortOptions = activeGroup.variants.map((entry) => ({
      id: entry.effortId,
      label: toTitleCase(entry.effortId),
      description: entry.raw.description,
    }));
    snapshot.currentReasoningEffort =
      snapshot.reasoningEffortOptions.find(
        (entry) => entry.id === currentParsed?.effortId,
      ) || snapshot.reasoningEffortOptions[0];
    return;
  }

  snapshot.currentDisplayModel =
    displayOptions.find((entry) => entry.id === currentRawId) ||
    (snapshot.currentModel ? { ...snapshot.currentModel } : undefined);
  snapshot.reasoningEffortOptions = [];
  snapshot.currentReasoningEffort = undefined;
}

function resolveRawModelIdForSelection(
  snapshot: AcpConversationSnapshot,
  displayModelId: string,
  effortIdRaw?: string,
) {
  const displayId = String(displayModelId || "").trim();
  if (!displayId) {
    return "";
  }
  const groups = buildFoldedModelGroups(snapshot.modelOptions);
  const group = groups.get(displayId);
  if (group) {
    const currentVariant = snapshot.currentModel
      ? parseModelEffortVariant(snapshot.currentModel)
      : null;
    const effortId =
      normalizeEffortId(effortIdRaw) ||
      normalizeEffortId(snapshot.currentReasoningEffort?.id) ||
      normalizeEffortId(currentVariant?.effortId);
    const selected =
      group.variants.find((entry) => entry.effortId === effortId) ||
      group.variants.find((entry) => entry.effortId === "default") ||
      group.variants[0];
    return selected?.raw.id || displayId;
  }
  return snapshot.modelOptions.find((entry) => entry.id === displayId)?.id || displayId;
}

function applyModelState(
  slot: AcpSessionSlot,
  value: {
    currentModelId?: string | null;
    availableModels?: Array<{
      modelId: string;
      name: string;
      description?: string | null;
    }> | null;
  },
) {
  const availableModels = Array.isArray(value.availableModels)
    ? value.availableModels
        .map((entry) => ({
          id: String(entry.modelId || "").trim(),
          label: String(entry.name || entry.modelId || "").trim(),
          description: String(entry.description || "").trim() || undefined,
        }))
        .filter((entry) => entry.id && entry.label)
    : slot.snapshot.modelOptions;
  slot.snapshot.modelOptions = availableModels;
  const currentModelId = String(
    value.currentModelId || slot.snapshot.currentModel?.id || "",
  ).trim();
  slot.snapshot.currentModel =
    availableModels.find((entry) => entry.id === currentModelId) ||
    (currentModelId
      ? {
          id: currentModelId,
          label: currentModelId,
        }
      : undefined);
  deriveModelEffortState(slot.snapshot);
}

function handleSessionUpdate(
  slot: AcpSessionSlot,
  event: {
    sessionId: string;
    update: {
      sessionUpdate: string;
      [key: string]: unknown;
    };
  },
) {
  if (
    String(event.sessionId || "").trim() !==
    String(slot.snapshot.sessionId || "").trim()
  ) {
    return;
  }
  const update = event.update;
  switch (String(update.sessionUpdate || "").trim()) {
    case "agent_message_chunk": {
      slot.snapshot.lastLifecycleEvent = "agent_message_chunk";
      const content = update.content as { type?: string; text?: string } | undefined;
      if (String(content?.type || "").trim() !== "text") {
        return;
      }
      const chunk = String(content?.text || "");
      if (!chunk) {
        return;
      }
      let target = slot.snapshot.items.find(
        (entry) =>
          entry.id === slot.activeAssistantItemId && entry.kind === "message",
      ) as AcpConversationMessageItem | undefined;
      if (!target) {
        target = {
          id: nextOpaqueId("acp-msg-assistant"),
          kind: "message",
          role: "assistant",
          text: "",
          createdAt: nowIso(),
          state: "streaming",
        };
        slot.activeAssistantItemId = target.id;
        pushItem(slot, target);
      }
      target.text += chunk;
      target.state = "streaming";
      target.updatedAt = nowIso();
      emitSlotSnapshot(slot, { throttleUi: true, throttlePersist: true });
      return;
    }
    case "agent_thought_chunk": {
      slot.snapshot.lastLifecycleEvent = "agent_thought_chunk";
      const content = update.content as { type?: string; text?: string } | undefined;
      if (String(content?.type || "").trim() !== "text") {
        return;
      }
      const chunk = String(content?.text || "");
      if (!chunk) {
        return;
      }
      let target = slot.snapshot.items.find(
        (entry) =>
          entry.id === slot.activeThoughtItemId && entry.kind === "thought",
      ) as AcpConversationThoughtItem | undefined;
      if (!target) {
        target = {
          id: nextOpaqueId("acp-thought"),
          kind: "thought",
          text: "",
          createdAt: nowIso(),
          state: "streaming",
        };
        slot.activeThoughtItemId = target.id;
        pushItem(slot, target);
      }
      target.text += chunk;
      target.state = "streaming";
      target.updatedAt = nowIso();
      emitSlotSnapshot(slot, { throttleUi: true, throttlePersist: true });
      return;
    }
    case "tool_call": {
      slot.snapshot.lastLifecycleEvent = "tool_call";
      pushItem(slot, {
        id: nextOpaqueId("acp-tool"),
        kind: "tool_call",
        toolCallId: String(update.toolCallId || "").trim(),
        title: String(update.title || "Tool Call"),
        toolKind: String(update.kind || "").trim() || undefined,
        state:
          update.status === "pending" ||
          update.status === "failed" ||
          update.status === "in_progress"
            ? update.status
            : "completed",
        createdAt: nowIso(),
        summary: "",
      });
      emitSlotSnapshot(slot);
      return;
    }
    case "tool_call_update": {
      slot.snapshot.lastLifecycleEvent = "tool_call_update";
      const toolCallId = String(update.toolCallId || "").trim();
      const target = slot.snapshot.items.find(
        (entry) => entry.kind === "tool_call" && entry.toolCallId === toolCallId,
      ) as AcpConversationToolCallItem | undefined;
      const nextState =
        update.status === "pending" ||
        update.status === "failed" ||
        update.status === "in_progress"
          ? update.status
          : "completed";
      if (!target) {
        pushItem(slot, {
          id: nextOpaqueId("acp-tool"),
          kind: "tool_call",
          toolCallId,
          title: String(update.title || "Tool Call"),
          toolKind: String(update.kind || "").trim() || undefined,
          state: nextState,
          createdAt: nowIso(),
          summary: "",
        });
      } else {
        target.title = String(update.title || target.title);
        target.toolKind =
          String(update.kind || target.toolKind || "").trim() || target.toolKind;
        target.state = nextState;
        target.summary = String(update.title || "").trim() || target.summary || undefined;
        target.updatedAt = nowIso();
      }
      emitSlotSnapshot(slot);
      return;
    }
    case "plan": {
      slot.snapshot.lastLifecycleEvent = "plan";
      const entries = Array.isArray(update.entries)
        ? update.entries.map((entry) => ({
            content: String(entry?.content || ""),
            priority: String(entry?.priority || ""),
            status: String(entry?.status || ""),
          }))
        : [];
      let target = slot.snapshot.items.find(
        (entry) => entry.id === slot.activePlanItemId && entry.kind === "plan",
      ) as AcpConversationPlanItem | undefined;
      if (!target) {
        target = {
          id: nextOpaqueId("acp-plan"),
          kind: "plan",
          entries,
          createdAt: nowIso(),
        };
        slot.activePlanItemId = target.id;
        pushItem(slot, target);
      } else {
        target.entries = entries;
        target.updatedAt = nowIso();
      }
      emitSlotSnapshot(slot);
      return;
    }
    case "available_commands_update": {
      slot.snapshot.lastLifecycleEvent = "available_commands_update";
      slot.snapshot.availableCommands = Array.isArray(update.availableCommands)
        ? update.availableCommands
            .map((entry) => ({
              name: String(entry?.name || "").trim(),
              title: String(entry?.title || "").trim() || undefined,
              description: String(entry?.description || "").trim() || undefined,
            }))
            .filter((entry) => entry.name)
        : [];
      emitSlotSnapshot(slot);
      return;
    }
    case "current_mode_update": {
      slot.snapshot.lastLifecycleEvent = "current_mode_update";
      applyModeState(slot, {
        currentModeId: String(update.currentModeId || "").trim(),
      });
      emitSlotSnapshot(slot);
      return;
    }
    case "config_option_update": {
      slot.snapshot.lastLifecycleEvent = "config_option_update";
      upsertStatusItem(slot, {
        level: "info",
        label: "Config",
        text: "Session configuration options updated.",
      });
      emitSlotSnapshot(slot);
      return;
    }
    case "session_info_update": {
      slot.snapshot.lastLifecycleEvent = "session_info_update";
      slot.snapshot.sessionTitle = String(update.title || "").trim();
      slot.snapshot.sessionUpdatedAt = String(update.updatedAt || "").trim();
      emitSlotSnapshot(slot);
      return;
    }
    case "usage_update": {
      slot.snapshot.lastLifecycleEvent = "usage_update";
      const used = Number(update.used || 0);
      const size = Number(update.size || 0);
      if (Number.isFinite(used) && Number.isFinite(size)) {
        slot.snapshot.usage = {
          used: Math.max(0, Math.floor(used)),
          size: Math.max(0, Math.floor(size)),
        };
      }
      emitSlotSnapshot(slot);
      return;
    }
    default:
      return;
  }
}

function bindAdapter(slot: AcpSessionSlot, nextAdapter: AcpConnectionAdapter) {
  slot.unsubscribeUpdate = nextAdapter.onUpdate(async (event) => {
    handleSessionUpdate(
      slot,
      event as Parameters<typeof handleSessionUpdate>[1],
    );
  });
  slot.unsubscribeClose = nextAdapter.onClose((event) => {
    if (slot.suppressCloseEvent) {
      return;
    }
    slot.adapter = null;
    slot.pendingPermissionResolver = null;
    slot.snapshot.busy = false;
    slot.snapshot.pendingPermissionRequest = null;
    slot.snapshot.status = slot.snapshot.status === "idle" ? "idle" : "error";
    if (event?.stderrText) {
      slot.snapshot.stderrTail = event.stderrText;
      appendDiagnostic(slot, {
        id: nextOpaqueId("acp-diag"),
        ts: nowIso(),
        kind: "stderr",
        level: "warn",
        message: "ACP stderr",
        detail: event.stderrText,
      });
    }
    slot.snapshot.lastLifecycleEvent = "exited";
    if (!slot.snapshot.lastError) {
      slot.snapshot.lastError =
        String(event?.message || "").trim() || "ACP connection closed";
    }
    emitSlotSnapshot(slot);
  });
  slot.unsubscribeDiagnostics = nextAdapter.onDiagnostics((entry) => {
    appendDiagnostic(slot, entry);
    emitSlotSnapshot(slot, {
      persist: false,
      throttleUi: true,
    });
  });
  slot.unsubscribePermission = nextAdapter.onPermissionRequest((request) => {
    slot.pendingPermissionResolver = request.resolve;
    slot.snapshot.pendingPermissionRequest = {
      requestId: request.requestId,
      sessionId: request.sessionId,
      toolCallId: request.toolCallId,
      toolTitle: request.toolTitle,
      requestedAt: request.requestedAt,
      options: request.options.map((entry) => ({ ...entry })),
    };
    slot.snapshot.status = "permission-required";
    slot.snapshot.busy = true;
    emitSlotSnapshot(slot);
  });
}

async function disconnectSlotAdapter(slot: AcpSessionSlot) {
  slot.pendingPermissionResolver = null;
  if (!slot.adapter) {
    return;
  }
  slot.suppressCloseEvent = true;
  slot.unsubscribeUpdate?.();
  slot.unsubscribeClose?.();
  slot.unsubscribeDiagnostics?.();
  slot.unsubscribePermission?.();
  slot.unsubscribeUpdate = null;
  slot.unsubscribeClose = null;
  slot.unsubscribeDiagnostics = null;
  slot.unsubscribePermission = null;
  const current = slot.adapter;
  slot.adapter = null;
  try {
    await current.close();
  } finally {
    slot.suppressCloseEvent = false;
  }
}

async function ensureAdapter(backendId?: string) {
  ensureInitialized();
  const slot = getOrCreateSlot(backendId || activeBackendId);
  if (slot.adapter) {
    return { slot, adapter: slot.adapter };
  }
  const backend = await resolveBackendForSlot(slot);
  slot.snapshot.sessionId = "";
  slot.snapshot.lastError = "";
  slot.snapshot.prerequisiteError = "";
  slot.snapshot.stderrTail = "";
  slot.snapshot.pendingPermissionRequest = null;
  slot.snapshot.status = "checking-command";
  emitSlotSnapshot(slot);
  try {
    const nextAdapter = await adapterFactory({
      backend,
      sessionCwd: slot.snapshot.sessionCwd,
      workspaceDir: slot.snapshot.workspaceDir,
      runtimeDir: slot.snapshot.runtimeDir,
    });
    bindAdapter(slot, nextAdapter);
    slot.snapshot.status = "spawning";
    emitSlotSnapshot(slot);
    const initializedAdapter = await nextAdapter.initialize();
    slot.snapshot.authMethods = initializedAdapter.authMethods.map((entry) => ({
      ...entry,
    }));
    slot.snapshot.commandLabel = initializedAdapter.commandLabel;
    slot.snapshot.commandLine = initializedAdapter.commandLine;
    slot.snapshot.agentLabel = initializedAdapter.agentName;
    slot.snapshot.agentVersion = initializedAdapter.agentVersion;
    slot.snapshot.status = "initializing";
    slot.adapter = nextAdapter;
    emitSlotSnapshot(slot);
    return { slot, adapter: nextAdapter };
  } catch (error) {
    await disconnectSlotAdapter(slot);
    slot.snapshot.busy = false;
    slot.snapshot.status = "error";
    slot.snapshot.lastError = compactError(error);
    slot.snapshot.prerequisiteError = slot.snapshot.lastError;
    appendErrorDiagnostic({
      slot,
      kind: "command_check",
      message: "Failed to initialize ACP backend",
      error,
      stage: "ensure_adapter",
    });
    emitSlotSnapshot(slot);
    throw error;
  }
}

async function ensureSession(backendId?: string) {
  const { slot, adapter } = await ensureAdapter(backendId);
  if (slot.snapshot.sessionId) {
    return { slot, adapter };
  }
  try {
    const created = await adapter.newSession();
    slot.snapshot.sessionId = String(created.sessionId || "").trim();
    slot.snapshot.sessionTitle = String(created.sessionTitle || "").trim();
    slot.snapshot.sessionUpdatedAt = String(created.sessionUpdatedAt || "").trim();
    applyModeState(slot, created.modes || {});
    applyModelState(slot, created.models || {});
    slot.snapshot.status = "connected";
    slot.snapshot.busy = false;
    emitSlotSnapshot(slot);
    return { slot, adapter };
  } catch (error) {
    if (error instanceof AcpAuthRequiredError) {
      slot.snapshot.busy = false;
      slot.snapshot.status = "auth-required";
      slot.snapshot.authMethods = error.authMethods.map((entry) => ({ ...entry }));
      slot.snapshot.lastError = error.message;
      emitSlotSnapshot(slot);
    }
    throw error;
  }
}

function buildBackendSummary(backend: BackendInstance) {
  const slot = getOrCreateSlot(backend.id);
  slot.snapshot.backend = backend;
  const lastError =
    String(slot.snapshot.prerequisiteError || "").trim() ||
    String(slot.snapshot.lastError || "").trim();
  return {
    backendId: backend.id,
    displayName: String(backend.displayName || backend.id).trim(),
    status: slot.snapshot.status,
    busy: slot.snapshot.busy,
    connected:
      slot.snapshot.status === "connected" ||
      slot.snapshot.status === "prompting" ||
      slot.adapter !== null,
    messageCount: slot.snapshot.items.length,
    lastError,
    updatedAt: slot.snapshot.updatedAt,
  };
}

function buildFrontendSnapshot(): AcpFrontendSnapshot {
  ensureInitialized();
  const activeSlot = getOrCreateSlot(activeBackendId);
  const knownBackends =
    cachedAcpBackends.length > 0
      ? cachedAcpBackends
      : activeSlot.snapshot.backend
        ? [activeSlot.snapshot.backend]
        : [
            {
              id: activeSlot.backendId,
              displayName: activeSlot.backendId,
              type: ACP_BACKEND_TYPE,
              baseUrl: `local://${activeSlot.backendId}`,
              command: "",
            },
          ];
  const summaries = knownBackends.map((backend) => buildBackendSummary(backend));
  return {
    activeBackendId,
    backends: summaries,
    activeSnapshot: cloneSnapshotValue(activeSlot.snapshot),
    connectedCount: summaries.filter((entry) => entry.connected).length,
    errorCount: summaries.filter((entry) => entry.status === "error").length,
    totalMessageCount: summaries.reduce((sum, entry) => sum + entry.messageCount, 0),
    updatedAt: nowIso(),
  };
}

export function getAcpFrontendSnapshot() {
  return buildFrontendSnapshot();
}

export function subscribeAcpFrontendSnapshots(listener: AcpFrontendSnapshotListener) {
  frontendListeners.add(listener);
  listener(getAcpFrontendSnapshot());
  return () => {
    frontendListeners.delete(listener);
  };
}

export function getAcpConversationSnapshot(backendId?: string) {
  ensureInitialized();
  return cloneSnapshotValue(getOrCreateSlot(backendId || activeBackendId).snapshot);
}

export function subscribeAcpConversationSnapshots(listener: AcpSnapshotListener) {
  listeners.add(listener);
  listener(getAcpConversationSnapshot());
  return () => {
    listeners.delete(listener);
  };
}

export async function setActiveAcpBackend(args: { backendId: string }) {
  ensureInitialized();
  const backendId = normalizeBackendId(args.backendId);
  if (!backendId || backendId === activeBackendId) {
    return;
  }
  await refreshAcpBackends();
  if (!cachedAcpBackends.some((entry) => entry.id === backendId)) {
    throw new Error(`ACP backend "${backendId}" is not available`);
  }
  activeBackendId = backendId;
  saveAcpFrontendState({ activeBackendId });
  const slot = getOrCreateSlot(backendId);
  notifyConversationListenersNow(slot);
  notifyFrontendListenersNow();
}

export async function ensureAcpConversationReady(backendId?: string) {
  ensureInitialized();
  await refreshAcpBackends();
  await ensureSession(backendId || activeBackendId);
}

export async function sendAcpConversationPrompt(args: {
  message: string;
  hostContext?: AcpHostContext;
  backendId?: string;
}) {
  ensureInitialized();
  const message = String(args.message || "").trim();
  if (!message) {
    throw new Error("ACP message is required");
  }
  const { slot, adapter } = await ensureSession(args.backendId || activeBackendId);
  if (!slot.snapshot.conversationId) {
    slot.snapshot.conversationId = nextOpaqueId("acp-conversation");
  }
  pushItem(slot, {
    id: nextOpaqueId("acp-msg-user"),
    kind: "message",
    role: "user",
    text: message,
    createdAt: nowIso(),
    state: "complete",
  });
  slot.activeAssistantItemId = "";
  slot.activeThoughtItemId = "";
  slot.activePlanItemId = "";
  slot.snapshot.busy = true;
  slot.snapshot.status = "prompting";
  slot.snapshot.lastError = "";
  slot.snapshot.prerequisiteError = "";
  slot.snapshot.lastStopReason = "";
  slot.snapshot.pendingPermissionRequest = null;
  slot.snapshot.lastHostContext = args.hostContext
    ? JSON.parse(JSON.stringify(args.hostContext))
    : null;
  emitSlotSnapshot(slot);
  try {
    const response = await adapter.prompt({
      sessionId: slot.snapshot.sessionId,
      message,
      hostContext: args.hostContext,
    });
    slot.snapshot.busy = false;
    slot.snapshot.status = "connected";
    slot.snapshot.lastStopReason = String(response.stopReason || "").trim();
    finalizeStreamingItems(slot, "complete");
    emitSlotSnapshot(slot);
  } catch (error) {
    slot.snapshot.busy = false;
    finalizeStreamingItems(slot, "error");
    if (error instanceof AcpAuthRequiredError) {
      slot.snapshot.status = "auth-required";
      slot.snapshot.authMethods = error.authMethods.map((entry) => ({ ...entry }));
      slot.snapshot.lastError = error.message;
    } else {
      slot.snapshot.status = "error";
      slot.snapshot.lastError = compactError(error);
      slot.snapshot.prerequisiteError =
        slot.snapshot.prerequisiteError || slot.snapshot.lastError;
    }
    emitSlotSnapshot(slot);
    throw error;
  }
}

export async function cancelAcpConversationPrompt(args?: { backendId?: string }) {
  ensureInitialized();
  const slot = getOrCreateSlot(args?.backendId || activeBackendId);
  if (!slot.adapter || !slot.snapshot.sessionId) {
    return;
  }
  await slot.adapter.cancel({
    sessionId: slot.snapshot.sessionId,
  });
}

export async function startNewAcpConversation(args?: { backendId?: string }) {
  ensureInitialized();
  const slot = getOrCreateSlot(args?.backendId || activeBackendId);
  await disconnectSlotAdapter(slot);
  const preservedBackend = slot.snapshot.backend;
  const preservedBackendId = slot.snapshot.backendId || slot.backendId;
  const preservedDiagnosticsVisibility = slot.snapshot.showDiagnostics;
  const preservedStatusExpanded = slot.snapshot.statusExpanded;
  const preservedChatDisplayMode = slot.snapshot.chatDisplayMode;
  slot.snapshot = {
    ...createEmptyAcpConversationSnapshot(),
    backend: preservedBackend,
    backendId: preservedBackendId,
    conversationId: nextOpaqueId("acp-conversation"),
    showDiagnostics: preservedDiagnosticsVisibility,
    statusExpanded: preservedStatusExpanded,
    chatDisplayMode: preservedChatDisplayMode,
    sessionCwd: slot.snapshot.sessionCwd,
    workspaceDir: slot.snapshot.workspaceDir,
    runtimeDir: slot.snapshot.runtimeDir,
    updatedAt: nowIso(),
  };
  slot.activeAssistantItemId = "";
  slot.activeThoughtItemId = "";
  slot.activePlanItemId = "";
  clearAcpConversationState(slot.backendId);
  emitSlotSnapshot(slot);
}

export async function reconnectAcpConversation(args?: { backendId?: string }) {
  ensureInitialized();
  const slot = getOrCreateSlot(args?.backendId || activeBackendId);
  await disconnectSlotAdapter(slot);
  slot.snapshot.sessionId = "";
  slot.snapshot.busy = false;
  slot.snapshot.status = "idle";
  slot.snapshot.lastError = "";
  slot.snapshot.prerequisiteError = "";
  slot.snapshot.stderrTail = "";
  slot.snapshot.pendingPermissionRequest = null;
  emitSlotSnapshot(slot);
  await ensureSession(slot.backendId);
}

export async function authenticateAcpConversation(args: {
  methodId?: string;
  backendId?: string;
}) {
  ensureInitialized();
  const slot = getOrCreateSlot(args.backendId || activeBackendId);
  const methodId =
    String(args.methodId || "").trim() || slot.snapshot.authMethods[0]?.id || "";
  if (!methodId) {
    throw new Error("ACP authentication method is required");
  }
  const ensured = await ensureAdapter(slot.backendId);
  ensured.slot.snapshot.status = "initializing";
  ensured.slot.snapshot.lastError = "";
  ensured.slot.snapshot.prerequisiteError = "";
  emitSlotSnapshot(ensured.slot);
  await ensured.adapter.authenticate({ methodId });
  ensured.slot.snapshot.sessionId = "";
  await ensureSession(ensured.slot.backendId);
}

export async function resolveAcpConversationPermission(args: {
  outcome: "selected" | "cancelled";
  optionId?: string;
  backendId?: string;
}) {
  ensureInitialized();
  const slot = getOrCreateSlot(args.backendId || activeBackendId);
  if (!slot.pendingPermissionResolver) {
    return;
  }
  const resolver = slot.pendingPermissionResolver;
  slot.pendingPermissionResolver = null;
  const optionId =
    String(args.optionId || "").trim() ||
    slot.snapshot.pendingPermissionRequest?.options[0]?.optionId ||
    "";
  if (args.outcome === "selected" && optionId) {
    resolver({ outcome: "selected", optionId });
  } else {
    resolver({ outcome: "cancelled" });
  }
  slot.snapshot.pendingPermissionRequest = null;
  slot.snapshot.status = "prompting";
  slot.snapshot.busy = true;
  emitSlotSnapshot(slot);
}

export async function setAcpConversationMode(args: {
  modeId: string;
  backendId?: string;
}) {
  ensureInitialized();
  const modeId = String(args.modeId || "").trim();
  if (!modeId) {
    return;
  }
  const { slot, adapter } = await ensureSession(args.backendId || activeBackendId);
  await adapter.setMode({ sessionId: slot.snapshot.sessionId, modeId });
  applyModeState(slot, { currentModeId: modeId });
  emitSlotSnapshot(slot);
}

export async function setAcpConversationModel(args: {
  modelId: string;
  backendId?: string;
}) {
  ensureInitialized();
  const modelId = String(args.modelId || "").trim();
  if (!modelId) {
    return;
  }
  const { slot, adapter } = await ensureSession(args.backendId || activeBackendId);
  const rawModelId = resolveRawModelIdForSelection(
    slot.snapshot,
    modelId,
    slot.snapshot.currentReasoningEffort?.id,
  );
  await adapter.setModel({ sessionId: slot.snapshot.sessionId, modelId: rawModelId });
  applyModelState(slot, { currentModelId: rawModelId });
  emitSlotSnapshot(slot);
}

export async function setAcpConversationReasoningEffort(args: {
  effortId: string;
  backendId?: string;
}) {
  ensureInitialized();
  const effortId = normalizeEffortId(args.effortId);
  if (!effortId) {
    return;
  }
  const { slot, adapter } = await ensureSession(args.backendId || activeBackendId);
  const displayModelId =
    String(slot.snapshot.currentDisplayModel?.id || "").trim() ||
    String(slot.snapshot.currentModel?.id || "").trim();
  if (!displayModelId) {
    return;
  }
  const rawModelId = resolveRawModelIdForSelection(
    slot.snapshot,
    displayModelId,
    effortId,
  );
  await adapter.setModel({ sessionId: slot.snapshot.sessionId, modelId: rawModelId });
  applyModelState(slot, { currentModelId: rawModelId });
  emitSlotSnapshot(slot);
}

export function toggleAcpConversationDiagnostics(args?: {
  visible?: boolean;
  backendId?: string;
}) {
  ensureInitialized();
  const slot = getOrCreateSlot(args?.backendId || activeBackendId);
  slot.snapshot.showDiagnostics =
    typeof args?.visible === "boolean" ? args.visible : !slot.snapshot.showDiagnostics;
  emitSlotSnapshot(slot);
}

export function setAcpConversationChatDisplayMode(args: {
  mode: AcpChatDisplayMode;
  backendId?: string;
}) {
  ensureInitialized();
  const slot = getOrCreateSlot(args.backendId || activeBackendId);
  slot.snapshot.chatDisplayMode = args.mode === "bubble" ? "bubble" : "plain";
  emitSlotSnapshot(slot);
}

export function toggleAcpConversationStatusDetails(args?: {
  expanded?: boolean;
  backendId?: string;
}) {
  ensureInitialized();
  const slot = getOrCreateSlot(args?.backendId || activeBackendId);
  slot.snapshot.statusExpanded =
    typeof args?.expanded === "boolean"
      ? args.expanded
      : !slot.snapshot.statusExpanded;
  emitSlotSnapshot(slot);
}

export function buildAcpDiagnosticsBundle(backendId?: string): AcpDiagnosticsBundle {
  ensureInitialized();
  const slot = getOrCreateSlot(backendId || activeBackendId);
  const snapshot = slot.snapshot;
  return {
    schema: "zotero-skills.acp.diagnostics.v1",
    generatedAt: nowIso(),
    host: serializeRuntimeHost(),
    backend: snapshot.backend
      ? {
          id: String(snapshot.backend.id || "").trim(),
          type: String(snapshot.backend.type || "").trim() || undefined,
          displayName:
            String(snapshot.backend.displayName || "").trim() || undefined,
          command: String(snapshot.backend.command || "").trim() || undefined,
          args: Array.isArray(snapshot.backend.args)
            ? snapshot.backend.args.map((entry) => String(entry))
            : [],
        }
      : null,
    connection: {
      status: snapshot.status,
      busy: snapshot.busy,
      conversationId: snapshot.conversationId,
      sessionId: snapshot.sessionId,
      commandLabel: snapshot.commandLabel,
      commandLine: snapshot.commandLine,
      sessionCwd: snapshot.sessionCwd,
      workspaceDir: snapshot.workspaceDir,
      runtimeDir: snapshot.runtimeDir,
      lastError: snapshot.lastError,
      prerequisiteError: snapshot.prerequisiteError,
      stderrTail: snapshot.stderrTail,
      lastLifecycleEvent: snapshot.lastLifecycleEvent,
      updatedAt: snapshot.updatedAt,
    },
    diagnostics: snapshot.diagnostics.map((entry) => ({ ...entry })),
    recentItems: snapshot.items.slice(-12).map((entry) => cloneAcpConversationItem(entry)),
    lastHostContext: snapshot.lastHostContext
      ? JSON.parse(JSON.stringify(snapshot.lastHostContext))
      : null,
  };
}

export function pruneAcpSessionSlotsForBackends(backends: BackendInstance[]) {
  ensureInitialized();
  const remainingAcpIds = new Set(
    backends
      .filter((entry) => normalizeBackendId(entry.type) === ACP_BACKEND_TYPE)
      .map((entry) => entry.id),
  );
  for (const [backendId, slot] of Array.from(slots.entries())) {
    if (remainingAcpIds.has(backendId)) {
      continue;
    }
    void disconnectSlotAdapter(slot);
    clearAcpConversationState(backendId);
    slots.delete(backendId);
  }
  cachedAcpBackends = backends.filter(
    (entry) => normalizeBackendId(entry.type) === ACP_BACKEND_TYPE,
  );
  if (!remainingAcpIds.has(activeBackendId)) {
    activeBackendId = cachedAcpBackends[0]?.id || "";
    if (activeBackendId) {
      getOrCreateSlot(activeBackendId);
    }
    saveAcpFrontendState({ activeBackendId });
  }
  notifyFrontendListenersNow();
  if (activeBackendId) {
    notifyConversationListenersNow(getOrCreateSlot(activeBackendId));
  }
}

export async function shutdownAcpSessionManager() {
  const pending: Promise<unknown>[] = [];
  for (const slot of slots.values()) {
    if (slot.uiEmitTimer) {
      clearTimeout(slot.uiEmitTimer);
      slot.uiEmitTimer = null;
    }
    if (slot.persistTimer) {
      flushPendingPersistence(slot);
    }
    pending.push(disconnectSlotAdapter(slot));
  }
  await Promise.allSettled(pending);
  slots.clear();
  listeners.clear();
  frontendListeners.clear();
  cachedAcpBackends = [];
  activeBackendId = "";
  initialized = false;
}

export function setAcpConnectionAdapterFactoryForTests(
  factory?: (
    args: AcpConnectionAdapterFactoryArgs,
  ) => Promise<AcpConnectionAdapter>,
) {
  adapterFactory = factory || createAcpConnectionAdapter;
}

export function resetAcpSessionManagerForTests() {
  for (const slot of slots.values()) {
    if (slot.uiEmitTimer) {
      clearTimeout(slot.uiEmitTimer);
    }
    if (slot.persistTimer) {
      clearTimeout(slot.persistTimer);
    }
    slot.unsubscribeUpdate?.();
    slot.unsubscribeClose?.();
    slot.unsubscribeDiagnostics?.();
    slot.unsubscribePermission?.();
  }
  slots.clear();
  listeners.clear();
  frontendListeners.clear();
  cachedAcpBackends = [];
  activeBackendId = "";
  initialized = false;
}
