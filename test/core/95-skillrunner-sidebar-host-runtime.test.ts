import { assert } from "chai";
import { getProjectRoot, joinPath, readUtf8 } from "../zotero/workflow-test-utils";

async function readProjectFile(relativePath: string) {
  const targetPath = joinPath(getProjectRoot(), relativePath);
  return readUtf8(targetPath);
}

describe("skillrunner sidebar host runtime", function () {
  it("waits for the sidebar frame before falling back to the legacy dialog", async function () {
    const ts = await readProjectFile("src/modules/skillRunnerSidebar.ts");
    assert.include(ts, "FRAME_WINDOW_WAIT_TIMEOUT_MS");
    assert.include(ts, "waitForPaneFrameWindow");
    assert.include(ts, "const frameWindow = await waitForPaneFrameWindow(host.library)");
    assert.include(ts, "const frameWindow = await waitForPaneFrameWindow(host.reader)");
  });

  it("shows waiting toasts only outside the skillrunner sidebar and keeps them localized", async function () {
    const ts = await readProjectFile("src/modules/skillRunnerSidebar.ts");
    const en = await readProjectFile("addon/locale/en-US/addon.ftl");
    const zh = await readProjectFile("addon/locale/zh-CN/addon.ftl");
    assert.include(ts, "showWorkflowToast");
    assert.include(ts, "if (!host.activeTarget)");
    assert.include(ts, "task-dashboard-run-sidebar-toast-waiting-user");
    assert.include(ts, "task-dashboard-run-sidebar-toast-waiting-auth");
    assert.include(en, "task-dashboard-run-sidebar-toast-waiting-user = SkillRunner run needs your input");
    assert.include(en, "task-dashboard-run-sidebar-toast-waiting-auth = SkillRunner run needs authentication");
    assert.include(zh, "task-dashboard-run-sidebar-toast-waiting-user = SkillRunner 运行需要你的输入");
    assert.include(zh, "task-dashboard-run-sidebar-toast-waiting-auth = SkillRunner 运行需要认证");
  });

  it("installs a direct sidebar bridge, resolves multi-parent context, and wires live selection refresh", async function () {
    const ts = await readProjectFile("src/modules/skillRunnerSidebar.ts");
    assert.include(ts, "__zsSkillRunnerSidebarBridge");
    assert.include(ts, "wrappedJSObject");
    assert.include(ts, "libraryLastNativeMode");
    assert.include(ts, "readerLastNativeMode");
    assert.include(ts, "ZoteroPane?.itemPane?.mode");
    assert.include(ts, "ZoteroContextPane");
    assert.include(ts, "primaryParentItemId");
    assert.include(ts, "relatedParentItemIds");
    assert.include(ts, "onSelect.addListener");
    assert.include(ts, "onSelect.removeListener");
    assert.include(ts, "Notifier?.registerObserver");
    assert.include(ts, "Notifier?.unregisterObserver");
    assert.include(ts, "selectionChanged: true");
    assert.notInclude(ts, "switch-shell-mode");
    assert.notInclude(ts, "navigation: {");
  });

  it("keeps no-match copy out of the main hint and lets the completed section collapse at the drawer level", async function () {
    const ts = await readProjectFile("src/modules/skillRunnerSidebar.ts");
    const workspaceTs = await readProjectFile("src/modules/skillRunnerRunDialog.ts");
    const en = await readProjectFile("addon/locale/en-US/addon.ftl");
    const zh = await readProjectFile("addon/locale/zh-CN/addon.ftl");
    assert.include(ts, "drawer: {");
    assert.include(ts, "notice:");
    assert.include(ts, "task-dashboard-run-sidebar-context-global");
    assert.include(ts, "drawerCompletedCollapsed");
    assert.include(ts, "\"toggle-drawer-section\"");
    assert.include(ts, "task-dashboard-run-sidebar-context-related-tooltip");
    assert.include(ts, "task-dashboard-run-running-tasks-title");
    assert.include(ts, "contextHint: context && hasRelated");
    assert.include(ts, "tooltip:");
    assert.include(en, "task-dashboard-run-sidebar-context-related-tooltip = This run matches the current selection.");
    assert.include(zh, "task-dashboard-run-sidebar-context-related-tooltip = 当前运行与选择对象匹配。");
    assert.include(en, "task-dashboard-run-backend = Backend");
    assert.include(zh, "task-dashboard-run-backend = 后端");
    assert.include(en, "task-dashboard-run-running-tasks-title = Running");
    assert.include(zh, "task-dashboard-run-running-tasks-title = 正在运行");
    assert.include(ts, "selectionTasks:");
    assert.include(ts, "return group.activeTasks");
    assert.notInclude(ts, "return [...group.activeTasks, ...group.finishedTasks]");
    assert.include(workspaceTs, "task-dashboard-run-selection-tasks-title");
    assert.include(workspaceTs, "task-dashboard-run-tasks-toggle");
  });

  it("locks pane containers and frames into a vertical stretch chain for the sidebar browser host", async function () {
    const ts = await readProjectFile("src/modules/skillRunnerSidebar.ts");
    assert.include(ts, 'style?.setProperty(\n    "height"');
    assert.include(ts, 'style?.setProperty(\n    "overflow"');
    assert.include(ts, 'style?.setProperty(\n    "flex-direction"');
    assert.include(ts, 'style?.setProperty(\n    "min-height"');
    assert.include(ts, 'style?.setProperty(\n    "display"');
    assert.include(ts, "applyPaneContainerStyles(container)");
    assert.include(ts, "createFrame(doc, resolveSidebarPageUrl())");
  });

  it("reuses the backend icon and shared toolbar sizing helpers for the sidebar toggle button", async function () {
    const sidebarTs = await readProjectFile("src/modules/skillRunnerSidebar.ts");
    const toolbarTs = await readProjectFile("src/modules/dashboardToolbarButton.ts");
    const localeTs = await readProjectFile("src/utils/locale.ts");
    const paneCss = await readProjectFile("addon/content/zoteroPane.css");
    assert.include(sidebarTs, "SKILLRUNNER_ICON_URI");
    assert.include(sidebarTs, "applyToolbarButtonStyling");
    assert.include(sidebarTs, "syncToolbarButtonIconFill");
    assert.include(sidebarTs, "syncSidebarButtonVisuals");
    assert.include(sidebarTs, "task-dashboard-sidebar-skillrunner");
    assert.include(sidebarTs, "close-sidebar");
    assert.include(sidebarTs, "closeActiveSidebarHost");
    assert.include(toolbarTs, "export const SKILLRUNNER_ICON_URI");
    assert.include(toolbarTs, "export function applyToolbarButtonStyling");
    assert.include(toolbarTs, "export function syncToolbarButtonIconFill");
    assert.include(localeTs, "export { initLocale, getString, getLocaleID, getStringOrFallback };");
    assert.include(localeTs, "resolved === getLocaleID(localeString)");
    assert.include(paneCss, "#zotero-context-pane-sidenav .zs-skillrunner-sidebar-button");
    assert.include(paneCss, "#zotero-context-pane-sidenav .zs-skillrunner-sidebar-button > .toolbarbutton-icon");
  });
});
