import { assert } from "chai";
import { getProjectRoot, joinPath, readUtf8 } from "../zotero/workflow-test-utils";

async function readProjectFile(relativePath: string) {
  const targetPath = joinPath(getProjectRoot(), relativePath);
  return readUtf8(targetPath);
}

describe("skillrunner run dialog ui e2e alignment", function () {
  it("uses static dom scaffold for conversation cards and textarea composer", async function () {
    const html = await readProjectFile("addon/content/dashboard/run-dialog.html");
    assert.include(html, 'id="workspace-groups"');
    assert.include(html, 'id="workspace-empty"');
    assert.include(html, 'id="workspace-global-actions"');
    assert.include(html, 'id="sessions-toggle-btn"');
    assert.include(html, 'id="close-sidebar-btn"');
    assert.include(html, 'id="selection-task-strip"');
    assert.include(html, 'id="selection-task-title"');
    assert.include(html, 'id="selection-task-list"');
    assert.include(html, 'id="chat-panel"');
    assert.include(html, 'id="chat-mode-plain"');
    assert.include(html, 'id="chat-mode-bubble"');
    assert.include(html, 'id="prompt-card"');
    assert.include(html, 'id="prompt-card-files"');
    assert.include(html, 'id="auth-card"');
    assert.include(html, 'id="final-summary-status"');
    assert.include(html, 'id="reply-composer"');
    assert.include(html, 'id="reply-text"');
    assert.match(html, /<textarea[^>]*id="reply-text"/);
    assert.include(html, 'src="./chat_thinking_core.js?v=');
    assert.include(html, 'vendor/markdown-it/markdown-it.min.js');
    assert.include(html, 'vendor/katex/katex.min.css');
    assert.include(html, 'vendor/katex/katex.min.js');
    assert.include(html, 'vendor/markdown-it-texmath/texmath.min.js');
    assert.notInclude(html, 'id="shell-mode-rail"');
    assert.notInclude(html, 'id="app" class="run-root"');
  });

  it("keeps composer visibility and enabled state driven by state machine helpers", async function () {
    const js = await readProjectFile("addon/content/dashboard/run-dialog.js");
    assert.include(js, "function resolveStatusSemantics");
    assert.include(js, "snapshot.statusSemantics");
    assert.include(js, "function setReplyEnabled");
    assert.include(js, "function setReplyComposerVisible");
    assert.include(js, "function setReplyComposerCompact");
    assert.include(js, "semantics.normalized === \"waiting_user\"");
    assert.include(js, "semantics.normalized === \"waiting_auth\"");
    assert.include(js, "setReplyComposerVisible(false)");
    assert.include(js, "setReplyComposerVisible(true)");
    assert.include(js, "setReplyComposerCompact(compactReply)");
    assert.include(js, "replyPlaceholderAlternative");
  });

  it("aligns interactive submit flow with explicit run state refresh after submit", async function () {
    const hostTs = await readProjectFile("src/modules/skillRunnerRunDialog.ts");
    assert.include(hostTs, "const refreshRunState = async () =>");
    assert.include(hostTs, "entry.refreshState = () =>");
    assert.include(hostTs, "entry.refreshDisplay = () =>");
    assert.include(hostTs, "syncSessionStateFromLedger(entry)");
    assert.include(hostTs, "subscribeSkillRunnerSessionState");
    assert.include(hostTs, "await syncPendingState()");
    assert.include(hostTs, "const hasStructuredPending =");
    assert.include(hostTs, "displayText: entryItem.displayText");
    assert.include(hostTs, "displayFormat: entryItem.displayFormat");
    assert.include(hostTs, "ensureSkillRunnerSessionSync");
    assert.include(hostTs, "streamRunChat");
    assert.include(hostTs, "initialStatus: target.item.status");
    assert.notInclude(hostTs, "runWorkspaceState.refreshTimer = dialogWindow.setInterval");
  });

  it("restarts events state sync after waiting_auth exit instead of relying on chat snapshot", async function () {
    const hostTs = await readProjectFile("src/modules/skillRunnerRunDialog.ts");
    assert.include(hostTs, "restartSessionSyncAfterWaitingExit");
    assert.include(hostTs, "hasRunDialogWaitingAuthExited");
    assert.include(hostTs, "stopSessionSync({");
    assert.include(hostTs, "setInterval(");
  });

  it("does not full-refresh root dom on every snapshot", async function () {
    const js = await readProjectFile("addon/content/dashboard/run-dialog.js");
    assert.notInclude(js, "clearNode(app)");
    assert.notInclude(js, "while (node.firstChild)");
    assert.include(js, "applySnapshot(data.payload || null)");
    assert.include(js, "renderedChatOrder");
    assert.include(js, "resetConversationRenderState");
    assert.include(js, "appendChatBubble");
  });

  it("prefers sidebar bridge actions and renders drawer-scoped context notice without a mode rail", async function () {
    const html = await readProjectFile("addon/content/dashboard/run-dialog.html");
    const js = await readProjectFile("addon/content/dashboard/run-dialog.js");
    assert.include(html, 'id="workspace-global-actions"');
    assert.notInclude(html, 'id="shell-mode-rail"');
    assert.include(html, 'id="workspace-context-note"');
    assert.include(html, 'id="context-indicator"');
    assert.notInclude(html, 'id="context-hint"');
    assert.include(js, "__zsSkillRunnerSidebarBridge");
    assert.include(js, "window.wrappedJSObject");
    assert.include(js, "workspaceContextNoteEl");
    assert.include(js, "drawer.notice");
    assert.include(js, "contextIndicatorEl");
    assert.include(js, "closeSidebarBtnEl");
    assert.include(js, "selectionTaskStripEl");
    assert.include(js, "selectionTaskTitleEl");
    assert.include(js, "selectionTaskListEl");
    assert.include(js, "hint.hasRelated !== true");
    assert.notInclude(js, "function renderSidebarModeRail");
  });

  it("keeps option reply payload as raw response value and supports auth method selection", async function () {
    const js = await readProjectFile("addon/content/dashboard/run-dialog.js");
    assert.include(js, "responseValue: opt.value");
    assert.include(js, "kind: \"auth_method\"");
    assert.include(js, "submission:");
    assert.include(js, "\"auth_code_or_url\"");
    assert.notInclude(js, "\"authorization_code\"");
  });

  it("uses compatible chat-core wrapper and mode-aware markdown rendering", async function () {
    const js = await readProjectFile("addon/content/dashboard/run-dialog.js");
    assert.include(js, "function createCompatibleThinkingChatModel");
    assert.include(js, "DEFAULT_INTERACTION_PROMPT");
    assert.include(js, "raw.displayText || raw.display_text");
    assert.include(js, "typeof model.setDisplayMode === \"function\"");
    assert.include(js, "typeof model.getDisplayMode === \"function\"");
    assert.include(js, "typeof model.toggleRevision !== \"function\"");
    assert.include(js, "function renderMarkdown");
    assert.include(js, "html: false");
    assert.include(js, "breaks: true");
    assert.include(js, "delimiters: \"dollars\"");
    assert.include(js, "body.innerHTML = renderMarkdown");
    assert.include(js, "setChatDisplayMode(\"plain\")");
    assert.include(js, "setChatDisplayMode(\"bubble\")");
  });

  it("renders assistant_revision through dedicated revision branches instead of normal assistant bubbles", async function () {
    const js = await readProjectFile("addon/content/dashboard/run-dialog.js");
    assert.include(js, "function renderRevisionEntry");
    assert.include(js, "entry.type === \"revision\"");
    assert.include(js, "chat-plain-revision");
    assert.include(js, "revision-bubble");
    assert.include(js, "roleRevision");
    assert.include(js, "revisionCollapsedPrefix");
    assert.include(js, "state.chatModel.toggleRevision");
    assert.include(js, "kind.trim().toLowerCase() !== \"assistant_revision\"");
  });

  it("keeps pending prompt card and terminal summary split aligned with backend-driven display", async function () {
    const js = await readProjectFile("addon/content/dashboard/run-dialog.js");
    assert.include(js, "safeText(uiHints.prompt).trim()");
    assert.include(js, "uploadSpecs(uiHints.files)");
    assert.include(js, "promptFilesEl");
    assert.include(js, "promptTextEl.textContent = \"\"");
    assert.include(js, "promptTextEl.classList.add(\"hidden\")");
    assert.notInclude(js, "promptTextEl.textContent = p.prompt");
    assert.include(js, "renderFinalSummary(semantics.normalized)");
    assert.notInclude(js, "isStructuredDoneMessage");
  });

  it("keeps dedicated plain and bubble chat styling hooks", async function () {
    const css = await readProjectFile("addon/content/dashboard/run-dialog.css");
    assert.include(css, ".chat-panel.plain-mode");
    assert.include(css, ".chat-panel.bubble-mode");
    assert.include(css, ".chat-plain-process");
    assert.include(css, ".chat-plain-revision");
    assert.include(css, ".chat-plain-body");
    assert.include(css, ".thinking-bubble");
    assert.include(css, ".revision-bubble");
    assert.include(css, "#reply-composer.compact");
    assert.include(css, "line-height: 1.4");
    assert.include(css, "line-height: 1.5");
  });

  it("renders two-section sidebar sessions with relation-state task styling", async function () {
    const js = await readProjectFile("addon/content/dashboard/run-dialog.js");
    const css = await readProjectFile("addon/content/dashboard/run-dialog.css");
    assert.include(js, 'sendAction("select-task"');
    assert.include(js, 'sendAction("toggle-group-collapse"');
    assert.include(js, 'sendAction("toggle-finished-collapse"');
    assert.include(js, 'sendAction("toggle-drawer"');
    assert.include(js, 'sendAction("close-sidebar"');
    assert.include(js, 'sendAction("toggle-drawer-section"');
    assert.include(js, "selectionTasks.tasks");
    assert.include(js, "workspaceLabels().tasksToggle");
    assert.include(js, "workspaceLabels().selectionTasksTitle");
    assert.include(js, 'itemLabel ? `${itemLabel} · ${selectionTitle}` : selectionTitle');
    assert.notInclude(js, 'sendAction("switch-shell-mode"');
    assert.include(js, 'section.id === "completed"');
    assert.include(js, "section.collapsed === true");
    assert.include(js, "task.relationState");
    assert.include(js, '" related"');
    assert.include(js, 'isCompact ? " compact" : ""');
    assert.include(js, "workspaceLabels().completedTasksTitle");
    assert.include(js, "workspaceLabels().waitingRequestId");
    assert.include(js, "task-tab-workflow");
    assert.include(js, "task.workflowLabel");
    assert.include(css, ".task-tab.related");
  });

  it("uses task-style workspace titles, compact meta chips, and keeps sidebar chat as the stretching content area", async function () {
    const hostTs = await readProjectFile("src/modules/skillRunnerRunDialog.ts");
    const html = await readProjectFile("addon/content/dashboard/run-dialog.html");
    const js = await readProjectFile("addon/content/dashboard/run-dialog.js");
    const css = await readProjectFile("addon/content/dashboard/run-dialog.css");
    assert.include(hostTs, "task-dashboard-run-workspace-title");
    assert.include(hostTs, "selectedTask?.title");
    assert.notInclude(hostTs, 'title: localize("task-dashboard-run-dialog-title"');
    assert.include(html, 'class="banner-top-row"');
    assert.include(html, 'class="title-cluster"');
    assert.include(html, 'id="run-subtitle"');
    assert.include(html, 'id="conversation-title"');
    assert.include(html, 'id="close-sidebar-btn"');
    assert.include(html, 'id="selection-task-strip"');
    assert.include(css, ".workspace-main");
    assert.include(css, ".selection-task-strip");
    assert.include(css, ".selection-task-list");
    assert.include(css, ".selection-task-btn");
    assert.include(css, ".meta-strip");
    assert.include(css, ".context-indicator");
    assert.include(css, ".btn.btn-danger");
    assert.include(css, "white-space: nowrap");
    assert.include(css, ".banner-top-row");
    assert.include(css, ".title-cluster");
    assert.include(css, "width: 14px");
    assert.notInclude(css, ".meta-grid");
    assert.notInclude(css, ".context-hint");
    assert.include(css, ".conversation-card");
    assert.include(css, "#chat-panel");
    assert.include(css, "grid-template-rows: auto minmax(0, 1fr)");
    assert.include(css, ".workspace-root.layout-sidebar .workspace-main");
    assert.include(css, "grid-template-rows: auto auto auto minmax(0, 1fr)");
    assert.include(css, ".workspace-root.layout-sidebar .banner-top-row");
    assert.include(css, ".workspace-root:not(.layout-sidebar)");
    assert.notInclude(css, ".conversation-body");
    assert.include(css, "min-height: 220px");
    assert.notInclude(html, 'class="conversation-body"');
    assert.include(js, "function queueLayoutSync");
    assert.include(js, "function syncSidebarLayoutHeights");
    assert.include(js, "workspaceLabels().conversationTitle");
    assert.include(js, "workspaceLabels().closeSidebar");
    assert.include(js, "workspaceLabels().tasksToggle");
    assert.include(js, "window.addEventListener(\"resize\"");
    assert.include(js, "document.addEventListener(\"visibilitychange\"");
    assert.include(js, "window.addEventListener(\"focus\"");
    assert.include(js, "queueLayoutSync()");
    assert.notInclude(js, "conversationBodyEl");
    assert.notInclude(js, "function resolveSidebarHostHeight");
    assert.notInclude(js, "window.visualViewport");
    assert.notInclude(js, "window.innerHeight");
    assert.notInclude(js, "window.frameElement");
    assert.notInclude(js, "--sidebar-viewport-height");
    assert.notInclude(js, "const conversationBodyHeight =");
    assert.notInclude(js, "const bannerHeight =");
    assert.notInclude(js, "const replyHeight =");
    assert.notInclude(js, "pendingIdEl");
    assert.notInclude(js, "pendingOwnerEl");
    assert.notInclude(html, 'id="meta-label-pending-id"');
    assert.notInclude(html, 'id="meta-label-pending-owner"');
  });

  it("falls back to localized confirm options when kind=confirm and options are missing", async function () {
    const js = await readProjectFile("addon/content/dashboard/run-dialog.js");
    assert.include(js, "kind === \"confirm\"");
    assert.include(js, "options.length === 0");
    assert.include(js, "l.confirmYes");
    assert.include(js, "l.confirmNo");
    assert.include(js, "value: yesText");
    assert.include(js, "value: noText");
    assert.notInclude(js, "value: true");
    assert.notInclude(js, "value: false");
  });
});
