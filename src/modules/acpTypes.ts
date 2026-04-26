import type { BackendInstance } from "../backends/types";

export type AcpConnectionStatus =
  | "idle"
  | "checking-command"
  | "spawning"
  | "initializing"
  | "connected"
  | "prompting"
  | "auth-required"
  | "permission-required"
  | "error";

export type AcpSidebarTarget = "library" | "reader";
export type AcpChatDisplayMode = "plain" | "bubble";

export type AcpHostContext = {
  target: AcpSidebarTarget;
  libraryId?: string;
  selectionEmpty: boolean;
  currentItem?: {
    id?: number;
    key?: string;
    title?: string;
  };
};

export type AcpAuthMethod = {
  id: string;
  name: string;
  description?: string;
};

export type AcpSelectableOption = {
  id: string;
  label: string;
  description?: string;
};

export type AcpAvailableCommand = {
  name: string;
  title?: string;
  description?: string;
};

export type AcpUsageSummary = {
  used: number;
  size: number;
  costText?: string;
};

export type AcpDiagnosticsEntry = {
  id: string;
  ts: string;
  kind: string;
  level: "info" | "warn" | "error";
  message: string;
  detail: string;
  stage?: string;
  errorName?: string;
  stack?: string;
  cause?: string;
  code?: string | number;
  data?: unknown;
  raw?: unknown;
};

export type AcpPermissionOption = {
  optionId: string;
  kind: string;
  name: string;
  description?: string;
};

export type AcpPendingPermissionRequest = {
  requestId: string;
  sessionId: string;
  toolCallId: string;
  toolTitle: string;
  requestedAt: string;
  options: AcpPermissionOption[];
};

export type AcpPlanEntry = {
  content: string;
  priority: string;
  status: string;
};

type AcpConversationItemBase = {
  id: string;
  kind: "message" | "thought" | "tool_call" | "plan" | "status";
  createdAt: string;
  updatedAt?: string;
};

export type AcpConversationMessageItem = AcpConversationItemBase & {
  kind: "message";
  role: "user" | "assistant" | "system";
  text: string;
  state: "complete" | "streaming" | "error";
};

export type AcpConversationThoughtItem = AcpConversationItemBase & {
  kind: "thought";
  text: string;
  state: "complete" | "streaming" | "error";
};

export type AcpConversationToolCallItem = AcpConversationItemBase & {
  kind: "tool_call";
  toolCallId: string;
  title: string;
  toolKind?: string;
  state: "pending" | "in_progress" | "completed" | "failed";
  summary?: string;
};

export type AcpConversationPlanItem = AcpConversationItemBase & {
  kind: "plan";
  entries: AcpPlanEntry[];
};

export type AcpConversationStatusItem = AcpConversationItemBase & {
  kind: "status";
  level: "info" | "warn" | "error";
  label: string;
  text: string;
};

export type AcpConversationItem =
  | AcpConversationMessageItem
  | AcpConversationThoughtItem
  | AcpConversationToolCallItem
  | AcpConversationPlanItem
  | AcpConversationStatusItem;

export type AcpConversationSnapshot = {
  backend: BackendInstance | null;
  backendId: string;
  conversationId: string;
  sessionId: string;
  status: AcpConnectionStatus;
  busy: boolean;
  showDiagnostics: boolean;
  statusExpanded: boolean;
  chatDisplayMode: AcpChatDisplayMode;
  lastError: string;
  prerequisiteError: string;
  authMethods: AcpAuthMethod[];
  authMethodIds: string[];
  commandLabel: string;
  commandLine: string;
  agentLabel: string;
  agentVersion: string;
  sessionTitle: string;
  sessionUpdatedAt: string;
  modeOptions: AcpSelectableOption[];
  currentMode?: AcpSelectableOption;
  modelOptions: AcpSelectableOption[];
  currentModel?: AcpSelectableOption;
  displayModelOptions: AcpSelectableOption[];
  currentDisplayModel?: AcpSelectableOption;
  reasoningEffortOptions: AcpSelectableOption[];
  currentReasoningEffort?: AcpSelectableOption;
  availableCommands: AcpAvailableCommand[];
  lastStopReason: string;
  usage: AcpUsageSummary | null;
  pendingPermissionRequest: AcpPendingPermissionRequest | null;
  diagnostics: AcpDiagnosticsEntry[];
  items: AcpConversationItem[];
  lastHostContext: AcpHostContext | null;
  sessionCwd: string;
  workspaceDir: string;
  runtimeDir: string;
  stderrTail: string;
  lastLifecycleEvent: string;
  updatedAt: string;
};

export type AcpBackendSummary = {
  backendId: string;
  displayName: string;
  status: AcpConnectionStatus;
  busy: boolean;
  connected: boolean;
  messageCount: number;
  lastError: string;
  updatedAt: string;
};

export type AcpFrontendSnapshot = {
  activeBackendId: string;
  backends: AcpBackendSummary[];
  activeSnapshot: AcpConversationSnapshot;
  connectedCount: number;
  errorCount: number;
  totalMessageCount: number;
  updatedAt: string;
};

export type AcpDiagnosticsBundle = {
  schema: "zotero-skills.acp.diagnostics.v1";
  generatedAt: string;
  host: {
    zoteroVersion?: string;
    platform?: string;
    isWin?: boolean;
    hasChromeUtils?: boolean;
    hasTextEncoder?: boolean;
    hasTextDecoder?: boolean;
    hasAbortController?: boolean;
    hasReadableStream?: boolean;
    hasWritableStream?: boolean;
  };
  backend: {
    id: string;
    type?: string;
    displayName?: string;
    command?: string;
    args?: string[];
  } | null;
  connection: {
    status: AcpConnectionStatus;
    busy: boolean;
    conversationId: string;
    sessionId: string;
    commandLabel: string;
    commandLine: string;
    sessionCwd: string;
    workspaceDir: string;
    runtimeDir: string;
    lastError: string;
    prerequisiteError: string;
    stderrTail: string;
    lastLifecycleEvent: string;
    updatedAt: string;
  };
  diagnostics: AcpDiagnosticsEntry[];
  recentItems: AcpConversationItem[];
  lastHostContext: AcpHostContext | null;
};

export function createEmptyAcpConversationSnapshot(): AcpConversationSnapshot {
  return {
    backend: null,
    backendId: "",
    conversationId: "",
    sessionId: "",
    status: "idle",
    busy: false,
    showDiagnostics: false,
    statusExpanded: false,
    chatDisplayMode: "plain",
    lastError: "",
    prerequisiteError: "",
    authMethods: [],
    authMethodIds: [],
    commandLabel: "",
    commandLine: "",
    agentLabel: "",
    agentVersion: "",
    sessionTitle: "",
    sessionUpdatedAt: "",
    modeOptions: [],
    currentMode: undefined,
    modelOptions: [],
    currentModel: undefined,
    displayModelOptions: [],
    currentDisplayModel: undefined,
    reasoningEffortOptions: [],
    currentReasoningEffort: undefined,
    availableCommands: [],
    lastStopReason: "",
    usage: null,
    pendingPermissionRequest: null,
    diagnostics: [],
    items: [],
    lastHostContext: null,
    sessionCwd: "",
    workspaceDir: "",
    runtimeDir: "",
    stderrTail: "",
    lastLifecycleEvent: "",
    updatedAt: new Date(0).toISOString(),
  };
}

export function normalizeAcpStatus(value: unknown): AcpConnectionStatus {
  switch (String(value || "").trim()) {
    case "checking-command":
    case "checking_command":
      return "checking-command";
    case "spawning":
      return "spawning";
    case "initializing":
      return "initializing";
    case "connected":
      return "connected";
    case "prompting":
      return "prompting";
    case "auth-required":
    case "auth_required":
      return "auth-required";
    case "permission-required":
    case "permission_required":
      return "permission-required";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

export function cloneAcpSelectableOption(
  value: AcpSelectableOption | undefined,
) {
  if (!value) {
    return undefined;
  }
  return {
    id: value.id,
    label: value.label,
    description: value.description,
  } satisfies AcpSelectableOption;
}

export function cloneAcpConversationItem(item: AcpConversationItem) {
  if (item.kind === "plan") {
    return {
      ...item,
      entries: item.entries.map((entry) => ({ ...entry })),
    } satisfies AcpConversationPlanItem;
  }
  return {
    ...item,
  } as AcpConversationItem;
}
