import { ACP_PROMPT_REQUEST_KIND } from "../config/defaults";
import type { BackendInstance } from "../backends/types";
import type {
  AcpAuthMethod,
  AcpDiagnosticsEntry,
  AcpHostContext,
  AcpPendingPermissionRequest,
} from "./acpTypes";
import {
  AcpClientConnection,
  type AcpClientTraceEvent,
  type AcpClientHandler,
} from "./acpClientConnection";
import { createAcpNdJsonMessageStream } from "./acpMessageStream";
import { launchAcpTransport } from "./acpTransport";
import { describeAcpError, serializeAcpError } from "./acpDiagnostics";
import {
  ACP_PROTOCOL_VERSION,
  type NewSessionResponse,
  type RequestPermissionOutcome,
  RequestError,
  type SessionModelState,
  type SessionModeState,
  type SessionNotification,
} from "./acpProtocol";

export type AcpConnectionUpdate = SessionNotification;
export type AcpConnectionUpdateListener = (
  update: AcpConnectionUpdate,
) => void | Promise<void>;
export type AcpConnectionCloseListener = (event?: {
  message?: string;
  stderrText?: string;
}) => void | Promise<void>;
export type AcpConnectionDiagnosticsListener = (
  entry: AcpDiagnosticsEntry,
) => void | Promise<void>;
export type AcpConnectionPermissionListener = (
  request: AcpPendingPermissionRequest & {
    resolve: (outcome: RequestPermissionOutcome) => void;
  },
) => void | Promise<void>;

export type AcpConnectionAdapterFactoryArgs = {
  backend: BackendInstance;
  sessionCwd: string;
  workspaceDir: string;
  runtimeDir: string;
};

export type AcpConnectionInitializeResult = {
  authMethods: AcpAuthMethod[];
  agentName: string;
  agentVersion: string;
  commandLabel: string;
  commandLine: string;
};

export type AcpConnectionNewSessionResult = {
  sessionId: string;
  sessionTitle?: string;
  sessionUpdatedAt?: string;
  modes?: SessionModeState | null;
  models?: SessionModelState | null;
};

export type AcpConnectionAdapter = {
  initialize: () => Promise<AcpConnectionInitializeResult>;
  onUpdate: (listener: AcpConnectionUpdateListener) => () => void;
  onClose: (listener: AcpConnectionCloseListener) => () => void;
  onDiagnostics: (listener: AcpConnectionDiagnosticsListener) => () => void;
  onPermissionRequest: (listener: AcpConnectionPermissionListener) => () => void;
  newSession: () => Promise<AcpConnectionNewSessionResult>;
  prompt: (args: {
    sessionId: string;
    message: string;
    hostContext?: AcpHostContext;
  }) => Promise<{ stopReason: string }>;
  cancel: (args: { sessionId: string }) => Promise<void>;
  setMode: (args: { sessionId: string; modeId: string }) => Promise<void>;
  setModel: (args: { sessionId: string; modelId: string }) => Promise<void>;
  authenticate: (args: { methodId: string }) => Promise<void>;
  close: () => Promise<void>;
};

export class AcpAuthRequiredError extends Error {
  readonly authMethods: AcpAuthMethod[];

  constructor(message: string, authMethods?: AcpAuthMethod[]) {
    super(message);
    this.name = "AcpAuthRequiredError";
    this.authMethods = Array.isArray(authMethods) ? authMethods : [];
  }
}

function isRequestError(value: unknown): value is RequestError {
  return value instanceof RequestError;
}

function compactError(error: unknown) {
  return describeAcpError(error, "unknown error")
    .replace(/\s+/g, " ")
    .trim();
}

function formatHostContext(hostContext?: AcpHostContext) {
  if (!hostContext) {
    return "";
  }
  return [
    "",
    "[Zotero host context]",
    JSON.stringify(hostContext, null, 2),
    "[/Zotero host context]",
  ].join("\n");
}

function buildPromptText(message: string, hostContext?: AcpHostContext) {
  return `${String(message || "").trim()}${formatHostContext(hostContext)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function nextOpaqueId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeAuthMethods(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AcpAuthMethod[];
  }
  const normalized: AcpAuthMethod[] = [];
  for (const entry of value) {
      const id = String(entry?.id || "").trim();
      const name = String(entry?.name || "").trim();
      if (!id || !name) {
        continue;
      }
      normalized.push({
        id,
        name,
        description: String(entry?.description || "").trim() || undefined,
      });
  }
  return normalized;
}

class NativeAcpConnectionAdapter implements AcpConnectionAdapter {
  private readonly updateListeners = new Set<AcpConnectionUpdateListener>();
  private readonly closeListeners = new Set<AcpConnectionCloseListener>();
  private readonly diagnosticsListeners =
    new Set<AcpConnectionDiagnosticsListener>();
  private readonly permissionListeners =
    new Set<AcpConnectionPermissionListener>();
  private readonly authMethods: AcpAuthMethod[] = [];
  private connection: AcpClientConnection | null = null;
  private transport:
    | Awaited<ReturnType<typeof launchAcpTransport>>
    | null = null;
  private initialized = false;
  private commandLabel = "";
  private commandLine = "";
  private agentName = "";
  private agentVersion = "";
  private closing = false;

  constructor(private readonly args: AcpConnectionAdapterFactoryArgs) {}

  private emitDiagnostic(entry: {
    kind: string;
    level?: "info" | "warn" | "error";
    message: string;
    detail?: string;
    stage?: string;
    errorName?: string;
    stack?: string;
    cause?: string;
    code?: string | number;
    data?: unknown;
    raw?: unknown;
  }) {
    const payload: AcpDiagnosticsEntry = {
      id: nextOpaqueId("acp-diag"),
      ts: nowIso(),
      kind: entry.kind,
      level: entry.level || "info",
      message: entry.message,
      detail: String(entry.detail || ""),
      stage: entry.stage,
      errorName: entry.errorName,
      stack: entry.stack,
      cause: entry.cause,
      code: entry.code,
      data: entry.data,
      raw: entry.raw,
    };
    for (const listener of this.diagnosticsListeners) {
      void listener(payload);
    }
  }

  private emitErrorDiagnostic(entry: {
    kind: string;
    message: string;
    error: unknown;
    stage: string;
  }) {
    const serialized = serializeAcpError(entry.error, entry.stage);
    this.emitDiagnostic({
      kind: entry.kind,
      level: "error",
      message: entry.message,
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

  private emitTrace(event: AcpClientTraceEvent) {
    const idText = event.id === undefined ? "" : ` id=${String(event.id)}`;
    const methodText = event.method ? ` ${event.method}` : "";
    const errorText =
      event.errorCode !== undefined
        ? ` error=${String(event.errorCode)} ${String(event.errorMessage || "")}`.trimEnd()
        : "";
    this.emitDiagnostic({
      kind: "jsonrpc_trace",
      message: `${event.direction} ${event.kind}${methodText}${idText}${errorText}`.trim(),
      detail: JSON.stringify(event),
      raw: event,
    });
  }

  private emitClose(event?: { message?: string; stderrText?: string }) {
    for (const listener of this.closeListeners) {
      void listener(event);
    }
  }

  private buildClient(): AcpClientHandler {
    return {
      requestPermission: async (params) => {
        const normalizedOptions = Array.isArray(params.options)
          ? params.options.reduce((acc, entry) => {
              const optionId = String(entry?.optionId || "").trim();
              const name = String(entry?.name || "").trim();
              if (!optionId || !name) {
                return acc;
              }
              acc.push({
                optionId,
                kind: String(entry?.kind || "").trim(),
                name,
              });
              return acc;
            }, [] as AcpPendingPermissionRequest["options"])
          : [];
        this.emitDiagnostic({
          kind: "permission_requested",
          level: "warn",
          message: `Permission requested for ${String(
            params.toolCall?.title || "tool call",
          ).trim()}`,
        });
        if (this.permissionListeners.size === 0) {
          return {
            outcome: {
              outcome: "cancelled",
            },
          };
        }
        const requestId = nextOpaqueId("acp-permission");
        const outcome = await new Promise<RequestPermissionOutcome>((resolve) => {
          const request: AcpPendingPermissionRequest & {
            resolve: (outcome: RequestPermissionOutcome) => void;
          } = {
            requestId,
            sessionId: String(params.sessionId || "").trim(),
            toolCallId: String(params.toolCall?.toolCallId || "").trim(),
            toolTitle: String(params.toolCall?.title || "Tool Call").trim(),
            requestedAt: nowIso(),
            options: normalizedOptions,
            resolve,
          };
          for (const listener of this.permissionListeners) {
            void listener(request);
          }
        });
        return {
          outcome,
        };
      },
      sessionUpdate: async (params) => {
        for (const listener of this.updateListeners) {
          await listener(params);
        }
      },
    };
  }

  async initialize() {
    if (this.initialized && this.connection) {
      return {
        authMethods: this.authMethods.map((entry) => ({ ...entry })),
        agentName: this.agentName,
        agentVersion: this.agentVersion,
        commandLabel: this.commandLabel,
        commandLine: this.commandLine,
      };
    }
    this.emitDiagnostic({
      kind: "command_check",
      message: "Checking OpenCode command availability",
      detail: [this.args.backend.command, ...(this.args.backend.args || [])]
        .filter(Boolean)
        .join(" "),
    });
    try {
      this.transport = await launchAcpTransport({
        backend: this.args.backend,
        cwd: this.args.sessionCwd,
      });
      this.commandLabel = this.transport.getCommandLabel();
      this.commandLine = this.transport.getCommandLine();
      this.emitDiagnostic({
        kind: "spawned",
        message: "Spawned ACP backend process",
        detail: this.commandLine,
      });
      const stream = createAcpNdJsonMessageStream(
        this.transport.stdin,
        this.transport.stdout,
      );
      this.connection = new AcpClientConnection(
        () => this.buildClient(),
        stream,
        {
          onTrace: (event) => this.emitTrace(event),
        },
      );
      void this.connection.closed
        .then(() => {
          if (this.closing) {
            return;
          }
          const stderrText = this.transport?.getStderrText() || "";
          this.emitDiagnostic({
            kind: "exited",
            level: stderrText ? "warn" : "info",
            message: "ACP connection closed",
            detail: stderrText,
          });
          this.emitClose({
            message: "ACP connection closed",
            stderrText,
          });
        })
        .catch((error) => {
          if (this.closing) {
            return;
          }
          const detail = compactError(error);
          this.emitErrorDiagnostic({
            kind: "exited",
            message: "ACP connection failed",
            error,
            stage: "connection_closed",
          });
          this.emitClose({
            message: detail,
            stderrText: this.transport?.getStderrText() || "",
          });
        });
      const response = await this.connection.initialize({
        protocolVersion: ACP_PROTOCOL_VERSION,
        clientCapabilities: {},
      });
      const normalizedAuthMethods = normalizeAuthMethods(response.authMethods);
      this.authMethods.splice(
        0,
        this.authMethods.length,
        ...normalizedAuthMethods,
      );
      this.agentName =
        String(response.agentInfo?.title || "").trim() ||
        String(response.agentInfo?.name || "").trim();
      this.agentVersion = String(response.agentInfo?.version || "").trim();
      this.initialized = true;
      this.emitDiagnostic({
        kind: "initialized",
        message: "ACP initialize completed",
        detail: [this.agentName, this.agentVersion].filter(Boolean).join(" "),
      });
      return {
        authMethods: this.authMethods.map((entry) => ({ ...entry })),
        agentName: this.agentName,
        agentVersion: this.agentVersion,
        commandLabel: this.commandLabel,
        commandLine: this.commandLine,
      };
    } catch (error) {
      this.emitErrorDiagnostic({
        kind: "initialized",
        message: "Failed to initialize ACP connection",
        error,
        stage: "initialize",
      });
      throw error;
    }
  }

  onUpdate(listener: AcpConnectionUpdateListener) {
    this.updateListeners.add(listener);
    return () => {
      this.updateListeners.delete(listener);
    };
  }

  onClose(listener: AcpConnectionCloseListener) {
    this.closeListeners.add(listener);
    return () => {
      this.closeListeners.delete(listener);
    };
  }

  onDiagnostics(listener: AcpConnectionDiagnosticsListener) {
    this.diagnosticsListeners.add(listener);
    return () => {
      this.diagnosticsListeners.delete(listener);
    };
  }

  onPermissionRequest(listener: AcpConnectionPermissionListener) {
    this.permissionListeners.add(listener);
    return () => {
      this.permissionListeners.delete(listener);
    };
  }

  async newSession() {
    if (!this.connection) {
      await this.initialize();
    }
    try {
      const response = (await this.connection!.newSession({
        cwd: this.args.sessionCwd,
        mcpServers: [],
      })) as NewSessionResponse & {
        title?: string | null;
        updatedAt?: string | null;
      };
      this.emitDiagnostic({
        kind: "session_created",
        message: `Created ACP session ${String(response.sessionId || "").trim()}`,
      });
      return {
        sessionId: String(response.sessionId || "").trim(),
        sessionTitle:
          String(response.title || "").trim() || undefined,
        sessionUpdatedAt:
          String(response.updatedAt || "").trim() || undefined,
        modes: response.modes || null,
        models: response.models || null,
      };
    } catch (error) {
      if (
        (isRequestError(error) && error.code === -32000) ||
        /authentication required/i.test(compactError(error))
      ) {
        this.emitDiagnostic({
          kind: "auth_required",
          level: "warn",
          message: compactError(error) || "Authentication required",
        });
        throw new AcpAuthRequiredError(
          compactError(error) || "Authentication required",
          this.authMethods,
        );
      }
      this.emitErrorDiagnostic({
        kind: "session_created",
        message: "Failed to create ACP session",
        error,
        stage: "session_new",
      });
      throw error;
    }
  }

  async prompt(args: {
    sessionId: string;
    message: string;
    hostContext?: AcpHostContext;
  }) {
    if (!this.connection) {
      await this.initialize();
    }
    this.emitDiagnostic({
      kind: "prompt_started",
      message: `Prompt started for ${args.sessionId}`,
    });
    try {
      const response = await this.connection!.prompt({
        sessionId: args.sessionId,
        prompt: [
          {
            type: "text",
            text: buildPromptText(args.message, args.hostContext),
            _meta: {
              requestKind: ACP_PROMPT_REQUEST_KIND,
            },
          },
        ],
      });
      this.emitDiagnostic({
        kind: "prompt_finished",
        message: `Prompt finished with ${String(response.stopReason || "").trim() || "unknown"}`,
      });
      return {
        stopReason: String(response.stopReason || "").trim(),
      };
    } catch (error) {
      this.emitErrorDiagnostic({
        kind: "prompt_finished",
        message: "Prompt failed",
        error,
        stage: "session_prompt",
      });
      throw error;
    }
  }

  async cancel(args: { sessionId: string }) {
    if (!this.connection) {
      return;
    }
    await this.connection.cancel({
      sessionId: args.sessionId,
    });
    this.emitDiagnostic({
      kind: "prompt_finished",
      level: "warn",
      message: `Cancel requested for ${args.sessionId}`,
    });
  }

  async setMode(args: { sessionId: string; modeId: string }) {
    if (!this.connection) {
      await this.initialize();
    }
    await this.connection!.setSessionMode({
      sessionId: args.sessionId,
      modeId: args.modeId,
    });
    this.emitDiagnostic({
      kind: "initialized",
      message: `Mode set to ${args.modeId}`,
    });
  }

  async setModel(args: { sessionId: string; modelId: string }) {
    if (!this.connection) {
      await this.initialize();
    }
    await this.connection!.setSessionModel({
      sessionId: args.sessionId,
      modelId: args.modelId,
    });
    this.emitDiagnostic({
      kind: "initialized",
      message: `Model set to ${args.modelId}`,
    });
  }

  async authenticate(args: { methodId: string }) {
    if (!this.connection) {
      await this.initialize();
    }
    await this.connection!.authenticate({
      methodId: args.methodId,
    });
    this.emitDiagnostic({
      kind: "initialized",
      message: `Authenticated with ${args.methodId}`,
    });
  }

  async close() {
    this.closing = true;
    try {
      await this.transport?.close();
    } finally {
      this.transport = null;
      this.connection = null;
      this.initialized = false;
      this.closing = false;
    }
  }
}

export async function createAcpConnectionAdapter(
  args: AcpConnectionAdapterFactoryArgs,
) {
  return new NativeAcpConnectionAdapter(args);
}
