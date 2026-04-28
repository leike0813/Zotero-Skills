import { assert } from "chai";

function isRealZoteroRuntime() {
  const runtime = globalThis as {
    Zotero?: {
      __parity?: {
        runtime?: string;
      };
    };
  };
  return (
    !!runtime.Zotero &&
    runtime.Zotero.__parity?.runtime !== "node-mock"
  );
}

const dynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as <T = any>(specifier: string) => Promise<T>;

async function readProjectFile(relativePath: string) {
  if (isRealZoteroRuntime()) {
    throw new Error("readProjectFile is only available in Node tests");
  }
  const [{ readFile }, path] = await Promise.all([
    dynamicImport<typeof import("fs/promises")>("fs/promises"),
    dynamicImport<typeof import("path")>("path"),
  ]);
  const absolutePath = path.join(process.cwd(), relativePath);
  return readFile(absolutePath, "utf8");
}

describe("acp ui smoke", function () {
  beforeEach(function () {
    if (isRealZoteroRuntime()) {
      this.skip();
    }
  });

  it("adds a dedicated ACP chat page with diagnostics, auth, permission, and picker controls", async function () {
    const html = await readProjectFile("addon/content/dashboard/acp-chat.html");
    const js = await readProjectFile("addon/content/dashboard/acp-chat.js");
    const css = await readProjectFile("addon/content/dashboard/acp-chat.css");

    assert.include(html, 'id="acp-status-banner"');
    assert.include(html, 'id="acp-status-summary"');
    assert.include(html, 'id="acp-session-manager-btn"');
    assert.include(html, 'id="acp-more-btn"');
    assert.include(html, 'id="acp-actions-menu"');
    assert.include(html, 'id="acp-session-drawer"');
    assert.include(html, 'id="acp-session-drawer-list"');
    assert.include(html, 'id="acp-session-drawer-close-btn"');
    assert.include(html, 'id="acp-backend-select"');
    assert.include(html, 'id="acp-session-select"');
    assert.include(html, 'id="acp-remote-session-value"');
    assert.include(html, 'id="acp-remote-restore-value"');
    assert.include(html, 'id="acp-manage-backends-btn"');
    assert.include(html, 'id="acp-status-details-panel"');
    assert.include(html, 'id="acp-status-details-toggle-btn"');
    assert.include(html, 'id="acp-chat-mode-plain"');
    assert.include(html, 'id="acp-chat-mode-bubble"');
    assert.include(html, 'id="acp-mode-select"');
    assert.include(html, 'id="acp-model-select"');
    assert.include(html, 'id="acp-reasoning-select"');
    assert.include(html, 'id="acp-authenticate-btn"');
    assert.include(html, 'id="acp-permission-actions"');
    assert.include(html, 'id="acp-running-indicator"');
    assert.include(html, 'id="acp-permission-details-btn"');
    assert.include(html, 'id="acp-permission-drawer"');
    assert.include(html, 'id="acp-permission-full-command"');
    assert.include(html, 'id="acp-permission-drawer-actions"');
    assert.notInclude(html, 'id="acp-allow-btn"');
    assert.notInclude(html, 'id="acp-deny-btn"');
    assert.include(html, 'id="acp-diagnostics-toggle-btn"');
    assert.include(html, 'id="acp-diagnostics-copy-btn"');
    assert.include(html, 'id="acp-diagnostics-copy-status"');
    assert.include(html, 'id="acp-diagnostics-panel"');
    assert.include(html, 'id="acp-usage-gauge"');
    assert.notInclude(html, 'id="acp-usage-summary"');
    assert.include(html, 'id="acp-transcript"');
    assert.include(html, 'id="acp-plan-panel"');
    assert.include(html, 'id="acp-plan-list"');
    assert.include(html, 'id="acp-new-conversation-btn"');
    assert.notInclude(html, 'id="acp-rename-conversation-btn"');
    assert.notInclude(html, 'id="acp-delete-conversation-btn"');
    assert.include(html, 'id="acp-connect-btn"');
    assert.include(html, 'id="acp-disconnect-btn"');
    assert.include(html, 'id="acp-mcp-injection-status"');
    assert.include(html, 'id="acp-primary-action-btn"');
    assert.include(html, 'id="acp-composer-input"');
    assert.include(html, 'id="acp-workspace-dir"');
    assert.include(html, 'id="acp-runtime-dir"');
    assert.include(html, './vendor/katex/katex.min.css');
    assert.include(html, './vendor/katex/katex.min.js');
    assert.include(html, './vendor/markdown-it/markdown-it.min.js');
    assert.include(html, './vendor/markdown-it-texmath/texmath.min.js');
    assert.notInclude(html, 'id="acp-backend-label"');
    assert.notInclude(js, "backendLabelEl");
    const statusSummaryStart = html.indexOf('id="acp-status-summary"');
    const statusSummaryEnd = html.indexOf("</section>", statusSummaryStart);
    const statusSummaryHtml = html.slice(statusSummaryStart, statusSummaryEnd);
    assert.notInclude(statusSummaryHtml, 'id="acp-authenticate-btn"');
    assert.notInclude(statusSummaryHtml, 'id="acp-diagnostics-toggle-btn"');
    assert.notInclude(statusSummaryHtml, 'id="acp-status-details-toggle-btn"');
    assert.isBelow(
      html.indexOf('id="acp-status-summary"'),
      html.indexOf('id="acp-chat-mode-plain"'),
    );
    assert.isBelow(
      html.indexOf('id="acp-status-summary"'),
      html.indexOf('id="acp-updated-at"'),
    );
    assert.isBelow(
      html.indexOf('class="acp-control-secondary"'),
      html.indexOf('id="acp-updated-at"'),
    );
    assert.isBelow(
      html.indexOf('id="acp-updated-at"'),
      html.indexOf('id="acp-status-summary-text"'),
    );
    assert.isBelow(
      html.indexOf('id="acp-status-summary-text"'),
      html.indexOf('id="acp-mcp-injection-status"'),
    );
    assert.isBelow(
      html.indexOf('id="acp-mcp-injection-status"'),
      html.indexOf('id="acp-chat-mode-plain"'),
    );
    assert.equal(
      html.match(/id="acp-status-summary-text"/g)?.length || 0,
      1,
    );
    assert.isBelow(
      html.indexOf('id="acp-transcript"'),
      html.indexOf('id="acp-plan-panel"'),
    );
    assert.isBelow(
      html.indexOf('id="acp-plan-panel"'),
      html.indexOf('id="acp-interaction-notices"'),
    );
    const composerFooterStart = html.indexOf('class="acp-composer-footer"');
    const composerFooterHtml = html.slice(composerFooterStart);
    assert.notInclude(composerFooterHtml, 'id="acp-chat-mode-plain"');
    assert.notInclude(composerFooterHtml, 'id="acp-updated-at"');
    assert.include(js, 'type: "acp:action"');
    assert.include(js, "__zsAcpSidebarBridge");
    assert.include(js, "window.wrappedJSObject");
    assert.include(js, 'sendAction("send-prompt"');
    assert.include(js, 'sendAction("new-conversation"');
    assert.include(js, 'sendAction("set-active-conversation"');
    assert.include(js, 'sendAction("rename-conversation"');
    assert.include(js, 'sendAction("archive-conversation"');
    assert.notInclude(js, 'sendAction("delete-conversation"');
    assert.include(js, 'sendAction("connect"');
    assert.include(js, 'sendAction("disconnect"');
    assert.include(js, 'sendAction("cancel"');
    assert.include(js, 'sendAction("set-mode"');
    assert.include(js, 'sendAction("set-model"');
    assert.include(js, 'sendAction("set-reasoning-effort"');
    assert.include(js, 'sendAction("set-active-backend"');
    assert.include(js, 'sendAction("open-backend-manager"');
    assert.include(js, 'sendAction("authenticate"');
    assert.include(js, 'sendAction("resolve-permission"');
    assert.include(js, 'sendAction("toggle-diagnostics"');
    assert.include(js, 'sendAction("toggle-status-details"');
    assert.include(js, 'sendAction("set-chat-display-mode"');
    assert.include(js, 'sendAction("copy-diagnostics"');
    assert.include(js, "remoteSessionRestoreStatus");
    assert.include(js, "remoteSessionRestoreMessage");
    assert.include(js, "transcriptNodeMap");
    assert.include(js, "toolActivityExpandedIds");
    assert.include(js, "sessionDrawerOpen");
    assert.include(js, "renderSessionDrawer");
    assert.include(js, "backendChatSessions");
    assert.include(js, "acp-session-backend-group");
    assert.include(js, "backendId: backendId");
    assert.include(js, "renderPlanPanel(snapshot)");
    assert.include(js, "findActivePlan");
    assert.include(js, "function isPlanPanelLive(snapshot)");
    assert.include(js, "isTerminalPlanStatus");
    assert.include(js, "function statusToneClass(status)");
    assert.include(js, "function buildMcpServiceStatus(snapshot)");
    assert.include(js, "snapshot.mcpHealth");
    assert.include(js, "function latestDiagnostic(snapshot, kinds)");
    assert.notInclude(js, "function latestMcpRequest(snapshot, predicate)");
    assert.notInclude(js, "function mcpRequestFailed(entry)");
    assert.notInclude(js, "function compactMcpToolName(entry)");
    assert.include(js, "function permissionCommandText(request)");
    assert.include(js, "function truncatePermissionCommand(text)");
    assert.include(js, "function permissionOptionToneClass(option)");
    assert.include(js, "function renderPermissionActions(container, request)");
    assert.include(js, "function renderUsageGauge(snapshot)");
    assert.include(js, "function renderInteractionZone(snapshot)");
    assert.include(js, "function isPromptRunning(snapshot)");
    assert.include(js, "renderUsageGauge(snapshot)");
    assert.include(js, "renderInteractionZone(snapshot)");
    assert.notInclude(js, "usageSummaryEl");
    assert.include(js, "state.permissionDrawerOpen = true;");
    assert.include(js, 'event.target.closest("[data-acp-permission-drawer-close]")');
    assert.include(js, 'sendAction("resolve-permission",');
    assert.include(js, 'optionId: option.optionId');
    assert.notInclude(js, "allowOptionId");
    assert.notInclude(js, "denyOptionId");
    assert.include(js, 'String(mcpHealth.summary || "Zotero MCP service")');
    assert.notInclude(js, '"queue=" +');
    assert.notInclude(js, '"openCircuits="');
    assert.include(js, "function planStatusToneClass(status)");
    assert.include(js, "function planStatusIcon(status)");
    assert.include(js, "function toolStatusToneClass(status)");
    assert.include(js, "function isGenericToolText(value)");
    assert.include(js, "function compactToolName(tool)");
    assert.include(js, "function compactToolSummary(tool)");
    assert.include(js, "function compactToolType(tool)");
    assert.include(js, "function appendToolDisplay(parent, tool)");
    assert.include(js, "function toolActivitySummaryState(items)");
    assert.include(js, 'text === "other"');
    assert.include(js, 'text === "[]"');
    assert.include(js, "tool && tool.inputSummary");
    assert.notInclude(js, 'toolCallId ? "Call " + toolCallId : "Tool call"');
    assert.include(js, 'statusPillEl.className =');
    assert.include(js, '"acp-status-pill " + statusToneClass(snapshot.status || "idle")');
    assert.include(js, '"acp-mcp-status-monitor " + mcpStatus.tone');
    assert.include(js, "mcpInjectionStatusEl.title = mcpStatus.tooltip");
    assert.include(js, '"mcp_server_injected"');
    assert.include(js, '"zotero_mcp_unavailable"');
    assert.include(js, '"acp-plan-status-icon " + statusTone');
    assert.notInclude(js, "acp-plan-status-text");
    assert.include(js, '"acp-tool-led " + statusTone');
    assert.include(js, '"acp-tool-led " + toolStatusToneClass(summaryState)');
    assert.include(js, "compactToolSummary(tool)");
    assert.include(js, "compactToolType(tool)");
    assert.include(js, "acp-tool-kind-badge");
    assert.notInclude(js, "function renderTurnTools(body, item)");
    assert.notInclude(js, "function appendTurnToolRow(parent, tool)");
    assert.notInclude(js, "formatTime(tool.createdAt)");
    assert.include(js, "markdownParser");
    assert.include(js, "function ensureMarkdownParser()");
    assert.include(js, "function renderMarkdown(textValue)");
    assert.include(js, "html: false");
    assert.include(js, "breaks: true");
    assert.include(js, "linkify: false");
    assert.include(js, "highlight: null");
    assert.include(js, "delimiters: \"dollars\"");
    assert.include(js, "return escapeHtml(markdownText);");
    assert.include(js, 'body.classList.add("acp-markdown-body");');
    assert.include(js, 'body.innerHTML = renderMarkdown(String(item.text || ""));');
    assert.include(js, 'meta.textContent = "Tool";');
    assert.include(js, "acp-tool-summary-text");
    assert.include(js, 'meta.textContent = String(item.label || "Status");');
    assert.include(js, "function buildTranscriptRenderItems(items, mode)");
    assert.notInclude(js, 'kind: "assistant_turn"');
    assert.include(js, 'if (mode !== "bubble")');
    assert.include(js, "return canonicalItems;");
    assert.include(js, "buildTranscriptRenderItems(items, mode)");
    assert.include(js, 'item.kind !== "tool_call"');
    assert.include(js, 'item.kind === "plan"');
    assert.include(js, "item.toolCallId || item.id");
    assert.include(js, "buildCanonicalTranscriptItems");
    assert.include(js, "createToolActivityGroup");
    assert.include(js, "flushToolActivityRun");
    assert.include(js, "toolStateRank");
    assert.notInclude(js, "flushToolGroup(entries, toolGroup);");
    assert.notInclude(js, "toolGroup = [];");
    assert.notInclude(js, 'kind: "tool_group"');
    assert.include(js, 'kind: "tool_activity_group",');
    assert.include(js, "state.toolActivityExpandedIds.has(id)");
    assert.include(js, "acp-tool-line");
    assert.include(js, "backendSelectEl.disabled = false;");
    assert.include(js, 'id: "default", label: "Default"');
    assert.include(js, "option.title = entry.label || entry.id;");
    assert.include(js, "reasoningSelectEl.disabled = reasoningOptions.length <= 1;");
    assert.include(js, 'modeSelectEl.closest(".acp-picker").classList.remove("hidden");');
    assert.include(js, 'modelSelectEl.closest(".acp-picker").classList.remove("hidden");');
    assert.include(js, 'reasoningSelectEl.closest(".acp-picker").classList.remove("hidden");');
    assert.notInclude(js, 'classList.toggle("hidden", modeOptions.length === 0)');
    assert.notInclude(js, 'classList.toggle("hidden", modelOptions.length === 0)');
    assert.include(js, "data-acp-item-id");
    assert.include(js, 'acp-permission-banner');
    assert.include(js, 'acp-diagnostics-list');
    assert.notInclude(js, "clearNode(transcriptEl);\n    const items");
    assert.include(js, "resolveSidebarActionBridge");
    assert.include(js, "target.postMessage");
    assert.include(css, ".acp-chat-shell");
    assert.include(css, "position: fixed;");
    assert.include(css, "inset: 0;");
    assert.include(css, "grid-template-rows: auto auto minmax(0, 1fr) auto auto auto;");
    assert.include(css, ".acp-interaction-notices");
    assert.include(css, "grid-row: 3;");
    assert.include(css, ".acp-plan-panel");
    assert.include(css, ".acp-plan-panel.hidden");
    assert.include(css, "grid-row: 4;");
    assert.include(css, "grid-row: 5;");
    assert.include(css, "grid-row: 6;");
    assert.include(css, "overscroll-behavior: contain;");
    assert.include(css, "overflow: hidden;");
    assert.include(css, ".acp-actions-menu");
    assert.include(css, ".acp-session-drawer");
    assert.include(css, ".acp-session-backend-group");
    assert.include(css, ".acp-session-backend-title");
    assert.include(css, ".acp-session-row");
    assert.include(css, ".acp-overlay-panel");
    assert.include(css, ".acp-control-bar");
    assert.include(css, ".acp-control-secondary");
    assert.include(css, ".acp-connection-actions");
    assert.include(css, "grid-template-columns: 2.4fr 3.5fr 2.4fr auto minmax(88px, 1.5fr);");
    assert.include(css, "display: contents;");
    assert.include(css, "white-space: nowrap;");
    assert.include(css, ".acp-updated-at");
    assert.include(css, ".acp-status-details-panel");
    assert.include(css, ".acp-status-banner");
    assert.include(css, ".acp-running-indicator");
    assert.include(css, ".acp-running-spinner");
    assert.include(css, ".acp-interaction-notices.hidden");
    assert.include(css, ".acp-status-pill.is-connected");
    assert.include(css, ".acp-status-pill.is-connecting");
    assert.include(css, ".acp-status-pill.is-idle");
    assert.include(css, ".acp-status-pill.is-error");
    assert.include(css, ".acp-mcp-status-monitor");
    assert.include(css, ".acp-mcp-status-monitor::before");
    assert.include(css, ".acp-mcp-status-monitor.is-running::before");
    assert.include(css, ".acp-mcp-status-monitor.is-ready::before");
    assert.include(css, ".acp-mcp-status-monitor.is-active::before");
    assert.include(css, ".acp-mcp-status-monitor.is-warning::before");
    assert.include(css, ".acp-mcp-status-monitor.is-error::before");
    assert.include(css, ".acp-mcp-status-monitor.is-active::before");
    assert.include(css, "@keyframes acp-status-pulse");
    assert.include(css, "@keyframes acp-spin");
    assert.include(css, ".acp-transcript");
    assert.include(css, ".acp-transcript.plain-mode");
    assert.include(css, ".acp-transcript.bubble-mode");
    assert.include(css, ".acp-transcript.plain-mode .acp-tool-line");
    assert.notInclude(css, ".acp-assistant-turn .acp-message-body");
    assert.notInclude(css, ".acp-turn-tools");
    assert.notInclude(css, ".acp-turn-tools-summary");
    assert.notInclude(css, ".acp-turn-tools-list");
    assert.notInclude(css, ".acp-turn-tool-row");
    assert.include(css, ".acp-tool-activity-group.is-collapsed");
    assert.notInclude(css, ".acp-tool-group.is-collapsed");
    assert.include(css, ".acp-tool-led");
    assert.include(css, ".acp-tool-led.is-completed");
    assert.include(css, ".acp-tool-led.is-failed");
    assert.include(css, ".acp-tool-led.is-running");
    assert.include(css, ".acp-tool-led.is-pending");
    assert.include(css, ".acp-tool-kind-badge");
    assert.include(css, ".acp-markdown-body");
    assert.include(css, ".acp-markdown-body pre");
    assert.include(css, "background: linear-gradient(180deg, #f7fbff 0%, #edf5fb 100%)");
    assert.include(css, "color: #1f3348");
    assert.notInclude(css, "#0f172a");
    assert.notInclude(css, "#f8fafc");
    assert.include(css, ".acp-markdown-body table");
    assert.include(css, ".acp-markdown-body blockquote");
    assert.include(css, ".acp-markdown-body .katex-display");
    assert.include(css, ".acp-plan-status-icon");
    assert.include(css, ".acp-plan-status-icon.is-running");
    assert.include(css, ".acp-plan-status-icon.is-completed");
    assert.include(css, ".acp-plan-status-icon.is-pending");
    assert.include(css, ".acp-plan-entry.is-running");
    assert.include(css, "@media (prefers-reduced-motion: reduce)");
    assert.include(css, ".acp-picker");
    assert.include(css, ".acp-diagnostics-panel");
    assert.include(css, ".acp-permission-banner");
    assert.include(css, ".acp-permission-summary");
    assert.include(css, ".acp-permission-drawer");
    assert.include(css, ".acp-permission-full-command");
    assert.include(css, ".acp-permission-drawer-actions");
    assert.include(css, ".acp-usage-gauge");
    assert.include(css, ".acp-usage-gauge.is-unavailable");
    assert.include(css, ".acp-usage-gauge-ring");
    assert.include(css, "conic-gradient(");
  });

  it("adds dashboard entry points and hook wiring for opening the ACP sidebar", async function () {
    const dialog = await readProjectFile("src/modules/taskManagerDialog.ts");
    const app = await readProjectFile("addon/content/dashboard/app.js");
    const hooks = await readProjectFile("src/hooks.ts");
    const sidebarHost = await readProjectFile("src/modules/acpSidebar.ts");
    const sidebarModel = await readProjectFile("src/modules/acpSidebarModel.ts");
    const sidebarTypes = await readProjectFile("src/modules/acpTypes.ts");
    const sharedHost = await readProjectFile("src/modules/sidebarBrowserHost.ts");
    const skillRunnerSidebar = await readProjectFile("src/modules/skillRunnerSidebar.ts");

    assert.include(dialog, "open-acp-sidebar");
    assert.include(dialog, "homeAcpEntry");
    assert.include(app, "homeAcpEntry");
    assert.include(app, 'sendAction("open-acp-sidebar"');
    assert.include(hooks, "installAcpSidebarShell");
    assert.include(hooks, "removeAcpSidebarShell");
    assert.include(hooks, "openAcpSidebar");
    assert.include(sidebarHost, "__zsAcpSidebarBridge");
    assert.include(sidebarHost, "wrappedJSObject");
    assert.include(sidebarHost, "installSidebarPaneBridge");
    assert.include(sidebarHost, "buildAcpDiagnosticsBundle");
    assert.include(sidebarHost, "copyText");
    assert.include(sidebarHost, "schedulePostSnapshot");
    assert.include(sidebarHost, "postFreshSnapshotToPane");
    assert.include(sidebarHost, "await refreshAcpConversationBackends();");
    assert.include(sidebarHost, "set-active-backend");
    assert.include(sidebarHost, "archive-conversation");
    assert.include(sidebarHost, '"connect"');
    assert.include(sidebarHost, '"disconnect"');
    assert.include(sidebarHost, "set-reasoning-effort");
    assert.include(sidebarHost, "open-backend-manager");
    assert.include(sidebarHost, "set-chat-display-mode");
    assert.include(sidebarHost, "toggle-status-details");
    assert.include(sidebarHost, 'type: "acp:snapshot"');
    assert.include(sidebarModel, "chatDisplayMode");
    assert.include(sidebarModel, "statusExpanded");
    assert.include(sidebarModel, "sessionCwd");
    assert.include(sidebarModel, "commandLine");
    assert.include(sidebarModel, "stderrTail");
    assert.include(sidebarModel, "lastLifecycleEvent");
    assert.include(sidebarModel, "remoteSessionId");
    assert.include(sidebarModel, "remoteSessionRestoreStatus");
    assert.include(sidebarModel, "backendChatSessions");
    assert.include(sidebarTypes, "sessionCwd: string");
    assert.include(sidebarTypes, "remoteSessionId: string");
    assert.include(sidebarTypes, "remoteSessionRestoreStatus");
    assert.include(sidebarTypes, "commandLine: string");
    assert.include(sidebarTypes, "reasoningEffortOptions");
    assert.include(sidebarTypes, "archivedAt?: string");
    assert.include(sidebarTypes, "AcpBackendChatSessions");
    assert.include(sidebarTypes, "stderrTail: string");
    assert.include(sidebarTypes, "lastLifecycleEvent: string");
    assert.include(sidebarTypes, 'AcpChatDisplayMode = "plain" | "bubble"');
    assert.include(sidebarTypes, "AcpDiagnosticsBundle");
    assert.include(sidebarTypes, "mcpServer?:");
    assert.include(sidebarTypes, "mcpHealth?:");
    assert.include(sidebarTypes, "AcpMcpHealthSnapshot");
    assert.include(sidebarTypes, "recentRequests");
    assert.include(sidebarTypes, "jsonrpcToolName");
    assert.include(sidebarTypes, "responseToolCount");
    assert.include(sharedHost, "createSidebarFrame");
    assert.include(sharedHost, "resolveSidebarFrameWindow");
    assert.include(skillRunnerSidebar, 'from "./sidebarBrowserHost"');
  });

  it("adds localized ACP labels for dashboard and sidebar actions", async function () {
    const en = await readProjectFile("addon/locale/en-US/addon.ftl");
    const zh = await readProjectFile("addon/locale/zh-CN/addon.ftl");

    assert.include(en, "task-dashboard-home-acp-title = ACP Chat");
    assert.include(en, "task-dashboard-home-acp-open = Open Chat");
    assert.include(en, "task-dashboard-acp-manage-backends = Manage Backends");
    assert.include(en, "task-dashboard-acp-reasoning = Reasoning");
    assert.include(en, "task-dashboard-acp-conversation = Conversation");
    assert.include(en, "task-dashboard-acp-remote-session = Remote session");
    assert.include(en, "task-dashboard-acp-remote-restore = Remote restore");
    assert.include(en, "task-dashboard-acp-new-conversation = New Conversation");
    assert.include(en, "task-dashboard-acp-rename-conversation = Rename Conversation");
    assert.include(en, "task-dashboard-acp-session-manager = Sessions");
    assert.include(en, "task-dashboard-acp-archive-conversation = Archive");
    assert.include(en, "task-dashboard-acp-connect = Connect");
    assert.include(en, "task-dashboard-acp-disconnect = Disconnect");
    assert.include(zh, "task-dashboard-home-acp-title = ACP 对话");
    assert.include(zh, "task-dashboard-home-acp-open = 打开对话");
    assert.include(zh, "task-dashboard-acp-manage-backends = 管理后端");
    assert.include(zh, "task-dashboard-acp-reasoning = 推理强度");
    assert.include(zh, "task-dashboard-acp-conversation = 对话");
    assert.include(zh, "task-dashboard-acp-remote-session = 远端会话");
    assert.include(zh, "task-dashboard-acp-remote-restore = 远端恢复");
    assert.include(zh, "task-dashboard-acp-new-conversation = 新建对话");
    assert.include(zh, "task-dashboard-acp-rename-conversation = 重命名对话");
    assert.include(zh, "task-dashboard-acp-session-manager = 会话");
    assert.include(zh, "task-dashboard-acp-archive-conversation = 归档");
    assert.include(zh, "task-dashboard-acp-connect = 连接");
    assert.include(zh, "task-dashboard-acp-disconnect = 断开");
  });
});
