import type { DialogHelper } from "zotero-plugin-toolkit";
import { loadBackendsRegistry } from "../backends/registry";
import type { BackendInstance } from "../backends/types";
import { PASS_THROUGH_BACKEND_TYPE } from "../config/defaults";
import { getString } from "../utils/locale";
import { resolveBackendDisplayName } from "../backends/displayName";
import { isWindowAlive } from "../utils/window";
import { listRuntimeLogs } from "./runtimeLogManager";
import {
  cleanupTaskDashboardHistory,
  listTaskDashboardHistory,
  summarizeTaskDashboardHistory,
  type TaskDashboardHistoryRecord,
} from "./taskDashboardHistory";
import {
  mergeDashboardTaskRows,
  normalizeDashboardBackends,
  normalizeDashboardTabKey,
} from "./taskDashboardSnapshot";
import { getLoadedWorkflowEntries } from "./workflowRuntime";
import {
  listActiveWorkflowTasks,
  subscribeWorkflowTasks,
  type WorkflowTaskRecord,
} from "./taskRuntime";
import { openSkillRunnerManagementDialog } from "./skillRunnerManagementDialog";
import { config } from "../../package.json";
import { resolveAddonRef } from "../utils/runtimeBridge";
import { buildSkillRunnerManagementClient } from "./skillRunnerManagementClientFactory";
import { openSkillRunnerRunDialog } from "./skillRunnerRunDialog";
import { openLogViewerDialogWithArgs } from "./logViewerDialog";
import {
  buildWorkflowSettingsUiDescriptor,
  updateWorkflowSettings,
  type WorkflowSettingsUiDescriptor,
} from "./workflowSettings";
import type { WorkflowExecutionOptions } from "./workflowSettingsDomain";
import {
  isTerminal,
  isWaiting,
  normalizeStatus,
} from "./skillRunnerProviderStateMachine";

type DashboardState = {
  backends: BackendInstance[];
  backendLoadError?: string;
  selectedTabKey: string;
  selectedLogTaskByBackendId: Map<string, string>;
  selectedLogEntryByBackendId: Map<string, string>;
  selectedWorkflowOptionsWorkflowId: string;
  workflowSettingsDraftById: Map<string, WorkflowExecutionOptions>;
  workflowSettingsSaveStateById: Map<string, "idle" | "saving" | "saved" | "error">;
  workflowSettingsSaveErrorById: Map<string, string>;
  workflowSettingsSaveTimerById: Map<string, number>;
};

type DashboardRow = {
  id: string;
  workflowId: string;
  workflowLabel: string;
  backendId: string;
  backendType: string;
  backendLabel: string;
  taskName: string;
  state: string;
  stateSemantics: {
    normalized: string;
    terminal: boolean;
    waiting: boolean;
  };
  stateLabel: string;
  requestId?: string;
  engine?: string;
  jobId: string;
  runId: string;
  createdAt: string;
  updatedAt: string;
};

type DashboardLogRow = {
  id: string;
  ts: string;
  level: string;
  scope: string;
  stage: string;
  message: string;
  workflowId?: string;
  requestId?: string;
  jobId?: string;
  detailPayload: unknown;
};

type DashboardSnapshot = {
  generatedAt: string;
  title: string;
  labels: Record<string, string>;
  selectedTabKey: string;
  tabs: Array<{
    key: string;
    label: string;
    backendId?: string;
    backendType?: string;
  }>;
  summary: {
    total: number;
    running: number;
    succeeded: number;
    failed: number;
    canceled: number;
  };
  runningRows: DashboardRow[];
  backendLoadError?: string;
  workflowOptionsView?: {
    workflows: Array<{
      workflowId: string;
      workflowLabel: string;
      providerId: string;
    }>;
    selectedWorkflowId: string;
    selectedDescriptor?: WorkflowSettingsUiDescriptor;
    saveState: "idle" | "saving" | "saved" | "error";
    saveError?: string;
  };
  backendView?: {
    backendId: string;
    backendType: string;
    backendBaseUrl: string;
    title: string;
    rows: DashboardRow[];
    emptyRowsText: string;
    selectedLogTaskId?: string;
    selectedLogTaskRequestId?: string;
    selectedLogTaskJobId?: string;
    logRows: DashboardLogRow[];
    selectedLogEntryId?: string;
    selectedLogEntryPayload?: unknown;
  };
};

type DashboardActionEnvelope = {
  type: "dashboard:action";
  action: string;
  payload?: Record<string, unknown>;
};

function resolveDashboardPageUrl() {
  const addonRef = String(config.addonRef || "").trim() || resolveAddonRef("");
  if (!addonRef) {
    return "about:blank";
  }
  return `chrome://${addonRef}/content/dashboard/index.html`;
}

let taskManagerDialog: DialogHelper | undefined;
let externalSelectTab:
  | ((args: { tabKey?: string; workflowId?: string }) => void)
  | undefined;

function localize(
  key: string,
  fallback: string,
  options?: { args?: Record<string, unknown> },
) {
  try {
    const resolved = String(
      options ? getString(key as any, options) : getString(key as any),
    ).trim();
    return resolved || fallback;
  } catch {
    return fallback;
  }
}

function toBackendTabKey(backendId: string) {
  return `backend:${backendId}`;
}

function fromBackendTabKey(tabKey: string) {
  if (!tabKey.startsWith("backend:")) {
    return "";
  }
  return tabKey.slice("backend:".length).trim();
}

function compactError(error: unknown) {
  const text = String(error || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "unknown error";
  }
  return text.length > 220 ? `${text.slice(0, 220)}...` : text;
}

function normalizeDraftChangedSection(raw: unknown) {
  const section = String(raw || "").trim();
  if (
    section === "backend" ||
    section === "workflowParams" ||
    section === "providerOptions"
  ) {
    return section;
  }
  return "";
}

function normalizeDraftChangedKey(raw: unknown) {
  return String(raw || "").trim();
}

function isWorkflowSettingsStructuralRefreshChange(args: {
  changedSection: string;
  changedKey: string;
}) {
  if (args.changedSection === "backend" && args.changedKey === "backendId") {
    return true;
  }
  if (
    args.changedSection === "providerOptions" &&
    (args.changedKey === "engine" || args.changedKey === "model_provider")
  ) {
    return true;
  }
  return false;
}

function isSkillRunnerBackend(backend: BackendInstance) {
  return String(backend.type || "").trim() === "skillrunner";
}

function resolveStatusLabel(state: string) {
  const normalized = normalizeStatus(state, "running");
  if (normalized === "queued") {
    return localize("task-manager-status-queued", "Queued");
  }
  if (normalized === "running") {
    return localize("task-manager-status-running", "Running");
  }
  if (normalized === "waiting_user") {
    return localize("task-dashboard-status-waiting-user", "Waiting User");
  }
  if (normalized === "waiting_auth") {
    return localize("task-dashboard-status-waiting-auth", "Waiting Auth");
  }
  if (normalized === "succeeded") {
    return localize("task-dashboard-status-succeeded", "Succeeded");
  }
  if (normalized === "failed") {
    return localize("task-dashboard-status-failed", "Failed");
  }
  if (normalized === "canceled") {
    return localize("task-dashboard-status-canceled", "Canceled");
  }
  return normalized || localize("task-dashboard-status-unknown", "Unknown");
}

function isTerminalWorkflowTaskState(state: string) {
  return isTerminal(state);
}

function mapTaskRow(task: WorkflowTaskRecord): DashboardRow {
  return mapTaskRowWithMeta(task);
}

function mapTaskRowWithMeta(
  task: WorkflowTaskRecord,
  options?: {
    backendMetaById?: Map<
      string,
      {
        type?: string;
        displayName?: string;
      }
    >;
  },
): DashboardRow {
  const normalizedState = normalizeStatus(task.state, "running");
  const backendId = String(task.backendId || "").trim();
  const backendMeta = backendId
    ? options?.backendMetaById?.get(backendId)
    : undefined;
  const backendType =
    String(task.backendType || "").trim() ||
    String(backendMeta?.type || "").trim();
  const backendDisplayName = backendId
    ? resolveBackendDisplayName(
        backendId,
        String(backendMeta?.displayName || "").trim() || undefined,
      )
    : "";
  const backendLabel = backendDisplayName
    ? backendType
      ? `${backendDisplayName} (${backendType})`
      : backendDisplayName
    : backendType || "-";
  return {
    id: task.id,
    workflowId: task.workflowId,
    workflowLabel: task.workflowLabel,
    backendId,
    backendType,
    backendLabel,
    taskName: task.taskName,
    state: normalizedState,
    stateSemantics: {
      normalized: normalizedState,
      terminal: isTerminal(normalizedState),
      waiting: isWaiting(normalizedState),
    },
    stateLabel: resolveStatusLabel(normalizedState),
    requestId: task.requestId,
    engine: task.engine,
    jobId: task.jobId,
    runId: task.runId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function toLogFilter(row: DashboardRow) {
  if (row.requestId) {
    return {
      requestId: row.requestId,
    };
  }
  if (row.jobId) {
    return {
      jobId: row.jobId,
    };
  }
  return {
    workflowId: row.workflowId,
  };
}

function mapLogRow(entry: ReturnType<typeof listRuntimeLogs>[number]): DashboardLogRow {
  return {
    id: entry.id,
    ts: entry.ts,
    level: entry.level,
    scope: entry.scope,
    stage: entry.stage,
    message: entry.message,
    workflowId: entry.workflowId,
    requestId: entry.requestId,
    jobId: entry.jobId,
    detailPayload: {
      ...entry,
    },
  };
}

function createDashboardFrame(doc: Document, pageUrl: string) {
  const isChromeLocalPage = /^chrome:\/\//i.test(String(pageUrl || ""));
  if (isChromeLocalPage) {
    const frame = doc.createElement("iframe");
    frame.setAttribute("data-zs-role", "task-dashboard-frame");
    frame.src = pageUrl;
    frame.style.width = "100%";
    frame.style.height = "100%";
    frame.style.minHeight = "0";
    frame.style.flex = "1";
    frame.style.border = "none";
    return frame;
  }
  const createXul = (doc as { createXULElement?: (tag: string) => Element })
    .createXULElement;
  if (typeof createXul === "function") {
    const browser = createXul.call(doc, "browser");
    browser.setAttribute("data-zs-role", "task-dashboard-frame");
    browser.setAttribute("disableglobalhistory", "true");
    browser.setAttribute("remote", "true");
    browser.setAttribute("maychangeremoteness", "true");
    browser.setAttribute("type", "content");
    browser.setAttribute("flex", "1");
    browser.setAttribute("src", pageUrl);
    (
      browser as Element & { style?: CSSStyleDeclaration }
    ).style?.setProperty("width", "100%");
    (
      browser as Element & { style?: CSSStyleDeclaration }
    ).style?.setProperty("height", "100%");
    (
      browser as Element & { style?: CSSStyleDeclaration }
    ).style?.setProperty("min-height", "0");
    (
      browser as Element & { style?: CSSStyleDeclaration }
    ).style?.setProperty("flex", "1");
    return browser;
  }
  const frame = doc.createElement("iframe");
  frame.setAttribute("data-zs-role", "task-dashboard-frame");
  frame.src = pageUrl;
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.style.minHeight = "0";
  frame.style.flex = "1";
  frame.style.border = "none";
  return frame;
}

function resolveDashboardFrameWindow(frame: Element | null) {
  if (!frame) {
    return null;
  }
  const candidate = frame as Element & { contentWindow?: Window | null };
  return candidate.contentWindow || null;
}

function clearWorkflowSettingsSaveTimer(state: DashboardState, workflowId: string) {
  if (!taskManagerDialog?.window) {
    return;
  }
  const keys = Array.from(state.workflowSettingsSaveTimerById.keys()).filter(
    (key) => key === workflowId || key.startsWith(`${workflowId}:`),
  );
  for (const key of keys) {
    const timer = state.workflowSettingsSaveTimerById.get(key);
    if (timer) {
      taskManagerDialog.window.clearTimeout(timer);
    }
    state.workflowSettingsSaveTimerById.delete(key);
  }
}

async function buildWorkflowOptionsView(args: {
  state: DashboardState;
  backends: BackendInstance[];
}) {
  const loaded = getLoadedWorkflowEntries();
  if (loaded.length === 0) {
    return {
      workflows: [],
      selectedWorkflowId: "",
      saveState: "idle" as const,
    };
  }
  const baseDescriptors = await Promise.all(
    loaded.map(async (workflow) => ({
      workflow,
      descriptor: await buildWorkflowSettingsUiDescriptor({
        workflow,
        candidateBackends: args.backends,
      }),
    })),
  );
  const configurable = baseDescriptors.filter(
    (entry) => entry.descriptor.hasConfigurableSettings,
  );
  if (configurable.length === 0) {
    return {
      workflows: [],
      selectedWorkflowId: "",
      saveState: "idle" as const,
    };
  }
  const selectedWorkflowId = configurable.some(
    (entry) => entry.workflow.manifest.id === args.state.selectedWorkflowOptionsWorkflowId,
  )
    ? args.state.selectedWorkflowOptionsWorkflowId
    : configurable[0].workflow.manifest.id;
  args.state.selectedWorkflowOptionsWorkflowId = selectedWorkflowId;
  const selectedWorkflow = configurable.find(
    (entry) => entry.workflow.manifest.id === selectedWorkflowId,
  )?.workflow;
  const selectedDescriptor = selectedWorkflow
    ? await buildWorkflowSettingsUiDescriptor({
        workflow: selectedWorkflow,
        candidateBackends: args.backends,
        draft: args.state.workflowSettingsDraftById.get(selectedWorkflowId),
      })
    : undefined;
  const saveState =
    args.state.workflowSettingsSaveStateById.get(selectedWorkflowId) || "idle";
  const saveError = args.state.workflowSettingsSaveErrorById.get(
    selectedWorkflowId,
  );
  return {
    workflows: configurable.map((entry) => ({
      workflowId: entry.workflow.manifest.id,
      workflowLabel: entry.workflow.manifest.label,
      providerId: entry.descriptor.providerId,
    })),
    selectedWorkflowId,
    selectedDescriptor,
    saveState,
    saveError: saveError || undefined,
  };
}

async function buildDashboardSnapshot(args: {
  state: DashboardState;
  backends: BackendInstance[];
  history: TaskDashboardHistoryRecord[];
  active: WorkflowTaskRecord[];
}) {
  const summary = summarizeTaskDashboardHistory(args.history);
  const selectedTabKey = normalizeDashboardTabKey({
    requestedTabKey: args.state.selectedTabKey,
    backends: args.backends,
  });
  args.state.selectedTabKey = selectedTabKey;

  const backendMetaById = new Map<
    string,
    {
      type?: string;
      displayName?: string;
    }
  >(
    args.backends.map((entry) => [
      String(entry.id || "").trim(),
      {
        type: String(entry.type || "").trim() || undefined,
        displayName: String(entry.displayName || "").trim() || undefined,
      },
    ]),
  );

  const runningRows = args.active
    .map((entry) =>
      mapTaskRowWithMeta(entry, {
        backendMetaById,
      }),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const labels = {
    home: localize("task-dashboard-tab-home", "Dashboard Home"),
    tabHome: localize("task-dashboard-tab-home", "Dashboard Home"),
    tabWorkflowOptions: localize(
      "task-dashboard-tab-workflow-options",
      "Workflow Options",
    ),
    tabBackends: localize("task-dashboard-tab-backends", "Backends"),
    runningTitle: localize("task-dashboard-running-title", "Active Tasks"),
    summaryTotal: localize("task-dashboard-summary-total", "Total"),
    summaryRunning: localize("task-dashboard-summary-running", "Running"),
    summarySucceeded: localize("task-dashboard-summary-succeeded", "Succeeded"),
    summaryFailed: localize("task-dashboard-summary-failed", "Failed"),
    summaryCanceled: localize("task-dashboard-summary-canceled", "Canceled"),
    colTask: localize("task-manager-column-task", "Task"),
    colWorkflow: localize("task-manager-column-workflow", "Workflow"),
    colBackend: localize("task-dashboard-col-backend", "Backend"),
    colStatus: localize("task-manager-column-status", "Status"),
    colRequestId: localize("task-dashboard-col-request-id", "Request ID"),
    colJobId: localize("task-dashboard-col-job-id", "Job ID"),
    colEngine: localize("task-dashboard-col-engine", "Engine"),
    colTime: localize("task-dashboard-col-time", "Time"),
    colLevel: localize("task-dashboard-col-level", "Level"),
    colStage: localize("task-dashboard-col-stage", "Stage"),
    colScope: localize("task-dashboard-col-scope", "Scope"),
    colMessage: localize("task-dashboard-col-message", "Message"),
    colUpdatedAt: localize("task-dashboard-col-updated-at", "Updated At"),
    colActions: localize("task-dashboard-col-actions", "Actions"),
    noBackends: localize("task-dashboard-sidebar-empty", "No backend profiles."),
    noRunning: localize("task-dashboard-running-empty", "No active tasks."),
    noHistory: localize("task-dashboard-detail-empty", "Select one backend from sidebar."),
    backendNoTasks: localize("task-dashboard-backend-empty", "No tasks for this backend."),
    openManagement: localize("task-dashboard-open-management", "Open Backend UI"),
    openRun: localize("task-dashboard-open-run", "Open Run"),
    cancelRun: localize("task-dashboard-skillrunner-cancel", "Cancel Run"),
    logsTitle: localize("task-dashboard-generic-logs-title", "Runtime Logs"),
    logsEmpty: localize("task-dashboard-generic-logs-empty", "No runtime logs captured."),
    logsBoundTask: localize("task-dashboard-generic-logs-bound-task", "Bound Task"),
    logsBoundRequestId: localize(
      "task-dashboard-generic-logs-bound-request-id",
      "Bound Request ID",
    ),
    logsBoundJobId: localize("task-dashboard-generic-logs-bound-job-id", "Bound Job ID"),
    logsDetailTitle: localize("task-dashboard-generic-logs-detail-title", "Log Details"),
    logsViewTask: localize("task-dashboard-generic-logs-view-task", "Bind Logs"),
    logsOpenDiagnostics: localize(
      "task-dashboard-generic-logs-open-diagnostics",
      "Diagnostic Export",
    ),
    workflowSettingsNoConfigurable: localize(
      "task-dashboard-workflow-settings-empty",
      "No configurable workflows.",
    ),
    workflowSettingsWorkflowLabel: localize(
      "workflow-settings-workflow-label",
      "Workflow",
    ),
    workflowSettingsProviderLabel: localize(
      "workflow-settings-provider-label",
      "Provider",
    ),
    workflowSettingsProfileLabel: localize(
      "workflow-settings-profile-label",
      "Profile",
    ),
    workflowSettingsWorkflowParamsTitle: localize(
      "workflow-settings-persisted-workflow-params-title",
      "Workflow Parameters",
    ),
    workflowSettingsProviderOptionsTitle: localize(
      "workflow-settings-persisted-provider-options-title",
      "Provider Runtime Options",
    ),
    workflowSettingsNoWorkflowParams: localize(
      "workflow-settings-no-workflow-params",
      "This workflow has no configurable parameters.",
    ),
    workflowSettingsNoProviderOptions: localize(
      "workflow-settings-no-provider-options",
      "This provider has no configurable runtime options.",
    ),
    workflowSettingsBlockedNoProfile: localize(
      "workflow-settings-submit-blocked-no-profile",
      "No backend profile available. Please configure one first.",
    ),
    workflowSettingsNumberInvalid: localize(
      "workflow-settings-number-invalid",
      "Please enter a valid number.",
    ),
    workflowSettingsPositiveIntegerRequired: localize(
      "workflow-settings-positive-integer-required",
      "Please enter a positive integer.",
    ),
    workflowSettingsSaving: localize(
      "workflow-settings-dashboard-saving",
      "Saving...",
    ),
    workflowSettingsSaved: localize(
      "workflow-settings-dashboard-saved",
      "Saved",
    ),
    workflowSettingsSaveError: localize(
      "workflow-settings-dashboard-save-error",
      "Save failed",
    ),
  };

  const tabs = [
    {
      key: "home",
      label: labels.home,
    },
    {
      key: "workflow-options",
      label: labels.tabWorkflowOptions,
    },
    ...args.backends.map((backend) => ({
      key: toBackendTabKey(backend.id),
      label: `${resolveBackendDisplayName(backend.id, backend.displayName)} (${backend.type})`,
      backendId: backend.id,
      backendType: backend.type,
    })),
  ];

  const selectedBackendId = fromBackendTabKey(selectedTabKey);
  const selectedBackend = args.backends.find((entry) => entry.id === selectedBackendId);

  const snapshot: DashboardSnapshot = {
    generatedAt: new Date().toISOString(),
    title: localize("task-manager-title", "Task Dashboard"),
    labels,
    selectedTabKey,
    tabs,
    summary: {
      total: summary.total,
      running: args.active.length,
      succeeded: summary.succeeded,
      failed: summary.failed,
      canceled: summary.canceled,
    },
    runningRows,
    backendLoadError: args.state.backendLoadError,
  };

  if (selectedTabKey === "workflow-options") {
    snapshot.workflowOptionsView = await buildWorkflowOptionsView({
      state: args.state,
      backends: args.backends,
    });
    return snapshot;
  }

  if (!selectedBackend) {
    return snapshot;
  }

  const rows = mergeDashboardTaskRows({
    backendId: selectedBackend.id,
    history: args.history,
    active: args.active,
  }).map((entry) =>
    mapTaskRowWithMeta(entry, {
      backendMetaById,
    }),
  );

  const backendView: DashboardSnapshot["backendView"] = {
    backendId: selectedBackend.id,
    backendType: selectedBackend.type,
    backendBaseUrl: selectedBackend.baseUrl,
    title: isSkillRunnerBackend(selectedBackend)
      ? localize("task-dashboard-skillrunner-title", "SkillRunner Backend: {id}", {
          args: {
            id: resolveBackendDisplayName(
              selectedBackend.id,
              selectedBackend.displayName,
            ),
          },
        })
      : localize("task-dashboard-generic-title", "Generic HTTP Backend: {id}", {
          args: {
            id: resolveBackendDisplayName(
              selectedBackend.id,
              selectedBackend.displayName,
            ),
          },
        }),
    rows,
    emptyRowsText: labels.backendNoTasks,
    logRows: [],
  };

  if (isSkillRunnerBackend(selectedBackend)) {
    snapshot.backendView = backendView;
    return snapshot;
  }

  const selectedLogTaskId =
    args.state.selectedLogTaskByBackendId.get(selectedBackend.id) || rows[0]?.id || "";
  if (selectedLogTaskId) {
    args.state.selectedLogTaskByBackendId.set(selectedBackend.id, selectedLogTaskId);
  } else {
    args.state.selectedLogTaskByBackendId.delete(selectedBackend.id);
  }
  backendView.selectedLogTaskId = selectedLogTaskId || undefined;
  const selectedRow = rows.find((entry) => entry.id === selectedLogTaskId);
  if (selectedRow) {
    backendView.selectedLogTaskRequestId = selectedRow.requestId;
    backendView.selectedLogTaskJobId = selectedRow.jobId;
    const logs = listRuntimeLogs({
      ...toLogFilter(selectedRow),
      order: "desc",
      limit: 300,
    }).map((entry) => mapLogRow(entry));
    backendView.logRows = logs;
    const selectedLogEntryId =
      args.state.selectedLogEntryByBackendId.get(selectedBackend.id) || logs[0]?.id || "";
    if (selectedLogEntryId) {
      args.state.selectedLogEntryByBackendId.set(selectedBackend.id, selectedLogEntryId);
    } else {
      args.state.selectedLogEntryByBackendId.delete(selectedBackend.id);
    }
    backendView.selectedLogEntryId = selectedLogEntryId || undefined;
    backendView.selectedLogEntryPayload =
      logs.find((entry) => entry.id === selectedLogEntryId)?.detailPayload || undefined;
  } else {
    args.state.selectedLogEntryByBackendId.delete(selectedBackend.id);
    backendView.logRows = [];
    backendView.selectedLogEntryId = undefined;
    backendView.selectedLogEntryPayload = undefined;
  }
  snapshot.backendView = backendView;
  return snapshot;
}

function normalizeFilteredHistory() {
  return listTaskDashboardHistory().filter(
    (entry) => entry.backendType !== PASS_THROUGH_BACKEND_TYPE,
  );
}

function normalizeFilteredActive() {
  return listActiveWorkflowTasks().filter(
    (entry) => entry.backendType !== PASS_THROUGH_BACKEND_TYPE,
  );
}

export async function openTaskManagerDialog(args?: {
  initialTabKey?: string;
  initialWorkflowId?: string;
}) {
  if (isWindowAlive(taskManagerDialog?.window)) {
    if (externalSelectTab) {
      externalSelectTab({
        tabKey: args?.initialTabKey,
        workflowId: args?.initialWorkflowId,
      });
    }
    taskManagerDialog?.window?.focus();
    return;
  }

  const state: DashboardState = {
    backends: [],
    selectedTabKey: String(args?.initialTabKey || "home").trim() || "home",
    selectedLogTaskByBackendId: new Map(),
    selectedLogEntryByBackendId: new Map(),
    selectedWorkflowOptionsWorkflowId:
      String(args?.initialWorkflowId || "").trim(),
    workflowSettingsDraftById: new Map(),
    workflowSettingsSaveStateById: new Map(),
    workflowSettingsSaveErrorById: new Map(),
    workflowSettingsSaveTimerById: new Map(),
  };

  cleanupTaskDashboardHistory();

  let unsubscribeTasks: (() => void) | undefined;
  let refreshTimer: number | undefined;
  let frameWindow: Window | null = null;
  let removeMessageListener: (() => void) | undefined;

  const pushSnapshot = async (
    messageType: "dashboard:init" | "dashboard:snapshot",
  ) => {
    if (!frameWindow) {
      return;
    }
    cleanupTaskDashboardHistory();
    const history = normalizeFilteredHistory();
    const active = normalizeFilteredActive();
    const backends = normalizeDashboardBackends({
      configured: state.backends,
      history,
      active,
    });
    state.backends = backends;

    const snapshot = await buildDashboardSnapshot({
      state,
      backends,
      history,
      active,
    });

    frameWindow.postMessage(
      {
        type: messageType,
        payload: snapshot,
      },
      "*",
    );
  };

  let refreshChain: Promise<void> = Promise.resolve();
  type RefreshReason =
    | "init"
    | "user-action"
    | "periodic"
    | "task-update"
    | "backend-load"
    | "save-state";
  const shouldSkipRefresh = (reason: RefreshReason) => {
    if (state.selectedTabKey !== "workflow-options") {
      return false;
    }
    return reason === "periodic" || reason === "task-update";
  };
  const enqueueRefresh = (
    messageType: "dashboard:init" | "dashboard:snapshot",
  ) => {
    refreshChain = refreshChain
      .catch(() => undefined)
      .then(async () => {
        await pushSnapshot(messageType);
      });
    return refreshChain;
  };

  const refresh = (reason: RefreshReason = "user-action") => {
    if (shouldSkipRefresh(reason)) {
      return;
    }
    void enqueueRefresh("dashboard:snapshot");
  };

  const handleAction = async (envelope: DashboardActionEnvelope) => {
    const action = String(envelope.action || "").trim();
    const payload = envelope.payload || {};
    if (!action) {
      return;
    }
    if (action === "ready") {
      void enqueueRefresh("dashboard:init");
      return;
    }
    if (action === "select-tab") {
      state.selectedTabKey = String(payload.tabKey || "home").trim() || "home";
      refresh("user-action");
      return;
    }
    if (action === "select-workflow-settings-workflow") {
      state.selectedWorkflowOptionsWorkflowId = String(
        payload.workflowId || "",
      ).trim();
      refresh("user-action");
      return;
    }
    if (action === "workflow-settings-draft") {
      const workflowId = String(payload.workflowId || "").trim();
      const executionOptions =
        (payload.executionOptions as WorkflowExecutionOptions) || {};
      const changedSection = normalizeDraftChangedSection(payload.changedSection);
      const changedKey = normalizeDraftChangedKey(payload.changedKey);
      if (!workflowId) {
        return;
      }
      state.workflowSettingsDraftById.set(workflowId, {
        backendId:
          typeof executionOptions.backendId === "string"
            ? executionOptions.backendId
            : undefined,
        workflowParams: executionOptions.workflowParams || {},
        providerOptions: executionOptions.providerOptions || {},
      });
      clearWorkflowSettingsSaveTimer(state, workflowId);
      state.workflowSettingsSaveStateById.set(workflowId, "saving");
      state.workflowSettingsSaveErrorById.delete(workflowId);
      if (
        isWorkflowSettingsStructuralRefreshChange({
          changedSection,
          changedKey,
        })
      ) {
        refresh("user-action");
      }
      const timer = taskManagerDialog?.window?.setTimeout(() => {
        try {
          const draft = state.workflowSettingsDraftById.get(workflowId) || {};
          updateWorkflowSettings(workflowId, draft);
          state.workflowSettingsSaveStateById.set(workflowId, "saved");
          state.workflowSettingsSaveErrorById.delete(workflowId);
          const idleTimer = taskManagerDialog?.window?.setTimeout(() => {
            state.workflowSettingsSaveStateById.set(workflowId, "idle");
          }, 900);
          if (idleTimer) {
            state.workflowSettingsSaveTimerById.set(
              `${workflowId}:idle`,
              idleTimer,
            );
          }
        } catch (error) {
          state.workflowSettingsSaveStateById.set(workflowId, "error");
          state.workflowSettingsSaveErrorById.set(
            workflowId,
            compactError(error),
          );
        } finally {
          state.workflowSettingsSaveTimerById.delete(workflowId);
        }
      }, 420);
      if (timer) {
        state.workflowSettingsSaveTimerById.set(workflowId, timer);
      }
      return;
    }
    if (action === "open-running-task") {
      const taskId = String(payload.taskId || "").trim();
      const backendId = String(payload.backendId || "").trim();
      const requestId = String(payload.requestId || "").trim();
      const payloadBackendType = String(payload.backendType || "").trim();
      if (!taskId || !backendId) {
        return;
      }
      const backend = state.backends.find((entry) => entry.id === backendId);
      const backendType = String(backend?.type || payloadBackendType).trim();
      if (backendType === "skillrunner") {
        if (!requestId) {
          taskManagerDialog?.window?.alert?.(
            localize(
              "task-dashboard-open-run-missing-request-id",
              "This run does not have a request ID yet. Try again later.",
            ),
          );
          return;
        }
        if (!backend || !isSkillRunnerBackend(backend)) {
          return;
        }
        await openSkillRunnerRunDialog({
          backend,
          requestId,
        });
        return;
      }
      if (backendType === "generic-http") {
        if (!backend) {
          return;
        }
        state.selectedTabKey = toBackendTabKey(backendId);
        state.selectedLogTaskByBackendId.set(backendId, taskId);
        state.selectedLogEntryByBackendId.delete(backendId);
        refresh("user-action");
      }
      return;
    }
    if (action === "view-logs" || action === "select-log-task") {
      const backendId = String(payload.backendId || "").trim();
      const taskId = String(payload.taskId || "").trim();
      if (backendId && taskId) {
        state.selectedTabKey = toBackendTabKey(backendId);
        state.selectedLogTaskByBackendId.set(backendId, taskId);
        state.selectedLogEntryByBackendId.delete(backendId);
      }
      refresh("user-action");
      return;
    }
    if (action === "open-log-diagnostics") {
      const backendId = String(payload.backendId || "").trim();
      const taskId = String(payload.taskId || "").trim();
      const backend = state.backends.find((entry) => entry.id === backendId);
      if (!backend || !taskId) {
        return;
      }
      const active = normalizeFilteredActive();
      const history = normalizeFilteredHistory();
      const rows = mergeDashboardTaskRows({
        backendId: backend.id,
        history,
        active,
      }).map((entry) => mapTaskRow(entry));
      const selected = rows.find((row) => row.id === taskId);
      if (!selected) {
        await openLogViewerDialogWithArgs({
          initialFilters: {
            backendId: backend.id,
            backendType: backend.type,
          },
          focusDiagnostic: true,
        });
        return;
      }
      await openLogViewerDialogWithArgs({
        initialFilters: {
          backendId: backend.id,
          backendType: backend.type,
          workflowId: selected.workflowId,
          requestId: selected.requestId,
          jobId: selected.jobId,
          runId: selected.runId,
        },
        focusDiagnostic: true,
      });
      return;
    }
    if (action === "select-log-entry") {
      const backendId = String(payload.backendId || "").trim();
      const logEntryId = String(payload.logEntryId || "").trim();
      if (backendId && logEntryId) {
        state.selectedLogEntryByBackendId.set(backendId, logEntryId);
      }
      refresh("user-action");
      return;
    }
    if (action === "open-run") {
      const backendId = String(payload.backendId || "").trim();
      const requestId = String(payload.requestId || "").trim();
      if (backendId && requestId) {
        const backend = state.backends.find((entry) => entry.id === backendId);
        if (backend && isSkillRunnerBackend(backend)) {
          await openSkillRunnerRunDialog({
            backend,
            requestId,
          });
        }
      }
      return;
    }
    if (action === "open-management") {
      const backendId = String(payload.backendId || "").trim();
      const backend = state.backends.find((entry) => entry.id === backendId);
      if (!backend || !isSkillRunnerBackend(backend)) {
        return;
      }
      try {
        await openSkillRunnerManagementDialog({
          backendId: backend.id,
          baseUrl: backend.baseUrl,
        });
      } catch (error) {
        taskManagerDialog?.window?.alert?.(
          localize("task-dashboard-open-management-failed", "Failed to open management UI: {error}", {
            args: {
              error: compactError(error),
            },
          }),
        );
      }
      return;
    }
    if (action === "cancel-run") {
      const backendId = String(payload.backendId || "").trim();
      const requestId = String(payload.requestId || "").trim();
      const backend = state.backends.find((entry) => entry.id === backendId);
      if (!backend || !requestId || !isSkillRunnerBackend(backend)) {
        return;
      }
      const active = normalizeFilteredActive();
      const history = normalizeFilteredHistory();
      const rows = mergeDashboardTaskRows({
        backendId: backend.id,
        history,
        active,
      });
      const target = rows.find((row) => row.requestId === requestId);
      if (target && isTerminalWorkflowTaskState(target.state)) {
        refresh("user-action");
        return;
      }
      try {
        const client = buildSkillRunnerManagementClient({
          backend,
          alertWindow: taskManagerDialog?.window,
          localize,
        });
        await client.cancelRun({
          requestId,
        });
      } catch (error) {
        taskManagerDialog?.window?.alert?.(
          localize("task-dashboard-skillrunner-cancel-failed", "Failed to cancel run: {error}", {
            args: {
              error: compactError(error),
            },
          }),
        );
      }
      refresh("user-action");
      return;
    }
  };

  const dialogData: Record<string, unknown> = {
    loadCallback: () => {
      const doc = taskManagerDialog?.window?.document;
      const dialogWindow = taskManagerDialog?.window;
      if (!doc || !dialogWindow) {
        return;
      }
      try {
        dialogWindow.resizeTo(1480, 920);
      } catch {
        // ignore
      }
      const root = doc.getElementById("zs-task-manager-root") as
        | HTMLElement
        | null;
      if (!root) {
        return;
      }
      root.innerHTML = "";
      const frame = createDashboardFrame(doc, resolveDashboardPageUrl());
      root.appendChild(frame);
      frameWindow = resolveDashboardFrameWindow(frame);
      frame.addEventListener("load", () => {
        frameWindow = resolveDashboardFrameWindow(frame);
        if (!frameWindow) {
          taskManagerDialog?.window?.alert?.(
            localize(
              "task-dashboard-open-management-failed",
              "Dashboard host failed to resolve frame window.",
              {
                args: {
                  error: "frame_window_unavailable",
                },
              },
            ),
          );
          return;
        }
        void enqueueRefresh("dashboard:init");
      });
      const onMessage = (event: MessageEvent) => {
        const data = event.data as { type?: unknown };
        if (!data || data.type !== "dashboard:action") {
          return;
        }
        void handleAction(data as DashboardActionEnvelope);
      };
      dialogWindow.addEventListener("message", onMessage);
      removeMessageListener = () => {
        dialogWindow.removeEventListener("message", onMessage);
      };
      externalSelectTab = (next) => {
        if (typeof next.tabKey === "string" && next.tabKey.trim()) {
          state.selectedTabKey = next.tabKey.trim();
        }
        if (typeof next.workflowId === "string") {
          state.selectedWorkflowOptionsWorkflowId = next.workflowId.trim();
        }
        refresh("user-action");
      };

      void (async () => {
        try {
          const loaded = await loadBackendsRegistry();
          const history = normalizeFilteredHistory();
          const active = normalizeFilteredActive();
          state.backends = normalizeDashboardBackends({
            configured: loaded.backends,
            history,
            active,
          });
          state.backendLoadError = loaded.fatalError
            ? compactError(loaded.fatalError)
            : undefined;
          refresh("backend-load");
        } catch (error) {
          state.backendLoadError = compactError(error);
          refresh("backend-load");
        }
      })();

      refresh("init");
      unsubscribeTasks = subscribeWorkflowTasks(() => {
        refresh("task-update");
      });
      refreshTimer = dialogWindow.setInterval(() => {
        refresh("periodic");
      }, 1200);
    },
    unloadCallback: () => {
      if (unsubscribeTasks) {
        unsubscribeTasks();
        unsubscribeTasks = undefined;
      }
      if (refreshTimer) {
        taskManagerDialog?.window?.clearInterval(refreshTimer);
        refreshTimer = undefined;
      }
      if (removeMessageListener) {
        removeMessageListener();
        removeMessageListener = undefined;
      }
      for (const workflowId of Array.from(
        state.workflowSettingsSaveTimerById.keys(),
      )) {
        clearWorkflowSettingsSaveTimer(state, workflowId);
      }
      state.workflowSettingsSaveTimerById.clear();
      externalSelectTab = undefined;
      frameWindow = null;
    },
  };

  taskManagerDialog = new ztoolkit.Dialog(1, 1)
    .addCell(0, 0, {
      tag: "div",
      namespace: "html",
      id: "zs-task-manager-root",
      styles: {
        width: "100%",
        height: "100%",
        minWidth: "1100px",
        minHeight: "700px",
        padding: "0",
        margin: "0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      },
    })
    .addButton(localize("task-manager-close", "Close"), "close")
    .setDialogData(dialogData)
    .open(localize("task-manager-title", "Task Dashboard"));

  await (dialogData as { unloadLock?: { promise?: Promise<void> } }).unloadLock
    ?.promise;

  taskManagerDialog = undefined;
}
