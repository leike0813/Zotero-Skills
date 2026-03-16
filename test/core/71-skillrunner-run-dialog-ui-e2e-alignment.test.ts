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
    assert.include(html, 'id="chat-panel"');
    assert.include(html, 'id="prompt-card"');
    assert.include(html, 'id="auth-card"');
    assert.include(html, 'id="reply-composer"');
    assert.include(html, 'id="reply-text"');
    assert.match(html, /<textarea[^>]*id="reply-text"/);
    assert.include(html, 'src="./chat_thinking_core.js"');
    assert.notInclude(html, 'id="app" class="run-root"');
  });

  it("keeps composer visibility and enabled state driven by state machine helpers", async function () {
    const js = await readProjectFile("addon/content/dashboard/run-dialog.js");
    assert.include(js, "function resolveStatusSemantics");
    assert.include(js, "snapshot.statusSemantics");
    assert.include(js, "function setReplyEnabled");
    assert.include(js, "function setReplyComposerVisible");
    assert.include(js, "semantics.normalized === \"waiting_user\"");
    assert.include(js, "semantics.normalized === \"waiting_auth\"");
    assert.include(js, "setReplyComposerVisible(false)");
    assert.include(js, "setReplyComposerVisible(true)");
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
    assert.include(hostTs, "ensureSkillRunnerSessionSync");
    assert.include(hostTs, "streamRunChat");
    assert.include(hostTs, "initialStatus: target.item.status");
    assert.notInclude(hostTs, "runWorkspaceState.refreshTimer = dialogWindow.setInterval");
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

  it("keeps option reply payload as raw response value and supports auth method selection", async function () {
    const js = await readProjectFile("addon/content/dashboard/run-dialog.js");
    assert.include(js, "responseValue: opt.value");
    assert.include(js, "kind: \"auth_method\"");
    assert.include(js, "submission:");
  });

  it("renders workspace grouping actions and compact finished task tabs", async function () {
    const js = await readProjectFile("addon/content/dashboard/run-dialog.js");
    assert.include(js, 'sendAction("select-task"');
    assert.include(js, 'sendAction("toggle-group-collapse"');
    assert.include(js, 'sendAction("toggle-finished-collapse"');
    assert.include(js, 'isCompact ? " compact" : ""');
    assert.include(js, "workspaceLabels().completedTasksTitle");
    assert.include(js, "workspaceLabels().waitingRequestId");
    assert.include(js, "task-tab-workflow");
    assert.include(js, "task.workflowLabel");
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
