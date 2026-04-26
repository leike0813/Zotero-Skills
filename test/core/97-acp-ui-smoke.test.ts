import { assert } from "chai";
import { readFile } from "fs/promises";
import path from "path";

async function readProjectFile(relativePath: string) {
  const absolutePath = path.join(process.cwd(), relativePath);
  return readFile(absolutePath, "utf8");
}

describe("acp ui smoke", function () {
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
    assert.include(html, 'id="acp-allow-btn"');
    assert.include(html, 'id="acp-deny-btn"');
    assert.include(html, 'id="acp-diagnostics-toggle-btn"');
    assert.include(html, 'id="acp-diagnostics-copy-btn"');
    assert.include(html, 'id="acp-diagnostics-copy-status"');
    assert.include(html, 'id="acp-diagnostics-panel"');
    assert.include(html, 'id="acp-transcript"');
    assert.include(html, 'id="acp-new-conversation-btn"');
    assert.notInclude(html, 'id="acp-rename-conversation-btn"');
    assert.notInclude(html, 'id="acp-delete-conversation-btn"');
    assert.include(html, 'id="acp-connect-btn"');
    assert.include(html, 'id="acp-disconnect-btn"');
    assert.include(html, 'id="acp-primary-action-btn"');
    assert.include(html, 'id="acp-composer-input"');
    assert.include(html, 'id="acp-workspace-dir"');
    assert.include(html, 'id="acp-runtime-dir"');
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
      html.indexOf('id="acp-chat-mode-plain"'),
    );
    assert.equal(
      html.match(/id="acp-status-summary-text"/g)?.length || 0,
      1,
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
    assert.include(js, "toolGroupExpandedIds");
    assert.include(js, "sessionDrawerOpen");
    assert.include(js, "renderSessionDrawer");
    assert.include(js, "backendChatSessions");
    assert.include(js, "acp-session-backend-group");
    assert.include(js, "backendId: backendId");
    assert.include(js, "buildTranscriptRenderItems");
    assert.include(js, 'if (item.kind === "tool_call")');
    assert.include(js, "flushToolGroup(entries, toolGroup);");
    assert.include(js, "toolGroup = [];");
    assert.include(js, 'kind: "tool_group"');
    assert.include(js, "state.toolGroupExpandedIds.has(id)");
    assert.include(js, "acp-tool-line");
    assert.include(js, "backendSelectEl.disabled = false;");
    assert.include(js, 'id: "default", label: "Default"');
    assert.include(js, "option.title = entry.label || entry.id;");
    assert.include(js, "reasoningSelectEl.disabled = reasoningOptions.length <= 1;");
    assert.include(js, "data-acp-item-id");
    assert.include(js, 'acp-permission-banner');
    assert.include(js, 'acp-diagnostics-list');
    assert.notInclude(js, "clearNode(transcriptEl);\n    const items");
    assert.include(js, "resolveSidebarActionBridge");
    assert.include(js, "target.postMessage");
    assert.include(css, ".acp-chat-shell");
    assert.include(css, "position: fixed;");
    assert.include(css, "inset: 0;");
    assert.include(css, "grid-template-rows: auto auto minmax(0, 1fr) auto auto;");
    assert.include(css, ".acp-interaction-notices");
    assert.include(css, "grid-row: 3;");
    assert.include(css, "grid-row: 5;");
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
    assert.include(css, "grid-template-columns: 3fr 5fr 2fr 2fr;");
    assert.include(css, "display: contents;");
    assert.include(css, "white-space: nowrap;");
    assert.include(css, ".acp-updated-at");
    assert.include(css, ".acp-status-details-panel");
    assert.include(css, ".acp-status-banner");
    assert.include(css, ".acp-transcript");
    assert.include(css, ".acp-transcript.plain-mode");
    assert.include(css, ".acp-transcript.bubble-mode");
    assert.include(css, ".acp-transcript.plain-mode .acp-tool-line");
    assert.include(css, ".acp-tool-group.is-collapsed");
    assert.include(css, ".acp-picker");
    assert.include(css, ".acp-diagnostics-panel");
    assert.include(css, ".acp-permission-banner");
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
