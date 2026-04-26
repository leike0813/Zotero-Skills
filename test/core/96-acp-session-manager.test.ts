import { assert } from "chai";
import { config } from "../../package.json";
import {
  ACP_OPENCODE_BACKEND_ID,
  ACP_PROMPT_REQUEST_KIND,
} from "../../src/config/defaults";
import {
  authenticateAcpConversation,
  buildAcpDiagnosticsBundle,
  cancelAcpConversationPrompt,
  getAcpFrontendSnapshot,
  getAcpConversationSnapshot,
  reconnectAcpConversation,
  resolveAcpConversationPermission,
  resetAcpSessionManagerForTests,
  sendAcpConversationPrompt,
  setActiveAcpBackend,
  setAcpConversationChatDisplayMode,
  setAcpConversationModel,
  setAcpConversationMode,
  setAcpConversationReasoningEffort,
  subscribeAcpConversationSnapshots,
  setAcpConnectionAdapterFactoryForTests,
  startNewAcpConversation,
  toggleAcpConversationStatusDetails,
} from "../../src/modules/acpSessionManager";
import {
  loadAcpConversationState,
  resolveAcpStoragePaths,
  resolveAcpSessionCwd,
} from "../../src/modules/acpConversationStore";
import { resetPluginStateStoreForTests } from "../../src/modules/pluginStateStore";
import type {
  AcpConnectionAdapter,
  AcpConnectionAdapterFactoryArgs,
  AcpConnectionDiagnosticsListener,
  AcpConnectionPermissionListener,
  AcpConnectionUpdateListener,
} from "../../src/modules/acpConnectionAdapter";
import { AcpAuthRequiredError } from "../../src/modules/acpConnectionAdapter";
import type {
  RequestPermissionOutcome,
  SessionNotification,
} from "../../src/modules/acpProtocol";

class FakeAcpConnectionAdapter implements AcpConnectionAdapter {
  readonly updates = new Set<AcpConnectionUpdateListener>();
  readonly closeListeners = new Set<
    (event?: { message?: string; stderrText?: string }) => void
  >();
  readonly diagnosticsListeners = new Set<AcpConnectionDiagnosticsListener>();
  readonly permissionListeners = new Set<AcpConnectionPermissionListener>();
  readonly prompts: string[] = [];
  readonly sessionIds: string[] = [];
  readonly modelSelections: string[] = [];
  readonly modeSelections: string[] = [];
  readonly authenticateCalls: string[] = [];
  readonly cancelSessionIds: string[] = [];
  initializeCalls = 0;
  closeCalls = 0;
  promptStopReason = "end_turn";
  failInitialize = false;
  failNewSessionUntilAuthenticated = false;
  emitPermissionDuringPrompt = false;
  streamingChunkCount = 0;
  modelState = {
    currentModelId: "gpt-5.4",
    availableModels: [
      { modelId: "gpt-5.4", name: "GPT-5.4", description: "Default model" },
      { modelId: "gpt-5.4-mini", name: "GPT-5.4 Mini", description: "Smaller model" },
    ],
  };
  connected = false;
  lastPermissionOutcome: RequestPermissionOutcome | null = null;
  private permissionRequestId = 0;
  private authenticated = false;

  async initialize() {
    if (this.failInitialize) {
      throw new Error('Command "npx" was not found in PATH');
    }
    this.initializeCalls += 1;
    this.connected = true;
    this.emitDiagnostic({
      kind: "command_check",
      level: "info",
      message: "validated npx command",
      detail: "npx opencode-ai@latest acp",
    });
    this.emitDiagnostic({
      kind: "spawned",
      level: "info",
      message: "spawned npx process",
      detail: "npx opencode-ai@latest acp",
    });
    this.emitDiagnostic({
      kind: "initialized",
      level: "info",
      message: "ACP initialize completed",
    });
    return {
      agentName: "OpenCode",
      agentVersion: "1.2.3",
      authMethods: [
        {
          id: "device",
          name: "Device Login",
          description: "Authenticate via browser",
        },
      ],
      commandLabel: "npx opencode-ai@latest acp",
      commandLine: "npx opencode-ai@latest acp",
    };
  }

  onUpdate(listener: AcpConnectionUpdateListener) {
    this.updates.add(listener);
    return () => {
      this.updates.delete(listener);
    };
  }

  onClose(listener: () => void) {
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
    if (this.failNewSessionUntilAuthenticated && !this.authenticated) {
      this.emitDiagnostic({
        kind: "auth_required",
        level: "warn",
        message: "session/new requires authentication",
      });
      throw new AcpAuthRequiredError("Authentication required", [
        {
          id: "device",
          name: "Device Login",
          description: "Authenticate via browser",
        },
      ]);
    }
    const sessionId = `session-${this.sessionIds.length + 1}`;
    this.sessionIds.push(sessionId);
    this.emitDiagnostic({
      kind: "session_created",
      level: "info",
      message: `created session ${sessionId}`,
    });
    return {
      sessionId,
      sessionTitle: `Conversation ${this.sessionIds.length}`,
      sessionUpdatedAt: "2026-04-22T01:00:00.000Z",
      modes: {
        currentModeId: "plan",
        availableModes: [
          { id: "plan", name: "Plan", description: "Reason first" },
          { id: "code", name: "Code", description: "Act directly" },
        ],
      },
      models: {
        currentModelId: this.modelState.currentModelId,
        availableModels: this.modelState.availableModels,
      },
    };
  }

  private async emitUpdate(
    update: SessionNotification,
  ) {
    for (const listener of this.updates) {
      await listener(update);
    }
  }

  private emitDiagnostic(entry: {
    kind: string;
    level: "info" | "warn" | "error";
    message: string;
    detail?: string;
  }) {
    const payload = {
      id: `${entry.kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toISOString(),
      kind: entry.kind,
      level: entry.level,
      message: entry.message,
      detail: entry.detail || "",
    };
    for (const listener of this.diagnosticsListeners) {
      listener(payload);
    }
  }

  emitTraceDiagnostics(count: number) {
    for (let index = 0; index < count; index += 1) {
      this.emitDiagnostic({
        kind: "jsonrpc_trace",
        level: "info",
        message: `trace ${index}`,
        detail: `trace ${index}`,
      });
    }
  }

  async prompt(args: { sessionId: string; message: string }) {
    this.prompts.push(args.message);
    this.emitDiagnostic({
      kind: "prompt_started",
      level: "info",
      message: `prompt started for ${args.sessionId}`,
    });
    await this.emitUpdate({
      sessionId: args.sessionId,
      update: {
        sessionUpdate: "agent_thought_chunk",
        content: {
          type: "text",
          text: "Checking the workspace and planning the next step.",
        },
      },
    });
    await this.emitUpdate({
      sessionId: args.sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "tool-1",
        title: "Inspect notes",
        kind: "read",
        status: "pending",
      },
    });
    if (this.emitPermissionDuringPrompt) {
      const requestId = `perm-${++this.permissionRequestId}`;
      const outcome = await new Promise<RequestPermissionOutcome>((resolve) => {
        for (const listener of this.permissionListeners) {
          listener({
            requestId,
            sessionId: args.sessionId,
            toolCallId: "tool-1",
            toolTitle: "Inspect notes",
            options: [
              {
                optionId: "allow-once",
                kind: "allow_once",
                name: "Allow Once",
              },
              {
                optionId: "reject-once",
                kind: "reject_once",
                name: "Reject Once",
              },
            ],
            resolve,
          });
        }
      });
      this.lastPermissionOutcome = outcome;
    }
    await this.emitUpdate({
      sessionId: args.sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "tool-1",
        title: "Inspect notes",
        kind: "read",
        status: "completed",
      },
    });
    await this.emitUpdate({
      sessionId: args.sessionId,
      update: {
        sessionUpdate: "plan",
        entries: [
          {
            content: "Inspect current Zotero selection",
            priority: "high",
            status: "completed",
          },
          {
            content: "Summarize likely next actions",
            priority: "medium",
            status: "in_progress",
          },
        ],
      },
    });
    await this.emitUpdate({
      sessionId: args.sessionId,
      update: {
        sessionUpdate: "available_commands_update",
        availableCommands: [
          {
            name: "create_plan",
            title: "Create Plan",
            description: "Build an execution plan",
            input: { type: "unstructured" },
          },
        ],
      },
    });
    await this.emitUpdate({
      sessionId: args.sessionId,
      update: {
        sessionUpdate: "current_mode_update",
        currentModeId: "code",
      },
    });
    await this.emitUpdate({
      sessionId: args.sessionId,
      update: {
        sessionUpdate: "session_info_update",
        title: "OpenCode session",
        updatedAt: "2026-04-22T01:23:45.000Z",
      },
    });
    await this.emitUpdate({
      sessionId: args.sessionId,
      update: {
        sessionUpdate: "usage_update",
        used: 1200,
        size: 8000,
      },
    });
    if (this.streamingChunkCount > 0) {
      for (let index = 0; index < this.streamingChunkCount; index += 1) {
        await this.emitUpdate({
          sessionId: args.sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              type: "text",
              text: String(index % 10),
            },
          },
        });
      }
    } else {
      await this.emitUpdate({
        sessionId: args.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: {
            type: "text",
            text: `Echo: ${args.message}`,
          },
        },
      });
    }
    this.emitDiagnostic({
      kind: "prompt_finished",
      level: "info",
      message: `prompt finished with ${this.promptStopReason}`,
    });
    return {
      stopReason: this.promptStopReason,
    };
  }

  async cancel(args: { sessionId: string }) {
    this.cancelSessionIds.push(args.sessionId);
  }

  async setMode(args: { sessionId: string; modeId: string }) {
    this.modeSelections.push(`${args.sessionId}:${args.modeId}`);
  }

  async setModel(args: { sessionId: string; modelId: string }) {
    this.modelSelections.push(`${args.sessionId}:${args.modelId}`);
  }

  async authenticate(args: { methodId: string }) {
    this.authenticated = true;
    this.authenticateCalls.push(args.methodId);
    this.emitDiagnostic({
      kind: "initialized",
      level: "info",
      message: `authenticated with ${args.methodId}`,
    });
  }

  async close() {
    this.closeCalls += 1;
    for (const listener of this.closeListeners) {
      listener();
    }
  }

  emitClose(event?: { message?: string; stderrText?: string }) {
    for (const listener of this.closeListeners) {
      listener(event);
    }
  }
}

describe("acp session manager", function () {
  let lastAdapter:
    | FakeAcpConnectionAdapter
    | null;
  let lastFactoryArgs:
    | AcpConnectionAdapterFactoryArgs
    | null;
  let previousBackendsPref: unknown;

  beforeEach(function () {
    lastAdapter = null;
    lastFactoryArgs = null;
    previousBackendsPref = Zotero.Prefs.get(
      `${config.prefsPrefix}.backendsConfigJson`,
      true,
    );
    resetPluginStateStoreForTests();
    resetAcpSessionManagerForTests();
    setAcpConnectionAdapterFactoryForTests(
      async (args: AcpConnectionAdapterFactoryArgs) => {
        lastFactoryArgs = args;
        lastAdapter = new FakeAcpConnectionAdapter();
        return lastAdapter;
      },
    );
  });

  afterEach(function () {
    setAcpConnectionAdapterFactoryForTests();
    resetAcpSessionManagerForTests();
    resetPluginStateStoreForTests();
    if (typeof previousBackendsPref === "undefined") {
      Zotero.Prefs.clear(`${config.prefsPrefix}.backendsConfigJson`, true);
    } else {
      Zotero.Prefs.set(
        `${config.prefsPrefix}.backendsConfigJson`,
        previousBackendsPref,
        true,
      );
    }
  });

  it("creates an ACP session on demand, merges streamed assistant chunks, and persists transcript state", async function () {
    (Zotero as typeof Zotero & { DataDirectory?: { dir?: string } }).DataDirectory = {
      dir: "D:\\ZoteroData",
    };
    await sendAcpConversationPrompt({
      message: "Hello ACP",
      hostContext: {
        target: "library",
        selectionEmpty: true,
      },
    });

    const snapshot = getAcpConversationSnapshot();
    assert.equal(snapshot.backendId, ACP_OPENCODE_BACKEND_ID);
    assert.equal(snapshot.status, "connected");
    assert.equal(snapshot.commandLabel, "npx opencode-ai@latest acp");
    assert.equal(snapshot.commandLine, "npx opencode-ai@latest acp");
    assert.equal(snapshot.agentLabel, "OpenCode");
    assert.equal(snapshot.agentVersion, "1.2.3");
    assert.equal(snapshot.sessionCwd, "D:\\ZoteroData");
    assert.equal(snapshot.lastLifecycleEvent, "prompt_finished");
    assert.equal(snapshot.sessionId, "session-1");
    assert.equal(snapshot.sessionTitle, "OpenCode session");
    assert.equal(snapshot.sessionUpdatedAt, "2026-04-22T01:23:45.000Z");
    assert.equal(snapshot.lastStopReason, "end_turn");
    assert.deepEqual(snapshot.currentMode, {
      id: "code",
      label: "Code",
      description: "Act directly",
    });
    assert.deepEqual(snapshot.currentModel, {
      id: "gpt-5.4",
      label: "GPT-5.4",
      description: "Default model",
    });
    assert.lengthOf(snapshot.availableCommands, 1);
    assert.deepEqual(snapshot.usage, {
      used: 1200,
      size: 8000,
    });
    assert.isAtLeast(snapshot.items.length, 5);
    assert.deepInclude(
      snapshot.items.find((entry) => entry.kind === "message" && entry.role === "user") || {},
      {
        role: "user",
        text: "Hello ACP",
      },
    );
    assert.deepInclude(
      snapshot.items.find((entry) => entry.kind === "thought") || {},
      {
        text: "Checking the workspace and planning the next step.",
      },
    );
    assert.deepInclude(
      snapshot.items.find((entry) => entry.kind === "tool_call") || {},
      {
        title: "Inspect notes",
        state: "completed",
      },
    );
    assert.deepInclude(
      snapshot.items.find((entry) => entry.kind === "message" && entry.role === "assistant") || {},
      {
        role: "assistant",
        text: "Echo: Hello ACP",
      },
    );
    assert.isAtLeast(snapshot.diagnostics.length, 4);
    assert.isOk(lastAdapter);
    assert.isOk(lastFactoryArgs);
    assert.equal(lastAdapter?.initializeCalls, 1);
    assert.deepEqual(lastAdapter?.sessionIds, ["session-1"]);
    assert.equal(lastAdapter?.prompts.length, 1);
    assert.equal(lastFactoryArgs?.sessionCwd, "D:\\ZoteroData");
    assert.equal(
      lastFactoryArgs?.workspaceDir,
      "D:\\ZoteroData\\zotero-skills\\acp\\workspaces\\acp-opencode",
    );
    assert.equal(
      lastFactoryArgs?.runtimeDir,
      "D:\\ZoteroData\\zotero-skills\\acp\\runtime\\acp-opencode",
    );

    const persisted = loadAcpConversationState(ACP_OPENCODE_BACKEND_ID);
    assert.equal(persisted.snapshot.sessionId, "session-1");
    assert.equal(persisted.snapshot.commandLabel, "npx opencode-ai@latest acp");
    assert.equal(persisted.snapshot.commandLine, "npx opencode-ai@latest acp");
    assert.equal(persisted.snapshot.agentLabel, "OpenCode");
    assert.equal(persisted.snapshot.currentMode?.id, "code");
    assert.equal(persisted.snapshot.currentModel?.id, "gpt-5.4");
    assert.equal(persisted.snapshot.lastStopReason, "end_turn");
    assert.equal(persisted.snapshot.sessionCwd, "D:\\ZoteroData");
    assert.isAtLeast(persisted.items.length, 5);
    assert.equal(
      persisted.items.find((entry) => entry.kind === "message" && entry.role === "assistant")?.text,
      "Echo: Hello ACP",
    );
  });

  it("keeps parallel ACP backend slots isolated and routes actions to the active backend", async function () {
    Zotero.Prefs.set(
      `${config.prefsPrefix}.backendsConfigJson`,
      JSON.stringify({
        schemaVersion: 2,
        backends: [
          {
            id: "acp-one",
            displayName: "ACP One",
            type: "acp",
            command: "node",
            args: ["one.js"],
          },
          {
            id: "acp-two",
            displayName: "ACP Two",
            type: "acp",
            command: "node",
            args: ["two.js"],
          },
        ],
      }),
      true,
    );
    const adapters = new Map<string, FakeAcpConnectionAdapter>();
    const factoryArgs: AcpConnectionAdapterFactoryArgs[] = [];
    setAcpConnectionAdapterFactoryForTests(async (args) => {
      factoryArgs.push(args);
      const adapter = new FakeAcpConnectionAdapter();
      adapters.set(args.backend.id, adapter);
      return adapter;
    });

    await setActiveAcpBackend({ backendId: "acp-one" });
    await sendAcpConversationPrompt({ message: "hello one" });
    await setActiveAcpBackend({ backendId: "acp-two" });
    await sendAcpConversationPrompt({ message: "hello two" });

    const one = getAcpConversationSnapshot("acp-one");
    const two = getAcpConversationSnapshot("acp-two");
    assert.equal(one.backendId, "acp-one");
    assert.equal(two.backendId, "acp-two");
    assert.equal(
      one.items.find((entry) => entry.kind === "message" && entry.role === "assistant")?.text,
      "Echo: hello one",
    );
    assert.equal(
      two.items.find((entry) => entry.kind === "message" && entry.role === "assistant")?.text,
      "Echo: hello two",
    );
    assert.deepEqual(adapters.get("acp-one")?.prompts, ["hello one"]);
    assert.deepEqual(adapters.get("acp-two")?.prompts, ["hello two"]);
    assert.deepEqual(
      factoryArgs.map((entry) => entry.backend.id),
      ["acp-one", "acp-two"],
    );

    await setAcpConversationMode({ modeId: "plan" });
    assert.deepEqual(adapters.get("acp-one")?.modeSelections, []);
    assert.deepEqual(adapters.get("acp-two")?.modeSelections, ["session-1:plan"]);

    const frontend = getAcpFrontendSnapshot();
    assert.equal(frontend.activeBackendId, "acp-two");
    assert.equal(frontend.connectedCount, 2);
    assert.equal(frontend.totalMessageCount, one.items.length + two.items.length);

    await startNewAcpConversation();
    assert.isAtLeast(loadAcpConversationState("acp-one").items.length, 1);
    assert.lengthOf(loadAcpConversationState("acp-two").items, 0);
  });

  it("resets the local conversation while keeping the ACP backend slot stable", async function () {
    await sendAcpConversationPrompt({
      message: "Before reset",
    });

    await startNewAcpConversation();

    const snapshot = getAcpConversationSnapshot();
    assert.equal(snapshot.backendId, ACP_OPENCODE_BACKEND_ID);
    assert.equal(snapshot.sessionId, "");
    assert.equal(snapshot.status, "idle");
    assert.lengthOf(snapshot.items, 0);

    const persisted = loadAcpConversationState(ACP_OPENCODE_BACKEND_ID);
    assert.equal(persisted.snapshot.sessionId, "");
    assert.lengthOf(persisted.items, 0);
  });

  it("throttles streaming snapshot notifications while preserving the final transcript", async function () {
    setAcpConnectionAdapterFactoryForTests(async () => {
      lastAdapter = new FakeAcpConnectionAdapter();
      lastAdapter.streamingChunkCount = 100;
      return lastAdapter;
    });
    let snapshotCount = 0;
    const unsubscribe = subscribeAcpConversationSnapshots(() => {
      snapshotCount += 1;
    });

    await sendAcpConversationPrompt({
      message: "stream many chunks",
    });
    await new Promise((resolve) => setTimeout(resolve, 120));
    unsubscribe();

    const snapshot = getAcpConversationSnapshot();
    const assistant = snapshot.items.find(
      (entry) => entry.kind === "message" && entry.role === "assistant",
    );
    assert.equal(assistant?.text.length, 100);
    assert.isBelow(snapshotCount, 40);
    const persisted = loadAcpConversationState(ACP_OPENCODE_BACKEND_ID);
    assert.equal(
      persisted.items.find((entry) => entry.kind === "message" && entry.role === "assistant")?.text.length,
      100,
    );
  });

  it("does not fan out high-frequency diagnostics as one UI snapshot per trace", async function () {
    await reconnectAcpConversation();
    let snapshotCount = 0;
    const unsubscribe = subscribeAcpConversationSnapshots(() => {
      snapshotCount += 1;
    });

    lastAdapter?.emitTraceDiagnostics(100);
    await new Promise((resolve) => setTimeout(resolve, 120));
    unsubscribe();

    const snapshot = getAcpConversationSnapshot();
    assert.isAtMost(snapshot.diagnostics.length, 40);
    assert.isBelow(snapshotCount, 20);
  });

  it("persists ACP chat display mode and compact status expansion state", function () {
    setAcpConversationChatDisplayMode({
      mode: "bubble",
    });
    toggleAcpConversationStatusDetails({
      expanded: true,
    });

    let persisted = loadAcpConversationState(ACP_OPENCODE_BACKEND_ID);
    assert.equal(persisted.snapshot.chatDisplayMode, "bubble");
    assert.equal(persisted.snapshot.statusExpanded, true);

    resetAcpSessionManagerForTests();
    persisted = loadAcpConversationState(ACP_OPENCODE_BACKEND_ID);
    assert.equal(persisted.snapshot.chatDisplayMode, "bubble");
    assert.equal(persisted.snapshot.statusExpanded, true);
  });

  it("exposes authentication methods and reconnects after authenticate", async function () {
    setAcpConnectionAdapterFactoryForTests(async () => {
      lastAdapter = new FakeAcpConnectionAdapter();
      lastAdapter.failNewSessionUntilAuthenticated = true;
      return lastAdapter;
    });

    let thrown: unknown;
    try {
      await sendAcpConversationPrompt({
        message: "Auth me",
      });
    } catch (error) {
      thrown = error;
    }

    assert.instanceOf(thrown, AcpAuthRequiredError);
    let snapshot = getAcpConversationSnapshot();
    assert.equal(snapshot.status, "auth-required");
    assert.lengthOf(snapshot.authMethods, 1);
    assert.equal(snapshot.authMethods[0].id, "device");

    await authenticateAcpConversation({
      methodId: "device",
    });

    snapshot = getAcpConversationSnapshot();
    assert.equal(snapshot.status, "connected");
    assert.equal(snapshot.sessionId, "session-1");
    assert.deepEqual(lastAdapter?.authenticateCalls, ["device"]);
  });

  it("waits for an interactive permission decision and resumes the prompt after allow", async function () {
    setAcpConnectionAdapterFactoryForTests(async () => {
      lastAdapter = new FakeAcpConnectionAdapter();
      lastAdapter.emitPermissionDuringPrompt = true;
      return lastAdapter;
    });

    const promptPromise = sendAcpConversationPrompt({
      message: "Need permission",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    let snapshot = getAcpConversationSnapshot();
    assert.equal(snapshot.status, "permission-required");
    assert.isOk(snapshot.pendingPermissionRequest);
    assert.equal(snapshot.pendingPermissionRequest?.toolTitle, "Inspect notes");

    await resolveAcpConversationPermission({
      outcome: "selected",
      optionId: "allow-once",
    });
    await promptPromise;

    snapshot = getAcpConversationSnapshot();
    assert.equal(snapshot.status, "connected");
    assert.isNull(snapshot.pendingPermissionRequest);
    assert.deepEqual(lastAdapter?.lastPermissionOutcome, {
      outcome: "selected",
      optionId: "allow-once",
    });
  });

  it("surfaces command prerequisite failures without silently connecting", async function () {
    setAcpConnectionAdapterFactoryForTests(async () => {
      lastAdapter = new FakeAcpConnectionAdapter();
      lastAdapter.failInitialize = true;
      return lastAdapter;
    });

    let thrown: unknown;
    try {
      await reconnectAcpConversation();
    } catch (error) {
      thrown = error;
    }

    assert.isOk(thrown);
    const snapshot = getAcpConversationSnapshot();
    assert.equal(snapshot.status, "error");
    assert.match(snapshot.prerequisiteError, /npx/i);
    assert.isAtLeast(snapshot.diagnostics.length, 1);
    assert.isOk(snapshot.diagnostics.find((entry) => entry.stack));
    const bundle = buildAcpDiagnosticsBundle();
    assert.equal(bundle.schema, "zotero-skills.acp.diagnostics.v1");
    assert.equal(bundle.connection.status, "error");
    assert.match(bundle.connection.lastError, /npx/i);
    assert.isAtLeast(bundle.diagnostics.length, 1);
    assert.isBoolean(bundle.host.hasTextEncoder);
  });

  it("keeps stderr tail and lifecycle metadata visible when the ACP process closes unexpectedly", async function () {
    await sendAcpConversationPrompt({
      message: "Before close",
    });

    lastAdapter?.emitClose({
      message: "ACP connection closed unexpectedly",
      stderrText: "spawn EINVAL",
    });

    const snapshot = getAcpConversationSnapshot();
    assert.equal(snapshot.status, "error");
    assert.equal(snapshot.lastLifecycleEvent, "exited");
    assert.equal(snapshot.lastError, "ACP connection closed unexpectedly");
    assert.equal(snapshot.stderrTail, "spawn EINVAL");
    assert.isAtLeast(
      snapshot.diagnostics.filter((entry) => entry.kind === "stderr").length,
      1,
    );
  });

  it("allows updating current mode and model for the active session", async function () {
    await sendAcpConversationPrompt({
      message: "Initial turn",
    });

    await setAcpConversationMode({
      modeId: "plan",
    });
    await setAcpConversationModel({
      modelId: "gpt-5.4-mini",
    });
    await cancelAcpConversationPrompt();

    const snapshot = getAcpConversationSnapshot();
    assert.equal(snapshot.currentMode?.id, "plan");
    assert.equal(snapshot.currentModel?.id, "gpt-5.4-mini");
    assert.deepEqual(lastAdapter?.modeSelections, ["session-1:plan"]);
    assert.deepEqual(lastAdapter?.modelSelections, ["session-1:gpt-5.4-mini"]);
    assert.deepEqual(lastAdapter?.cancelSessionIds, ["session-1"]);
  });

  it("derives reasoning effort choices from model variants and maps effort changes to raw model ids", async function () {
    setAcpConnectionAdapterFactoryForTests(async () => {
      lastAdapter = new FakeAcpConnectionAdapter();
      lastAdapter.modelState = {
        currentModelId: "gpt-5@high",
        availableModels: [
          { modelId: "gpt-5@low", name: "GPT-5 Low", description: "Low effort" },
          { modelId: "gpt-5@medium", name: "GPT-5 Medium", description: "Medium effort" },
          { modelId: "gpt-5@high", name: "GPT-5 High", description: "High effort" },
          { modelId: "claude-4@default", name: "Claude 4 Default" },
          { modelId: "claude-4@high", name: "Claude 4 High" },
        ],
      };
      return lastAdapter;
    });

    await sendAcpConversationPrompt({
      message: "Initial turn",
    });

    let snapshot = getAcpConversationSnapshot();
    assert.deepEqual(
      snapshot.displayModelOptions.map((entry) => entry.id),
      ["gpt-5", "claude-4"],
    );
    assert.equal(snapshot.displayModelOptions[0]?.label, "GPT-5");
    assert.equal(snapshot.currentModel?.id, "gpt-5@high");
    assert.equal(snapshot.currentDisplayModel?.id, "gpt-5");
    assert.deepEqual(
      snapshot.reasoningEffortOptions.map((entry) => entry.id),
      ["low", "medium", "high"],
    );
    assert.equal(snapshot.currentReasoningEffort?.id, "high");

    await setAcpConversationReasoningEffort({
      effortId: "medium",
    });
    snapshot = getAcpConversationSnapshot();
    assert.equal(snapshot.currentModel?.id, "gpt-5@medium");
    assert.equal(snapshot.currentDisplayModel?.id, "gpt-5");
    assert.equal(snapshot.currentReasoningEffort?.id, "medium");
    assert.deepEqual(lastAdapter?.modelSelections, ["session-1:gpt-5@medium"]);

    await setAcpConversationModel({
      modelId: "claude-4",
    });
    snapshot = getAcpConversationSnapshot();
    assert.equal(snapshot.currentModel?.id, "claude-4@default");
    assert.equal(snapshot.currentDisplayModel?.id, "claude-4");
    assert.equal(snapshot.currentReasoningEffort?.id, "default");
    assert.deepEqual(lastAdapter?.modelSelections, [
      "session-1:gpt-5@medium",
      "session-1:claude-4@default",
    ]);
  });

  it("keeps plain models unfolded and re-derives model effort state after persisted restore", async function () {
    setAcpConnectionAdapterFactoryForTests(async () => {
      lastAdapter = new FakeAcpConnectionAdapter();
      lastAdapter.modelState = {
        currentModelId: "gpt-5@high",
        availableModels: [
          { modelId: "gpt-5@low", name: "GPT-5 Low" },
          { modelId: "gpt-5@high", name: "GPT-5 High" },
          { modelId: "gpt-5.4-mini", name: "GPT-5.4 Mini" },
        ],
      };
      return lastAdapter;
    });

    await sendAcpConversationPrompt({
      message: "Initial turn",
    });

    let snapshot = getAcpConversationSnapshot();
    assert.deepEqual(
      snapshot.displayModelOptions.map((entry) => entry.id),
      ["gpt-5", "gpt-5.4-mini"],
    );
    assert.deepEqual(
      snapshot.reasoningEffortOptions.map((entry) => entry.id),
      ["low", "high"],
    );

    resetAcpSessionManagerForTests();
    snapshot = getAcpConversationSnapshot();
    assert.equal(snapshot.currentModel?.id, "gpt-5@high");
    assert.equal(snapshot.currentDisplayModel?.id, "gpt-5");
    assert.equal(snapshot.currentReasoningEffort?.id, "high");

    resetPluginStateStoreForTests();
    resetAcpSessionManagerForTests();
    setAcpConnectionAdapterFactoryForTests(async () => {
      lastAdapter = new FakeAcpConnectionAdapter();
      return lastAdapter;
    });
    await sendAcpConversationPrompt({
      message: "Plain models",
    });
    snapshot = getAcpConversationSnapshot();
    assert.deepEqual(
      snapshot.displayModelOptions.map((entry) => entry.id),
      ["gpt-5.4", "gpt-5.4-mini"],
    );
    assert.deepEqual(snapshot.reasoningEffortOptions, []);
    assert.isUndefined(snapshot.currentReasoningEffort);
  });

  it("folds effort variants encoded in dash suffixes or labels", async function () {
    setAcpConnectionAdapterFactoryForTests(async () => {
      lastAdapter = new FakeAcpConnectionAdapter();
      lastAdapter.modelState = {
        currentModelId: "openai-gpt-5-high",
        availableModels: [
          { modelId: "openai-gpt-5-low", name: "GPT-5 Low" },
          { modelId: "openai-gpt-5-medium", name: "GPT-5 Medium" },
          { modelId: "openai-gpt-5-high", name: "GPT-5 High" },
          { modelId: "anthropic-claude-sonnet", name: "Claude Sonnet (low)" },
          { modelId: "anthropic-claude-sonnet-fast", name: "Claude Sonnet (high)" },
        ],
      };
      return lastAdapter;
    });

    await sendAcpConversationPrompt({
      message: "Initial turn",
    });

    let snapshot = getAcpConversationSnapshot();
    assert.deepEqual(
      snapshot.displayModelOptions.map((entry) => entry.id),
      ["openai-gpt-5", "Claude Sonnet"],
    );
    assert.equal(snapshot.displayModelOptions[0]?.label, "GPT-5");
    assert.equal(snapshot.currentDisplayModel?.id, "openai-gpt-5");
    assert.deepEqual(
      snapshot.reasoningEffortOptions.map((entry) => entry.id),
      ["low", "medium", "high"],
    );

    await setAcpConversationModel({
      modelId: "Claude Sonnet",
    });
    snapshot = getAcpConversationSnapshot();
    assert.equal(snapshot.currentDisplayModel?.id, "Claude Sonnet");
    assert.equal(snapshot.currentReasoningEffort?.id, "high");
    assert.equal(snapshot.currentModel?.id, "anthropic-claude-sonnet-fast");
    assert.deepEqual(lastAdapter?.modelSelections, [
      "session-1:anthropic-claude-sonnet-fast",
    ]);
  });
});

describe("acp conversation store", function () {
  afterEach(function () {
    resetPluginStateStoreForTests();
    delete (Zotero as typeof Zotero & { DataDirectory?: unknown }).DataDirectory;
  });

  it("resolves ACP workspace and runtime paths from Zotero.DataDirectory with cwd fallback", function () {
    (Zotero as typeof Zotero & { DataDirectory?: { dir?: string } }).DataDirectory = {
      dir: "D:\\ZoteroData",
    };
    const primary = resolveAcpStoragePaths(ACP_OPENCODE_BACKEND_ID);
    assert.equal(
      primary.workspaceDir,
      "D:\\ZoteroData\\zotero-skills\\acp\\workspaces\\acp-opencode",
    );
    assert.equal(
      primary.runtimeDir,
      "D:\\ZoteroData\\zotero-skills\\acp\\runtime\\acp-opencode",
    );

    delete (Zotero as typeof Zotero & { DataDirectory?: unknown }).DataDirectory;
    const fallback = resolveAcpStoragePaths(ACP_OPENCODE_BACKEND_ID);
    assert.include(fallback.workspaceDir.replace(/\\/g, "/"), "/.zotero-skills-runtime/acp/workspaces/acp-opencode");
    assert.include(fallback.runtimeDir.replace(/\\/g, "/"), "/.zotero-skills-runtime/acp/runtime/acp-opencode");
  });

  it("resolves ACP session cwd from Zotero.DataDirectory with process cwd fallback", function () {
    (Zotero as typeof Zotero & { DataDirectory?: { dir?: string } }).DataDirectory = {
      dir: "D:\\ZoteroData",
    };
    assert.equal(resolveAcpSessionCwd(), "D:\\ZoteroData");

    delete (Zotero as typeof Zotero & { DataDirectory?: unknown }).DataDirectory;
    assert.equal(resolveAcpSessionCwd(), process.cwd());
  });
});
