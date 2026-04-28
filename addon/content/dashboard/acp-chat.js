(function () {
  const state = {
    snapshot: null,
    copyStatus: "",
    transcriptNodeMap: new Map(),
    transcriptOrderKey: "",
    transcriptMode: "",
    pickerSignature: "",
    backendPickerSignature: "",
    sessionPickerSignature: "",
    diagnosticsSignature: "",
    actionsMenuOpen: false,
    sessionDrawerOpen: false,
    sessionDrawerSignature: "",
    permissionDrawerOpen: false,
    toolActivityExpandedIds: new Set(),
    markdownParser: undefined,
  };
  const SIDEBAR_ACTION_BRIDGE_KEY = "__zsAcpSidebarBridge";

  const titleEl = document.getElementById("acp-title");
  const subtitleEl = document.getElementById("acp-subtitle");
  const interactionNoticesEl = document.getElementById("acp-interaction-notices");
  const statusBannerEl = document.getElementById("acp-status-banner");
  const runningIndicatorEl = document.getElementById("acp-running-indicator");
  const runningLabelEl = document.getElementById("acp-running-label");
  const statusSummaryEl = document.getElementById("acp-status-summary");
  const statusSummaryTextEl = document.getElementById("acp-status-summary-text");
  const mcpInjectionStatusEl = document.getElementById("acp-mcp-injection-status");
  const statusDetailsPanelEl = document.getElementById("acp-status-details-panel");
  const statusDetailsToggleBtnEl = document.getElementById(
    "acp-status-details-toggle-btn",
  );
  const chatModePlainBtnEl = document.getElementById("acp-chat-mode-plain");
  const chatModeBubbleBtnEl = document.getElementById("acp-chat-mode-bubble");
  const sessionManagerBtnEl = document.getElementById("acp-session-manager-btn");
  const moreBtnEl = document.getElementById("acp-more-btn");
  const actionsMenuEl = document.getElementById("acp-actions-menu");
  const sessionDrawerEl = document.getElementById("acp-session-drawer");
  const sessionDrawerTitleEl = document.getElementById("acp-session-drawer-title");
  const sessionDrawerSubtitleEl = document.getElementById(
    "acp-session-drawer-subtitle",
  );
  const sessionDrawerCloseBtnEl = document.getElementById(
    "acp-session-drawer-close-btn",
  );
  const sessionDrawerBusyEl = document.getElementById("acp-session-drawer-busy");
  const sessionDrawerListEl = document.getElementById("acp-session-drawer-list");
  const sessionDrawerEmptyEl = document.getElementById("acp-session-drawer-empty");
  const backendPickerLabelEl = document.getElementById("acp-backend-picker-label");
  const backendSelectEl = document.getElementById("acp-backend-select");
  const sessionPickerLabelEl = document.getElementById("acp-session-picker-label");
  const sessionSelectEl = document.getElementById("acp-session-select");
  const statusLabelEl = document.getElementById("acp-status-label");
  const statusPillEl = statusLabelEl.closest(".acp-status-pill");
  const targetLabelEl = document.getElementById("acp-target-label");
  const agentLabelEl = document.getElementById("acp-agent-label");
  const sessionLabelEl = document.getElementById("acp-session-label");
  const remoteSessionLabelEl = document.getElementById("acp-remote-session-label");
  const remoteSessionValueEl = document.getElementById("acp-remote-session-value");
  const remoteRestoreLabelEl = document.getElementById("acp-remote-restore-label");
  const remoteRestoreValueEl = document.getElementById("acp-remote-restore-value");
  const commandLabelEl = document.getElementById("acp-command-label");
  const transcriptEl = document.getElementById("acp-transcript");
  const planPanelEl = document.getElementById("acp-plan-panel");
  const planTitleEl = document.getElementById("acp-plan-title");
  const planSummaryEl = document.getElementById("acp-plan-summary");
  const planListEl = document.getElementById("acp-plan-list");
  const updatedAtEl = document.getElementById("acp-updated-at");
  const modeSelectEl = document.getElementById("acp-mode-select");
  const modelSelectEl = document.getElementById("acp-model-select");
  const reasoningSelectEl = document.getElementById("acp-reasoning-select");
  const modeLabelEl = document.getElementById("acp-mode-label");
  const modelLabelEl = document.getElementById("acp-model-label");
  const reasoningLabelEl = document.getElementById("acp-reasoning-label");
  const authenticateBtnEl = document.getElementById("acp-authenticate-btn");
  const diagnosticsToggleBtnEl = document.getElementById(
    "acp-diagnostics-toggle-btn",
  );
  const diagnosticsCopyBtnEl = document.getElementById("acp-diagnostics-copy-btn");
  const manageBackendsBtnEl = document.getElementById("acp-manage-backends-btn");
  const diagnosticsPanelEl = document.getElementById("acp-diagnostics-panel");
  const diagnosticsTitleEl = document.getElementById("acp-diagnostics-title");
  const diagnosticsListEl = document.getElementById("acp-diagnostics-list");
  const permissionBannerEl = document.getElementById("acp-permission-banner");
  const permissionTitleEl = document.getElementById("acp-permission-title");
  const permissionSummaryEl = document.getElementById("acp-permission-summary");
  const permissionDetailsBtnEl = document.getElementById(
    "acp-permission-details-btn",
  );
  const permissionActionsEl = document.getElementById("acp-permission-actions");
  const permissionDrawerEl = document.getElementById("acp-permission-drawer");
  const permissionDrawerTitleEl = document.getElementById(
    "acp-permission-drawer-title",
  );
  const permissionDrawerSubtitleEl = document.getElementById(
    "acp-permission-drawer-subtitle",
  );
  const permissionDrawerCloseBtnEl = document.getElementById(
    "acp-permission-drawer-close-btn",
  );
  const permissionFullCommandEl = document.getElementById(
    "acp-permission-full-command",
  );
  const permissionDrawerActionsEl = document.getElementById(
    "acp-permission-drawer-actions",
  );
  const workspaceLabelEl = document.getElementById("acp-workspace-label");
  const runtimeLabelEl = document.getElementById("acp-runtime-label");
  const hostContextLabelEl = document.getElementById("acp-host-context-label");
  const workspaceDirEl = document.getElementById("acp-workspace-dir");
  const runtimeDirEl = document.getElementById("acp-runtime-dir");
  const hostContextSummaryEl = document.getElementById("acp-host-context-summary");
  const stopReasonEl = document.getElementById("acp-stop-reason");
  const usageGaugeEl = document.getElementById("acp-usage-gauge");
  const usageGaugeValueEl = document.getElementById("acp-usage-gauge-value");
  const diagnosticsCopyStatusEl = document.getElementById(
    "acp-diagnostics-copy-status",
  );
  const formEl = document.getElementById("acp-composer-form");
  const inputEl = document.getElementById("acp-composer-input");
  const primaryActionBtnEl = document.getElementById("acp-primary-action-btn");
  const newConversationBtnEl = document.getElementById("acp-new-conversation-btn");
  const connectBtnEl = document.getElementById("acp-connect-btn");
  const disconnectBtnEl = document.getElementById("acp-disconnect-btn");
  const closeBtnEl = document.getElementById("acp-close-btn");

  function resolveSidebarActionBridge() {
    const wrappedWindow =
      window.wrappedJSObject && typeof window.wrappedJSObject === "object"
        ? window.wrappedJSObject
        : null;
    const bridge =
      (wrappedWindow && wrappedWindow[SIDEBAR_ACTION_BRIDGE_KEY]) ||
      window[SIDEBAR_ACTION_BRIDGE_KEY];
    if (!bridge || typeof bridge.sendAction !== "function") {
      return null;
    }
    return bridge;
  }

  function sendAction(action, payload) {
    const message = {
      type: "acp:action",
      action,
      payload: payload || {},
    };
    try {
      const sidebarBridge = resolveSidebarActionBridge();
      if (sidebarBridge) {
        sidebarBridge.sendAction(action, payload || {});
        return;
      }
    } catch {}
    const rawTargets = [window.parent, window.top, window.opener];
    const dedup = new Set();
    rawTargets.forEach(function (target) {
      if (!target || dedup.has(target)) {
        return;
      }
      dedup.add(target);
      try {
        target.postMessage(message, "*");
      } catch {
        // ignore cross-window messaging failures
      }
    });
  }

  function clearNode(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (typeof text === "string") {
      node.textContent = text;
    }
    return node;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ensureMarkdownParser() {
    if (state.markdownParser !== undefined) {
      return state.markdownParser;
    }
    if (!window.markdownit || typeof window.markdownit !== "function") {
      console.warn("markdown-it not loaded, falling back to plain text rendering");
      state.markdownParser = null;
      return null;
    }
    const mdParser = window.markdownit({
      html: false,
      xhtmlOut: false,
      breaks: true,
      langPrefix: "language-",
      linkify: false,
      typographer: false,
      quotes: "\"\"''",
      highlight: null,
    });
    if (window.texmath && window.katex) {
      mdParser.use(window.texmath, {
        engine: window.katex,
        delimiters: "dollars",
        katexOptions: {
          throwOnError: false,
          output: "htmlAndMathML",
          displayMode: false,
        },
      });
    }
    state.markdownParser = mdParser;
    return mdParser;
  }

  function renderMarkdown(textValue) {
    const markdownText = String(textValue || "");
    const mdParser = ensureMarkdownParser();
    if (!mdParser) {
      return escapeHtml(markdownText);
    }
    try {
      return mdParser.render(markdownText).trimEnd();
    } catch (error) {
      console.warn("Markdown render error, falling back to plain text:", error);
      return escapeHtml(markdownText);
    }
  }

  function formatTime(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return text;
    }
    return parsed.toLocaleString();
  }

  function permissionCommandText(request) {
    return String((request && request.toolTitle) || "Tool Call").trim() || "Tool Call";
  }

  function truncatePermissionCommand(text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    const limit = 220;
    if (normalized.length <= limit) {
      return normalized;
    }
    return normalized.slice(0, limit - 1).trimEnd() + "…";
  }

  function permissionOptionToneClass(option) {
    const text = [
      option && option.kind,
      option && option.name,
      option && option.optionId,
    ]
      .join(" ")
      .toLowerCase();
    if (
      text.indexOf("reject") >= 0 ||
      text.indexOf("deny") >= 0 ||
      text.indexOf("cancel") >= 0 ||
      text.indexOf("disallow") >= 0
    ) {
      return "btn-danger";
    }
    if (
      text.indexOf("allow") >= 0 ||
      text.indexOf("approve") >= 0 ||
      text.indexOf("accept") >= 0 ||
      text.indexOf("yes") >= 0
    ) {
      return "btn-primary";
    }
    return "";
  }

  function renderPermissionActions(container, request) {
    clearNode(container);
    const options = (request && Array.isArray(request.options) ? request.options : [])
      .map(function (entry) {
        return {
          optionId: String((entry && entry.optionId) || "").trim(),
          kind: String((entry && entry.kind) || "").trim(),
          name: String((entry && entry.name) || "").trim(),
          description: String((entry && entry.description) || "").trim(),
        };
      })
      .filter(function (entry) {
        return entry.optionId;
      });
    if (options.length === 0) {
      const empty = el("span", "acp-permission-empty-action", "No options");
      container.appendChild(empty);
      return;
    }
    options.forEach(function (option) {
      const toneClass = permissionOptionToneClass(option);
      const button = el("button", "btn" + (toneClass ? " " + toneClass : ""));
      button.type = "button";
      button.textContent = option.name || option.kind || option.optionId;
      if (option.description) {
        button.title = option.description;
      }
      button.addEventListener("click", function () {
        sendAction("resolve-permission", {
          outcome: "selected",
          optionId: option.optionId,
        });
      });
      container.appendChild(button);
    });
  }

  function isNearTranscriptBottom() {
    return (
      transcriptEl.scrollHeight -
        transcriptEl.scrollTop -
        transcriptEl.clientHeight <
      80
    );
  }

  function buildStatusSummary(snapshot) {
    const parts = [];
    const agent = [snapshot.agentLabel, snapshot.agentVersion].filter(Boolean).join(" ");
    const session = snapshot.sessionTitle || snapshot.sessionId || "";
    if (agent) {
      parts.push(agent);
    }
    if (session) {
      parts.push(session);
    }
    if (snapshot.lastLifecycleEvent) {
      parts.push(snapshot.lastLifecycleEvent);
    }
    if (snapshot.lastError) {
      parts.push(snapshot.lastError);
    }
    return parts.join(" • ") || "-";
  }

  function latestDiagnostic(snapshot, kinds) {
    const diagnostics = Array.isArray(snapshot.diagnostics)
      ? snapshot.diagnostics
      : [];
    const wanted = new Set(kinds);
    for (let index = diagnostics.length - 1; index >= 0; index -= 1) {
      const entry = diagnostics[index] || {};
      if (wanted.has(String(entry.kind || ""))) {
        return entry;
      }
    }
    return null;
  }

  function buildMcpServiceStatus(snapshot) {
    const mcpHealth = snapshot && snapshot.mcpHealth ? snapshot.mcpHealth : null;
    if (mcpHealth) {
      const healthState = String(mcpHealth.state || "");
      const severity = String(mcpHealth.severity || "neutral");
      const tone =
        healthState === "listening" ||
        healthState === "injected" ||
        healthState === "handshake_seen" ||
        healthState === "tools_seen" ||
        severity === "ok" ||
        severity === "active"
          ? "is-ready"
          : severity === "warning"
            ? "is-warning"
            : severity === "error"
              ? "is-error"
              : healthState === "starting"
                ? "is-running"
                : healthState === "unavailable"
                  ? "is-warning"
                  : "is-running";
      const tooltip = Array.isArray(mcpHealth.tooltip)
        ? mcpHealth.tooltip.join("\n")
        : String(mcpHealth.summary || "Zotero MCP service");
      return {
        tone,
        label: "MCP",
        tooltip: tooltip || "Zotero MCP service",
      };
    }
    const injected = latestDiagnostic(snapshot, ["mcp_server_injected"]);
    const unavailable = latestDiagnostic(snapshot, ["zotero_mcp_unavailable"]);
    const injectedAt = Date.parse(String((injected && injected.ts) || "")) || 0;
    const unavailableAt = Date.parse(String((unavailable && unavailable.ts) || "")) || 0;
    if (injected && injectedAt >= unavailableAt) {
      return {
        tone: "is-running",
        label: "MCP",
        tooltip: [
          "Zotero MCP service",
          "descriptor=injected",
          "status=server health snapshot pending",
          String(injected.message || ""),
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }
    return {
      tone: "is-running",
      label: "MCP",
      tooltip:
        "Zotero MCP service\nstatus=server health snapshot pending" +
        (unavailable ? "\n" + String(unavailable.message || "") : ""),
    };
  }

  function isSessionMutationBlocked(snapshot) {
    return (
      snapshot.busy === true ||
      snapshot.status === "prompting" ||
      snapshot.status === "permission-required"
    );
  }

  function normalizeStatusToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  }

  function isTerminalPlanStatus(status) {
    return [
      "complete",
      "completed",
      "done",
      "succeeded",
      "success",
      "skipped",
      "cancelled",
      "canceled",
      "failed",
      "error",
    ].indexOf(normalizeStatusToken(status)) >= 0;
  }

  function statusToneClass(status) {
    switch (normalizeStatusToken(status)) {
      case "connected":
      case "prompting":
      case "permission_required":
      case "auth_required":
        return "is-connected";
      case "checking_command":
      case "spawning":
      case "initializing":
        return "is-connecting";
      case "error":
        return "is-error";
      case "idle":
      default:
        return "is-idle";
    }
  }

  function planStatusToneClass(status) {
    switch (normalizeStatusToken(status)) {
      case "complete":
      case "completed":
      case "done":
      case "succeeded":
      case "success":
        return "is-completed";
      case "in_progress":
      case "running":
        return "is-running";
      case "failed":
      case "error":
        return "is-failed";
      case "cancelled":
      case "canceled":
        return "is-cancelled";
      case "skipped":
        return "is-skipped";
      case "pending":
      case "todo":
      default:
        return "is-pending";
    }
  }

  function planStatusIcon(status) {
    switch (planStatusToneClass(status)) {
      case "is-completed":
        return "✓";
      case "is-running":
        return "";
      case "is-failed":
        return "×";
      case "is-cancelled":
        return "−";
      case "is-skipped":
        return "↷";
      case "is-pending":
      default:
        return "";
    }
  }

  function isPlanPanelLive(snapshot) {
    return (
      snapshot &&
      (snapshot.busy === true ||
        snapshot.status === "prompting" ||
        snapshot.status === "permission-required")
    );
  }

  function toolStatusToneClass(status) {
    switch (normalizeStatusToken(status)) {
      case "completed":
        return "is-completed";
      case "failed":
        return "is-failed";
      case "in_progress":
      case "running":
        return "is-running";
      case "pending":
      default:
        return "is-pending";
    }
  }

  function isGenericToolText(value) {
    const text = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, " ");
    const raw = String(value || "").trim();
    return (
      !text ||
      text === "tool" ||
      text === "tool call" ||
      text === "other" ||
      text === "[]" ||
      text === "{}" ||
      /^call_[a-z0-9_-]+$/i.test(raw) ||
      /^toolu_[a-z0-9_-]+$/i.test(raw)
    );
  }

  function compactToolName(tool) {
    const candidates = [
      tool && tool.toolName,
      tool && tool.toolKind,
      tool && tool.title,
    ];
    for (let index = 0; index < candidates.length; index += 1) {
      const value = String(candidates[index] || "").trim();
      if (!isGenericToolText(value)) {
        return value;
      }
    }
    return "Tool";
  }

  function compactToolSummary(tool) {
    const candidates = [
      tool && tool.inputSummary,
      tool && tool.title,
      tool && tool.summary,
    ];
    for (let index = 0; index < candidates.length; index += 1) {
      const value = String(candidates[index] || "").replace(/\s+/g, " ").trim();
      if (!isGenericToolText(value)) {
        return value;
      }
    }
    return "";
  }

  function compactToolType(tool) {
    return compactToolName(tool);
  }

  function appendToolDisplay(parent, tool) {
    const toolType = compactToolType(tool);
    parent.appendChild(el("span", "acp-tool-kind-badge", toolType));
    const summary = compactToolSummary(tool);
    if (summary) {
      parent.appendChild(el("span", "acp-tool-summary-text", summary));
    }
  }

  function toolActivitySummaryState(items) {
    const tools = Array.isArray(items) ? items : [];
    const states = tools.map(function (tool) {
      return normalizeStatusToken(tool && tool.state);
    });
    const completedCount = states.filter(function (state) {
      return state === "completed";
    }).length;
    const failedCount = states.filter(function (state) {
      return state === "failed";
    }).length;
    if (tools.length > 0 && completedCount === tools.length) {
      return "completed";
    }
    if (tools.length > 0 && failedCount === tools.length) {
      return "failed";
    }
    if (completedCount > 0 && failedCount > 0) {
      return "in_progress";
    }
    if (failedCount > 0) {
      return "failed";
    }
    if (states.indexOf("in_progress") >= 0 || states.indexOf("running") >= 0) {
      return "in_progress";
    }
    if (states.indexOf("pending") >= 0) {
      return "pending";
    }
    return "completed";
  }

  function findActivePlan(items) {
    const plans = (Array.isArray(items) ? items : []).filter(function (item) {
      return item && item.kind === "plan" && Array.isArray(item.entries);
    });
    for (let index = plans.length - 1; index >= 0; index -= 1) {
      const plan = plans[index];
      const entries = Array.isArray(plan.entries) ? plan.entries : [];
      if (
        entries.length > 0 &&
        entries.some(function (entry) {
          return !isTerminalPlanStatus(entry.status);
        })
      ) {
        return plan;
      }
    }
    return null;
  }

  function renderPlanPanel(snapshot) {
    const labels = snapshot.labels || {};
    const activePlan = isPlanPanelLive(snapshot)
      ? findActivePlan(snapshot.items)
      : null;
    if (!activePlan) {
      planPanelEl.className = "acp-plan-panel hidden";
      planTitleEl.textContent = labels.plan || "Plan";
      planSummaryEl.textContent = "";
      clearNode(planListEl);
      return;
    }
    const entries = Array.isArray(activePlan.entries) ? activePlan.entries : [];
    const terminalCount = entries.filter(function (entry) {
      return isTerminalPlanStatus(entry.status);
    }).length;
    planPanelEl.className = "acp-plan-panel";
    planTitleEl.textContent = labels.plan || "Plan";
    planSummaryEl.textContent =
      String(terminalCount) + "/" + String(entries.length) + " complete";
    clearNode(planListEl);
    entries.forEach(function (entry) {
      const terminal = isTerminalPlanStatus(entry.status);
      const statusTone = planStatusToneClass(entry.status);
      const statusNode = el("span", "acp-plan-entry-status " + statusTone);
      const statusIcon = el(
        "span",
        "acp-plan-status-icon " + statusTone,
        planStatusIcon(entry.status),
      );
      statusIcon.setAttribute("aria-hidden", "true");
      statusNode.appendChild(statusIcon);
      const row = el(
        "div",
        "acp-plan-entry " +
          statusTone +
          (terminal ? " is-terminal" : " is-active"),
      );
      row.appendChild(statusNode);
      row.appendChild(
        el("span", "acp-plan-entry-content", String(entry.content || "")),
      );
      planListEl.appendChild(row);
    });
  }

  function buildStatusNoticeParts(snapshot) {
    const labels = snapshot.labels || {};
    const parts = [];
    if (snapshot.lastError) {
      parts.push((labels.errorPrefix || "Error") + ": " + snapshot.lastError);
    }
    if (snapshot.lastStopReason) {
      parts.push((labels.stopReason || "Stop reason") + ": " + snapshot.lastStopReason);
    }
    if (snapshot.remoteSessionRestoreStatus === "fallback-new") {
      parts.push(
        snapshot.remoteSessionRestoreMessage ||
          "Remote session could not be restored; continued with a new agent session.",
      );
    }
    return parts;
  }

  function renderBanner(snapshot) {
    const parts = buildStatusNoticeParts(snapshot);
    if (parts.length === 0) {
      statusBannerEl.textContent = "";
      statusBannerEl.className = "acp-status-banner hidden";
      return false;
    }
    statusBannerEl.textContent = parts.join(" • ");
    statusBannerEl.className =
      "acp-status-banner" + (snapshot.status === "error" ? " is-error" : " is-warning");
    return true;
  }

  function isPromptRunning(snapshot) {
    const status = String(snapshot.status || "");
    return (
      snapshot.busy === true ||
      status === "prompting" ||
      status === "checking-command" ||
      status === "spawning" ||
      status === "initializing"
    );
  }

  function renderRunningIndicator(snapshot) {
    const labels = snapshot.labels || {};
    runningLabelEl.textContent =
      labels.running || labels.working || "Working...";
    runningIndicatorEl.className =
      "acp-running-indicator" + (isPromptRunning(snapshot) ? "" : " hidden");
  }

  function renderUsageGauge(snapshot) {
    const labels = snapshot.labels || {};
    const usage = snapshot.usage || {};
    const used = Number(usage.used);
    const size = Number(usage.size);
    if (!Number.isFinite(used) || !Number.isFinite(size) || size <= 0) {
      usageGaugeEl.className = "acp-usage-gauge is-unavailable";
      usageGaugeEl.title = (labels.usage || "Usage") + ": unavailable";
      usageGaugeEl.setAttribute("aria-label", usageGaugeEl.title);
      usageGaugeEl.style.setProperty("--acp-usage-percent", "0");
      usageGaugeValueEl.textContent = "-";
      return;
    }
    const percent = Math.max(0, Math.min(100, Math.round((used / size) * 100)));
    usageGaugeEl.className = "acp-usage-gauge";
    usageGaugeEl.style.setProperty("--acp-usage-percent", String(percent));
    usageGaugeEl.title =
      (labels.usage || "Usage") + ": " + String(used) + "/" + String(size);
    usageGaugeEl.setAttribute("aria-label", usageGaugeEl.title);
    usageGaugeValueEl.textContent = String(percent) + "%";
  }

  function renderActionsMenu(snapshot) {
    const labels = snapshot.labels || {};
    moreBtnEl.textContent = labels.more || "More";
    moreBtnEl.setAttribute(
      "aria-expanded",
      state.actionsMenuOpen ? "true" : "false",
    );
    actionsMenuEl.className =
      "acp-actions-menu" + (state.actionsMenuOpen ? "" : " hidden");
  }

  function renderSessionDrawer(snapshot) {
    const labels = snapshot.labels || {};
    const backendGroups =
      Array.isArray(snapshot.backendChatSessions) &&
      snapshot.backendChatSessions.length > 0
        ? snapshot.backendChatSessions
        : [
            {
              backendId: String(snapshot.activeBackendId || snapshot.backendId || ""),
              displayName: snapshot.backendLabel || "",
              sessions: Array.isArray(snapshot.chatSessions)
                ? snapshot.chatSessions
                : [],
            },
          ];
    const activeConversationId = String(
      snapshot.activeConversationId || snapshot.conversationId || "",
    ).trim();
    const activeBackendId = String(snapshot.activeBackendId || snapshot.backendId || "").trim();
    const blocked = isSessionMutationBlocked(snapshot);
    sessionManagerBtnEl.textContent =
      labels.sessionManager || labels.conversation || "Sessions";
    sessionManagerBtnEl.setAttribute(
      "aria-expanded",
      state.sessionDrawerOpen ? "true" : "false",
    );
    sessionDrawerEl.className =
      "acp-session-drawer" + (state.sessionDrawerOpen ? "" : " hidden");
    sessionDrawerTitleEl.textContent =
      labels.sessionManager || labels.conversation || "Sessions";
    sessionDrawerSubtitleEl.textContent =
      String(backendGroups.length) + " backend" + (backendGroups.length === 1 ? "" : "s");
    sessionDrawerCloseBtnEl.textContent = labels.close || "Close";
    sessionDrawerBusyEl.textContent =
      labels.sessionBusy ||
      "Session changes are disabled while a prompt or permission request is active.";
    sessionDrawerBusyEl.className =
      "acp-session-drawer-note" + (blocked ? "" : " hidden");
    sessionDrawerEmptyEl.textContent =
      labels.sessionEmpty || labels.empty || "No conversations yet.";
    const signature = JSON.stringify({
      open: state.sessionDrawerOpen,
      activeConversationId,
      activeBackendId,
      blocked,
      backendGroups: backendGroups.map(function (group) {
        return {
          backendId: String(group.backendId || ""),
          displayName: String(group.displayName || ""),
          sessions: (group.sessions || []).map(function (entry) {
            return [
              String(entry.conversationId || ""),
              String(entry.title || ""),
              String(entry.updatedAt || ""),
              String(entry.status || ""),
              String(entry.lastError || ""),
              Number(entry.messageCount || 0),
            ];
          }),
        };
      }),
    });
    if (signature === state.sessionDrawerSignature) {
      return;
    }
    state.sessionDrawerSignature = signature;
    clearNode(sessionDrawerListEl);
    const totalSessions = backendGroups.reduce(function (sum, group) {
      return sum + (Array.isArray(group.sessions) ? group.sessions.length : 0);
    }, 0);
    sessionDrawerEmptyEl.className =
      "acp-empty-state" + (totalSessions === 0 ? "" : " hidden");
    backendGroups.forEach(function (group) {
      const backendId = String(group.backendId || "").trim();
      const sessions = Array.isArray(group.sessions) ? group.sessions : [];
      if (sessions.length === 0) {
        return;
      }
      const groupNode = el(
        "section",
        "acp-session-backend-group" +
          (backendId === activeBackendId ? " is-active-backend" : ""),
      );
      groupNode.appendChild(
        el(
          "div",
          "acp-session-backend-title",
          String(group.displayName || backendId || "ACP"),
        ),
      );
      sessions.forEach(function (entry) {
      const conversationId = String(entry.conversationId || "").trim();
      const isActive =
        conversationId === activeConversationId && backendId === activeBackendId;
      const row = el(
        "article",
        "acp-session-row" + (isActive ? " is-active" : ""),
      );
      const main = el("button", "acp-session-row-main");
      main.type = "button";
      main.disabled = blocked || isActive;
      main.addEventListener("click", function () {
        if (!conversationId) {
          return;
        }
        state.sessionDrawerOpen = false;
        sendAction("set-active-conversation", {
          backendId: backendId,
          conversationId: conversationId,
        });
      });
      main.appendChild(
        el("span", "acp-session-row-title", String(entry.title || "New Conversation")),
      );
      main.appendChild(
        el(
          "span",
          "acp-session-row-meta",
          [
            formatTime(entry.updatedAt),
            String(Number(entry.messageCount || 0)) + " messages",
            String(entry.lastError || entry.status || "").trim(),
          ]
            .filter(Boolean)
            .join(" • "),
        ),
      );
      const actions = el("div", "acp-session-row-actions");
      const renameBtn = el(
        "button",
        "btn btn-compact",
        labels.renameConversation || "Rename",
      );
      renameBtn.type = "button";
      renameBtn.disabled = blocked;
      renameBtn.addEventListener("click", function () {
        const title = window.prompt(
          labels.renameConversation || "Rename Conversation",
          String(entry.title || "New Conversation"),
        );
        if (!title || !String(title).trim()) {
          return;
        }
        sendAction("rename-conversation", {
          backendId: backendId,
          conversationId: conversationId,
          title: String(title).trim(),
        });
      });
      const archiveBtn = el(
        "button",
        "btn btn-compact",
        labels.archiveConversation || "Archive",
      );
      archiveBtn.type = "button";
      archiveBtn.disabled = blocked;
      archiveBtn.addEventListener("click", function () {
        if (
          !window.confirm(
            labels.archiveConversationConfirm ||
              "Archive this conversation? It will be hidden from the list.",
          )
        ) {
          return;
        }
        sendAction("archive-conversation", {
          backendId: backendId,
          conversationId: conversationId,
        });
      });
      actions.appendChild(renameBtn);
      actions.appendChild(archiveBtn);
      row.appendChild(main);
      row.appendChild(actions);
        groupNode.appendChild(row);
      });
      sessionDrawerListEl.appendChild(groupNode);
    });
  }

  function renderChatMode(snapshot) {
    const labels = snapshot.labels || {};
    const mode = snapshot.chatDisplayMode === "bubble" ? "bubble" : "plain";
    chatModePlainBtnEl.textContent = labels.plain || "Plain";
    chatModeBubbleBtnEl.textContent = labels.bubble || "Bubble";
    chatModePlainBtnEl.setAttribute("aria-pressed", mode === "plain" ? "true" : "false");
    chatModeBubbleBtnEl.setAttribute(
      "aria-pressed",
      mode === "bubble" ? "true" : "false",
    );
    transcriptEl.classList.toggle("plain-mode", mode === "plain");
    transcriptEl.classList.toggle("bubble-mode", mode === "bubble");
  }

  function renderStatusDetails(snapshot) {
    const labels = snapshot.labels || {};
    const expanded = snapshot.statusExpanded === true;
    statusDetailsPanelEl.className =
      "acp-overlay-panel acp-status-details-panel" +
      (expanded ? "" : " hidden");
    statusDetailsToggleBtnEl.textContent = expanded
      ? labels.detailsHide || "Hide Details"
      : labels.detailsShow || "Show Details";
    statusDetailsToggleBtnEl.setAttribute(
      "aria-expanded",
      expanded ? "true" : "false",
    );
    statusSummaryTextEl.textContent = buildStatusSummary(snapshot);
    if (mcpInjectionStatusEl) {
      const mcpStatus = buildMcpServiceStatus(snapshot);
      mcpInjectionStatusEl.className =
        "acp-mcp-status-monitor " + mcpStatus.tone;
      mcpInjectionStatusEl.textContent = mcpStatus.label;
      mcpInjectionStatusEl.title = mcpStatus.tooltip;
      mcpInjectionStatusEl.setAttribute("aria-label", mcpStatus.tooltip);
    }
  }

  function optionsSignature(options, current) {
    return JSON.stringify({
      options: (options || []).map(function (entry) {
        return [entry.id, entry.label];
      }),
      current: current && current.id ? current.id : "",
    });
  }

  function renderSelect(selectEl, options, current) {
    clearNode(selectEl);
    if (options.length === 0) {
      const empty = el("option", "", "-");
      empty.value = "";
      selectEl.appendChild(empty);
      selectEl.disabled = true;
      return;
    }
    options.forEach(function (entry) {
      const option = el("option", "", entry.label || entry.id);
      option.value = entry.id;
      option.title = entry.label || entry.id;
      if (current && current.id === entry.id) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
    selectEl.disabled = false;
  }

  function renderPickers(snapshot) {
    const labels = snapshot.labels || {};
    modeLabelEl.textContent = labels.mode || "Mode";
    modelLabelEl.textContent = labels.model || "Model";
    reasoningLabelEl.textContent = labels.reasoning || "Reasoning";

    const modeOptions = Array.isArray(snapshot.modeOptions) ? snapshot.modeOptions : [];
    const modelOptions = Array.isArray(snapshot.displayModelOptions)
      ? snapshot.displayModelOptions
      : Array.isArray(snapshot.modelOptions)
        ? snapshot.modelOptions
        : [];
    const reasoningOptions = Array.isArray(snapshot.reasoningEffortOptions)
      ? snapshot.reasoningEffortOptions
      : [];
    const effectiveReasoningOptions =
      reasoningOptions.length > 0
        ? reasoningOptions
        : [{ id: "default", label: "Default" }];
    const effectiveReasoning =
      snapshot.currentReasoningEffort || effectiveReasoningOptions[0];
    const signature =
      optionsSignature(modeOptions, snapshot.currentMode) +
      "|" +
      optionsSignature(modelOptions, snapshot.currentDisplayModel || snapshot.currentModel) +
      "|" +
      optionsSignature(effectiveReasoningOptions, effectiveReasoning);
    if (signature !== state.pickerSignature) {
      renderSelect(modeSelectEl, modeOptions, snapshot.currentMode);
      renderSelect(
        modelSelectEl,
        modelOptions,
        snapshot.currentDisplayModel || snapshot.currentModel,
      );
      renderSelect(reasoningSelectEl, effectiveReasoningOptions, effectiveReasoning);
      reasoningSelectEl.disabled = reasoningOptions.length <= 1;
      state.pickerSignature = signature;
    }
    modeSelectEl.closest(".acp-picker").classList.remove("hidden");
    modelSelectEl.closest(".acp-picker").classList.remove("hidden");
    reasoningSelectEl.closest(".acp-picker").classList.remove("hidden");
  }

  function renderBackendPicker(snapshot) {
    const labels = snapshot.labels || {};
    const options = Array.isArray(snapshot.backendOptions)
      ? snapshot.backendOptions
      : [];
    backendPickerLabelEl.textContent = labels.backend || "Backend";
    const activeBackendId = String(snapshot.activeBackendId || "").trim();
    const signature = JSON.stringify({
      activeBackendId,
      options: options.map(function (entry) {
        return [
          String(entry.backendId || ""),
          String(entry.displayName || ""),
          String(entry.status || ""),
        ];
      }),
    });
    if (signature !== state.backendPickerSignature) {
      clearNode(backendSelectEl);
      if (options.length === 0) {
        const empty = el("option", "", "-");
        empty.value = "";
        backendSelectEl.appendChild(empty);
        backendSelectEl.disabled = true;
      } else {
        options.forEach(function (entry) {
          const status = String(entry.status || "idle");
          const label = String(entry.displayName || entry.backendId || "-");
          const option = el("option", "", label + " · " + status);
          option.value = String(entry.backendId || "");
          if (option.value === activeBackendId) {
            option.selected = true;
          }
          backendSelectEl.appendChild(option);
        });
        backendSelectEl.disabled = false;
      }
      state.backendPickerSignature = signature;
    }
  }

  function renderSessionPicker(snapshot) {
    const labels = snapshot.labels || {};
    const options = Array.isArray(snapshot.chatSessions)
      ? snapshot.chatSessions
      : [];
    sessionPickerLabelEl.textContent = labels.conversation || "Conversation";
    const activeConversationId = String(
      snapshot.activeConversationId || snapshot.conversationId || "",
    ).trim();
    const signature = JSON.stringify({
      activeConversationId,
      busy: snapshot.busy === true,
      status: String(snapshot.status || ""),
      options: options.map(function (entry) {
        return [
          String(entry.conversationId || ""),
          String(entry.title || ""),
          String(entry.updatedAt || ""),
          Number(entry.messageCount || 0),
        ];
      }),
    });
    if (signature !== state.sessionPickerSignature) {
      clearNode(sessionSelectEl);
      if (options.length === 0) {
        const empty = el("option", "", "-");
        empty.value = "";
        sessionSelectEl.appendChild(empty);
      } else {
        options.forEach(function (entry) {
          const title = String(entry.title || "New Conversation");
          const count = Number(entry.messageCount || 0);
          const option = el(
            "option",
            "",
            count > 0 ? title + " (" + String(count) + ")" : title,
          );
          option.value = String(entry.conversationId || "");
          if (option.value === activeConversationId) {
            option.selected = true;
          }
          sessionSelectEl.appendChild(option);
        });
      }
      state.sessionPickerSignature = signature;
    }
    sessionSelectEl.disabled =
      options.length <= 1 ||
      snapshot.status === "prompting" ||
      snapshot.status === "permission-required";
  }

  function renderPermission(snapshot) {
    const labels = snapshot.labels || {};
    const request = snapshot.pendingPermissionRequest;
    if (!request) {
      state.permissionDrawerOpen = false;
      permissionBannerEl.className = "acp-permission-banner hidden";
      permissionSummaryEl.textContent = "";
      permissionDrawerEl.className = "acp-permission-drawer hidden";
      permissionFullCommandEl.textContent = "";
      clearNode(permissionActionsEl);
      clearNode(permissionDrawerActionsEl);
      return false;
    }
    const title = labels.permission || "Permission request";
    const commandText = permissionCommandText(request);
    permissionTitleEl.textContent = title;
    permissionSummaryEl.textContent = truncatePermissionCommand(commandText);
    permissionSummaryEl.title = commandText;
    permissionDetailsBtnEl.textContent =
      labels.permissionDetails || "View full command";
    renderPermissionActions(permissionActionsEl, request);
    permissionBannerEl.className = "acp-permission-banner";
    permissionDrawerTitleEl.textContent = title;
    permissionDrawerSubtitleEl.textContent =
      labels.permissionDrawerSubtitle || "Review the full command before choosing.";
    permissionFullCommandEl.textContent = commandText;
    renderPermissionActions(permissionDrawerActionsEl, request);
    permissionDrawerEl.className =
      "acp-permission-drawer" + (state.permissionDrawerOpen ? "" : " hidden");
    return true;
  }

  function renderInteractionZone(snapshot) {
    const hasPermission = renderPermission(snapshot);
    const hasNotice = renderBanner(snapshot);
    renderRunningIndicator(snapshot);

    if (hasPermission) {
      interactionNoticesEl.className = "acp-interaction-notices";
      permissionBannerEl.className = "acp-permission-banner";
      statusBannerEl.className = "acp-status-banner hidden";
      runningIndicatorEl.className = "acp-running-indicator hidden";
      return;
    }
    if (hasNotice) {
      interactionNoticesEl.className = "acp-interaction-notices";
      permissionBannerEl.className = "acp-permission-banner hidden";
      runningIndicatorEl.className = "acp-running-indicator hidden";
      return;
    }
    if (isPromptRunning(snapshot)) {
      interactionNoticesEl.className = "acp-interaction-notices";
      permissionBannerEl.className = "acp-permission-banner hidden";
      statusBannerEl.className = "acp-status-banner hidden";
      runningIndicatorEl.className = "acp-running-indicator";
      return;
    }
    interactionNoticesEl.className = "acp-interaction-notices hidden";
    permissionBannerEl.className = "acp-permission-banner hidden";
    statusBannerEl.className = "acp-status-banner hidden";
    runningIndicatorEl.className = "acp-running-indicator hidden";
  }

  function buildDiagnosticsRows(snapshot) {
    const labels = snapshot.labels || {};
    const summaryEntries = [
      snapshot.commandLine
        ? {
            kind: "command_line",
            message: labels.commandLine || "Command line",
            detail: snapshot.commandLine,
          }
        : null,
      snapshot.sessionCwd
        ? {
            kind: "session_cwd",
            message: workspaceLabelEl.textContent || "Session cwd",
            detail: snapshot.sessionCwd,
          }
        : null,
      snapshot.runtimeDir
        ? {
            kind: "runtime_dir",
            message: runtimeLabelEl.textContent || "Runtime dir",
            detail: snapshot.runtimeDir,
          }
        : null,
      snapshot.lastLifecycleEvent
        ? {
            kind: "last_event",
            message: labels.lastLifecycleEvent || "Last lifecycle event",
            detail: snapshot.lastLifecycleEvent,
          }
        : null,
      snapshot.stderrTail
        ? {
            kind: "stderr_tail",
            message: labels.stderrTail || "stderr",
            detail: snapshot.stderrTail,
          }
        : null,
    ].filter(Boolean);
    return summaryEntries.concat(
      Array.isArray(snapshot.diagnostics) ? snapshot.diagnostics : [],
    );
  }

  function renderDiagnosticsRows(snapshot) {
    const labels = snapshot.labels || {};
    const rows = buildDiagnosticsRows(snapshot);
    clearNode(diagnosticsListEl);
    if (rows.length === 0) {
      diagnosticsListEl.appendChild(
        el("div", "acp-empty-state", labels.diagnosticsEmpty || "No diagnostics yet."),
      );
      return;
    }
    rows.forEach(function (entry) {
      const row = el("article", "acp-diagnostics-row");
      row.appendChild(el("div", "acp-diagnostics-kind", String(entry.kind || "")));
      row.appendChild(el("div", "acp-diagnostics-message", String(entry.message || "")));
      row.appendChild(el("div", "acp-diagnostics-time", formatTime(entry.ts)));
      if (entry.detail) {
        row.appendChild(el("pre", "acp-diagnostics-detail", String(entry.detail || "")));
      }
      diagnosticsListEl.appendChild(row);
    });
  }

  function renderDiagnostics(snapshot) {
    const labels = snapshot.labels || {};
    diagnosticsTitleEl.textContent = labels.diagnostics || "Diagnostics";
    diagnosticsToggleBtnEl.textContent = snapshot.showDiagnostics
      ? labels.diagnosticsHide || "Hide Diagnostics"
      : labels.diagnosticsShow || "Show Diagnostics";
    diagnosticsCopyBtnEl.textContent = labels.diagnosticsCopy || "Copy Diagnostics";
    diagnosticsCopyStatusEl.textContent = state.copyStatus || "";
    diagnosticsPanelEl.className =
      "acp-overlay-panel acp-diagnostics-panel" +
      (snapshot.showDiagnostics ? "" : " hidden");
    stopReasonEl.textContent = snapshot.lastStopReason
      ? (labels.stopReason || "Stop reason") + ": " + snapshot.lastStopReason
      : "";
    if (!snapshot.showDiagnostics) {
      return;
    }
    const signature = JSON.stringify({
      copyStatus: state.copyStatus,
      commandLine: snapshot.commandLine,
      sessionCwd: snapshot.sessionCwd,
      runtimeDir: snapshot.runtimeDir,
      lastLifecycleEvent: snapshot.lastLifecycleEvent,
      stderrTail: snapshot.stderrTail,
      diagnostics: (snapshot.diagnostics || []).map(function (entry) {
        return [entry.id, entry.ts, entry.kind, entry.message, entry.detail];
      }),
    });
    if (signature === state.diagnosticsSignature) {
      return;
    }
    state.diagnosticsSignature = signature;
    renderDiagnosticsRows(snapshot);
  }

  function updateMessageClasses(row, item) {
    const role =
      item.kind === "message"
        ? String(item.role || "assistant")
        : item.kind === "tool_call" || item.kind === "tool_activity_group"
          ? "tool"
          : String(item.kind || "assistant");
    row.className = "acp-message acp-role-" + role;
    if (item.kind === "tool_call" || item.kind === "tool_activity_group") {
      row.classList.add("acp-tool-line");
    }
    if (item.kind === "tool_activity_group") {
      row.classList.add("acp-tool-activity-group");
      row.classList.toggle("is-expanded", item.expanded === true);
      row.classList.toggle("is-collapsed", item.expanded !== true);
    }
    if (String(item.state || "").trim() === "streaming") {
      row.classList.add("is-streaming");
    }
    if (String(item.state || "").trim() === "error") {
      row.classList.add("is-error");
    }
  }

  function createTranscriptNode(item) {
    const roleClass =
      item.kind === "message"
        ? "acp-role-" + String(item.role || "assistant")
        : item.kind === "tool_call" || item.kind === "tool_activity_group"
          ? "acp-role-tool"
          : "acp-role-" + String(item.kind || "status");
    const row = el("article", "acp-message " + roleClass);
    row.setAttribute("data-acp-item-id", String(item.id || ""));
    const meta = el("div", "acp-message-meta");
    const body = el("div", "acp-message-body");
    body.setAttribute("data-acp-body", "true");
    row.appendChild(meta);
    row.appendChild(body);
    return row;
  }

  function toolGroupSummaryText(items) {
    const tools = Array.isArray(items) ? items : [];
    const failedCount = tools.filter(function (tool) {
      return String(tool.state || "").trim() === "failed";
    }).length;
    const runningCount = tools.filter(function (tool) {
      const status = String(tool.state || "").trim();
      return status === "in_progress" || status === "running";
    }).length;
    const pendingCount = tools.filter(function (tool) {
      return String(tool.state || "").trim() === "pending";
    }).length;
    return [
      String(tools.length) + " tools",
      failedCount ? String(failedCount) + " failed" : "",
      runningCount ? String(runningCount) + " running" : "",
      pendingCount ? String(pendingCount) + " pending" : "",
    ]
      .filter(Boolean)
      .join(" • ");
  }

  function renderTranscriptItem(row, item) {
    const meta = row.querySelector(".acp-message-meta");
    const body = row.querySelector("[data-acp-body]");
    updateMessageClasses(row, item);
    while (row.children.length > 2) {
      row.removeChild(row.lastChild);
    }
    row.onclick =
      item.kind === "tool_activity_group"
        ? function () {
            if (state.toolActivityExpandedIds.has(item.id)) {
              state.toolActivityExpandedIds.delete(item.id);
            } else {
              state.toolActivityExpandedIds.add(item.id);
            }
            renderTranscript(state.snapshot || {});
          }
        : null;
    body.className = "acp-message-body";
    clearNode(meta);
    clearNode(body);
    if (item.kind === "message") {
      meta.appendChild(el("span", "acp-message-role", String(item.role || "assistant")));
      meta.appendChild(el("span", "acp-message-time", formatTime(item.createdAt)));
      body.classList.add("acp-markdown-body");
      body.innerHTML = renderMarkdown(String(item.text || ""));
      return;
    }
    if (item.kind === "thought") {
      meta.textContent = "Thought";
      body.classList.add("acp-markdown-body");
      body.innerHTML = renderMarkdown(String(item.text || ""));
      return;
    }
    if (item.kind === "tool_call") {
      meta.textContent = "Tool";
      const statusTone = toolStatusToneClass(item.state);
      const led = el("span", "acp-tool-led " + statusTone);
      led.setAttribute("aria-hidden", "true");
      body.appendChild(led);
      appendToolDisplay(body, item);
      return;
    }
    if (item.kind === "tool_activity_group") {
      const latest = item.items[item.items.length - 1] || {};
      const summaryState = toolActivitySummaryState(item.items);
      const failedCount = item.items.filter(function (tool) {
        return String(tool.state || "").trim() === "failed";
      }).length;
      const runningCount = item.items.filter(function (tool) {
        const status = String(tool.state || "").trim();
        return status === "in_progress" || status === "running";
      }).length;
      const pendingCount = item.items.filter(function (tool) {
        return String(tool.state || "").trim() === "pending";
      }).length;
      meta.appendChild(
        el(
          "span",
          "acp-message-role",
          "Tool activity" + " (" + String(item.items.length) + ")",
        ),
      );
      const summary = el("div", "acp-tool-activity-summary");
      const summaryLed = el("span", "acp-tool-led " + toolStatusToneClass(summaryState));
      summaryLed.setAttribute("aria-hidden", "true");
      summary.appendChild(summaryLed);
      summary.appendChild(
        el(
          "span",
          "acp-tool-summary-text",
          [
            String(item.items.length) + " tools",
            failedCount ? String(failedCount) + " failed" : "",
            runningCount ? String(runningCount) + " running" : "",
            pendingCount ? String(pendingCount) + " pending" : "",
          ]
            .filter(Boolean)
            .join(" • "),
        ),
      );
      body.appendChild(summary);
      if (item.expanded === true) {
        const list = el("div", "acp-tool-activity-list");
        item.items.forEach(function (tool) {
          const entry = el(
            "div",
            "acp-tool-activity-item " + toolStatusToneClass(tool.state),
          );
          const led = el("span", "acp-tool-led " + toolStatusToneClass(tool.state));
          led.setAttribute("aria-hidden", "true");
          entry.appendChild(led);
          appendToolDisplay(entry, tool);
          list.appendChild(entry);
        });
        row.appendChild(list);
      }
      return;
    }
    meta.textContent = String(item.label || "Status");
    body.textContent = String(item.text || "");
  }

  function renderEmptyTranscript(snapshot) {
    clearNode(transcriptEl);
    state.transcriptNodeMap.clear();
    state.transcriptOrderKey = "";
    transcriptEl.appendChild(
      el("div", "acp-empty-state", snapshot.labels?.empty || "No messages yet."),
    );
  }

  function sanitizeToolGroupKey(key) {
    const text = String(key || "unknown");
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    const slug = text.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 48) || "unknown";
    return slug + "-" + hash.toString(36);
  }

  function toolStateRank(state) {
    switch (String(state || "").trim()) {
      case "failed":
        return 4;
      case "completed":
        return 3;
      case "in_progress":
        return 2;
      case "pending":
      default:
        return 1;
    }
  }

  function toolEventTime(item) {
    const parsed = Date.parse(String(item.updatedAt || item.createdAt || ""));
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function isPreferredToolEvent(candidate, current) {
    const candidateRank = toolStateRank(candidate.state);
    const currentRank = toolStateRank(current.state);
    if (candidateRank !== currentRank) {
      return candidateRank > currentRank;
    }
    return toolEventTime(candidate) >= toolEventTime(current);
  }

  function createCanonicalToolItem(key, group) {
    const items = group.items || [];
    const first = items[0] || {};
    const selected = items.reduce(function (current, candidate) {
      return isPreferredToolEvent(candidate, current) ? candidate : current;
    }, first);
    const latestSummary =
      items.slice().reverse().find(function (tool) {
        return String(tool.summary || "").trim();
      }) || {};
    const firstInputSummary =
      items.find(function (tool) {
        return !isGenericToolText(tool.inputSummary);
      }) || {};
    const latestResultSummary =
      items.slice().reverse().find(function (tool) {
        return !isGenericToolText(tool.resultSummary);
      }) || {};
    const latestToolName =
      items.slice().reverse().find(function (tool) {
        return !isGenericToolText(tool.toolName);
      }) || {};
    return {
      id: "acp-tool-" + sanitizeToolGroupKey(key),
      kind: "tool_call",
      toolCallId: String(selected.toolCallId || first.toolCallId || key || ""),
      title: String(selected.title || first.title || "Tool"),
      toolKind: String(selected.toolKind || first.toolKind || "").trim() || undefined,
      toolName:
        String(latestToolName.toolName || selected.toolName || first.toolName || "")
          .trim() || undefined,
      inputSummary:
        String(firstInputSummary.inputSummary || selected.inputSummary || "").trim() ||
        undefined,
      resultSummary:
        String(
          latestResultSummary.resultSummary || selected.resultSummary || "",
        ).trim() || undefined,
      state: selected.state || first.state || "pending",
      summary: String(selected.summary || latestSummary.summary || "").trim() || undefined,
      createdAt: first.createdAt,
      updatedAt: selected.updatedAt || selected.createdAt || first.updatedAt,
    };
  }

  function buildCanonicalTranscriptItems(items) {
    const entries = [];
    const toolGroups = new Map();
    (Array.isArray(items) ? items : []).forEach(function (item) {
      if (!item || item.kind === "plan") {
        return;
      }
      if (item.kind !== "tool_call") {
        entries.push({
          index: entries.length,
          item: item,
        });
        return;
      }
      const key = String(item.toolCallId || item.id || "").trim();
      const groupKey = key || String(item.id || entries.length);
      let group = toolGroups.get(groupKey);
      if (!group) {
        group = {
          index: entries.length,
          items: [],
        };
        toolGroups.set(groupKey, group);
        entries.push({
          index: group.index,
          toolGroupKey: groupKey,
        });
      }
      group.items.push(item);
    });
    return entries
      .map(function (entry) {
        if (entry.toolGroupKey) {
          const group = toolGroups.get(entry.toolGroupKey) || { items: [] };
          return createCanonicalToolItem(entry.toolGroupKey, group);
        }
        return entry.item;
      })
      .filter(Boolean);
  }

  function createToolActivityGroup(run) {
    const first = run[0] || {};
    const last = run[run.length - 1] || first;
    const id =
      "acp-tool-activity-" +
      sanitizeToolGroupKey(
        [String(first.id || ""), String(last.id || ""), String(run.length)].join("-"),
      );
    return {
      id,
      kind: "tool_activity_group",
      items: run,
      createdAt: first.createdAt,
      updatedAt: last.updatedAt || last.createdAt,
      state: last.state,
      expanded: state.toolActivityExpandedIds.has(id),
    };
  }

  function flushToolActivityRun(entries, run) {
    if (run.length === 0) {
      return;
    }
    if (run.length === 1) {
      entries.push(run[0]);
      return;
    }
    entries.push(createToolActivityGroup(run));
  }

  function buildTranscriptRenderItems(items, mode) {
    const canonicalItems = buildCanonicalTranscriptItems(items);
    if (mode !== "bubble") {
      return canonicalItems;
    }
    const entries = [];
    let toolRun = [];
    canonicalItems.forEach(function (item) {
      if (item.kind === "tool_call") {
        toolRun.push(item);
        return;
      }
      flushToolActivityRun(entries, toolRun);
      toolRun = [];
      entries.push(item);
    });
    flushToolActivityRun(entries, toolRun);
    return entries;
  }

  function renderTranscript(snapshot) {
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    const mode = snapshot.chatDisplayMode === "bubble" ? "bubble" : "plain";
    const renderItems = buildTranscriptRenderItems(items, mode);
    transcriptEl.classList.toggle("plain-mode", mode === "plain");
    transcriptEl.classList.toggle("bubble-mode", mode === "bubble");
    if (renderItems.length === 0) {
      renderEmptyTranscript(snapshot);
      state.transcriptMode = mode;
      return;
    }
    const shouldStickToBottom = isNearTranscriptBottom();
    const orderKey = renderItems.map(function (item) {
      return String(item.kind || "") + ":" + String(item.id || "");
    }).join("|");
    const needsFullOrderRender =
      state.transcriptOrderKey !== orderKey || state.transcriptMode !== mode;
    if (needsFullOrderRender) {
      clearNode(transcriptEl);
      state.transcriptNodeMap.clear();
      renderItems.forEach(function (item) {
        const row = createTranscriptNode(item);
        state.transcriptNodeMap.set(String(item.id || ""), row);
        renderTranscriptItem(row, item);
        transcriptEl.appendChild(row);
      });
      state.transcriptOrderKey = orderKey;
      state.transcriptMode = mode;
    } else {
      renderItems.forEach(function (item) {
        const id = String(item.id || "");
        let row = state.transcriptNodeMap.get(id);
        if (!row) {
          row = createTranscriptNode(item);
          state.transcriptNodeMap.set(id, row);
          transcriptEl.appendChild(row);
        }
        renderTranscriptItem(row, item);
      });
    }
    if (shouldStickToBottom) {
      transcriptEl.scrollTop = transcriptEl.scrollHeight;
    }
  }

  function render(snapshot) {
    state.snapshot = snapshot;
    const labels = snapshot.labels || {};
    titleEl.textContent = snapshot.title || "ACP Chat";
    subtitleEl.textContent = labels.subtitle || "";
    renderBackendPicker(snapshot);
    renderSessionPicker(snapshot);
    statusLabelEl.textContent = snapshot.statusLabel || "-";
    if (statusPillEl) {
      statusPillEl.className =
        "acp-status-pill " + statusToneClass(snapshot.status || "idle");
    }
    targetLabelEl.textContent =
      snapshot.target === "reader"
        ? labels.targetReader || "Reader"
        : labels.targetLibrary || "Library";
    agentLabelEl.textContent =
      [snapshot.agentLabel, snapshot.agentVersion].filter(Boolean).join(" ") || "-";
    sessionLabelEl.textContent = snapshot.sessionTitle || snapshot.sessionId || "-";
    remoteSessionLabelEl.textContent = labels.remoteSession || "Remote session";
    remoteSessionValueEl.textContent =
      snapshot.remoteSessionId || snapshot.sessionId || "-";
    remoteRestoreLabelEl.textContent = labels.remoteRestore || "Remote restore";
    remoteRestoreValueEl.textContent =
      snapshot.remoteSessionRestoreStatus &&
      snapshot.remoteSessionRestoreStatus !== "none"
        ? snapshot.remoteSessionRestoreStatus +
          (snapshot.remoteSessionRestoreMessage
            ? " · " + snapshot.remoteSessionRestoreMessage
            : "")
        : "-";
    commandLabelEl.textContent = snapshot.commandLabel || snapshot.commandLine || "-";
    workspaceLabelEl.textContent = labels.workspace || "Workspace";
    runtimeLabelEl.textContent = labels.runtime || "Runtime";
    hostContextLabelEl.textContent = labels.hostContext || "Host context";
    workspaceDirEl.textContent = snapshot.sessionCwd || snapshot.workspaceDir || "-";
    runtimeDirEl.textContent = snapshot.runtimeDir || "-";
    hostContextSummaryEl.textContent = snapshot.hostContextSummary || "-";
    updatedAtEl.textContent = formatTime(snapshot.updatedAt);
    inputEl.placeholder =
      labels.composerPlaceholder ||
      "Ask the active ACP backend about the current library or item...";
    primaryActionBtnEl.textContent =
      snapshot.busy === true ? labels.cancel || "Cancel" : labels.send || "Send";
    primaryActionBtnEl.className =
      snapshot.busy === true ? "btn btn-danger" : "btn btn-primary";
    newConversationBtnEl.textContent = labels.newConversation || "New Conversation";
    connectBtnEl.textContent = labels.connect || "Connect";
    disconnectBtnEl.textContent = labels.disconnect || "Disconnect";
    closeBtnEl.textContent = labels.close || "Close";
    authenticateBtnEl.textContent = labels.authenticate || "Authenticate";
    manageBackendsBtnEl.textContent = labels.manageBackends || "Manage Backends";
    const isConnecting =
      snapshot.status === "checking-command" ||
      snapshot.status === "spawning" ||
      snapshot.status === "initializing";
    const isBusy = snapshot.busy === true;
    const isConnected =
      Boolean(String(snapshot.sessionId || "").trim()) ||
      snapshot.status === "connected" ||
      snapshot.status === "prompting" ||
      snapshot.status === "permission-required" ||
      snapshot.status === "auth-required";
    inputEl.disabled = isConnecting;
    primaryActionBtnEl.disabled = isConnecting;
    connectBtnEl.disabled = isConnecting || isConnected || isBusy;
    disconnectBtnEl.disabled = isConnecting || (!isConnected && snapshot.status === "idle");
    newConversationBtnEl.disabled = isBusy;
    authenticateBtnEl.disabled =
      !Array.isArray(snapshot.authMethods) || snapshot.authMethods.length === 0;
    statusSummaryEl.setAttribute("data-status", String(snapshot.status || "idle"));
    renderUsageGauge(snapshot);
    renderInteractionZone(snapshot);
    renderActionsMenu(snapshot);
    renderSessionDrawer(snapshot);
    renderChatMode(snapshot);
    renderStatusDetails(snapshot);
    renderPickers(snapshot);
    renderDiagnostics(snapshot);
    renderPlanPanel(snapshot);
    renderTranscript(snapshot);
  }

  formEl.addEventListener("submit", function (event) {
    event.preventDefault();
    const snapshot = state.snapshot || {};
    if (snapshot.busy === true) {
      sendAction("cancel", {});
      return;
    }
    const message = String(inputEl.value || "").trim();
    if (!message) {
      return;
    }
    sendAction("send-prompt", { message: message });
    inputEl.value = "";
  });

  inputEl.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      formEl.requestSubmit();
    }
  });

  modeSelectEl.addEventListener("change", function () {
    const modeId = String(modeSelectEl.value || "").trim();
    if (!modeId) {
      return;
    }
    sendAction("set-mode", { modeId: modeId });
  });

  modelSelectEl.addEventListener("change", function () {
    const modelId = String(modelSelectEl.value || "").trim();
    if (!modelId) {
      return;
    }
    sendAction("set-model", { modelId: modelId });
  });

  reasoningSelectEl.addEventListener("change", function () {
    const effortId = String(reasoningSelectEl.value || "").trim();
    if (!effortId) {
      return;
    }
    sendAction("set-reasoning-effort", { effortId: effortId });
  });

  backendSelectEl.addEventListener("change", function () {
    const backendId = String(backendSelectEl.value || "").trim();
    if (!backendId) {
      return;
    }
    sendAction("set-active-backend", { backendId: backendId });
  });

  sessionSelectEl.addEventListener("change", function () {
    const conversationId = String(sessionSelectEl.value || "").trim();
    if (!conversationId) {
      return;
    }
    sendAction("set-active-conversation", { conversationId: conversationId });
  });

  moreBtnEl.addEventListener("click", function (event) {
    event.stopPropagation();
    state.actionsMenuOpen = !state.actionsMenuOpen;
    renderActionsMenu(state.snapshot || {});
  });

  sessionManagerBtnEl.addEventListener("click", function (event) {
    event.stopPropagation();
    state.sessionDrawerOpen = !state.sessionDrawerOpen;
    state.sessionDrawerSignature = "";
    renderSessionDrawer(state.snapshot || {});
  });

  sessionDrawerCloseBtnEl.addEventListener("click", function () {
    state.sessionDrawerOpen = false;
    state.sessionDrawerSignature = "";
    renderSessionDrawer(state.snapshot || {});
  });

  sessionDrawerEl.addEventListener("click", function (event) {
    if (
      event.target &&
      event.target.closest &&
      event.target.closest("[data-acp-session-drawer-close]")
    ) {
      state.sessionDrawerOpen = false;
      state.sessionDrawerSignature = "";
      renderSessionDrawer(state.snapshot || {});
    }
  });

  actionsMenuEl.addEventListener("click", function (event) {
    if (event.target && event.target.closest && event.target.closest("button")) {
      state.actionsMenuOpen = false;
      renderActionsMenu(state.snapshot || {});
    }
  });

  document.addEventListener("click", function (event) {
    if (
      !state.actionsMenuOpen ||
      (event.target &&
        event.target.closest &&
        event.target.closest(".acp-actions-menu-wrap"))
    ) {
      return;
    }
    state.actionsMenuOpen = false;
    renderActionsMenu(state.snapshot || {});
  });

  chatModePlainBtnEl.addEventListener("click", function () {
    sendAction("set-chat-display-mode", { mode: "plain" });
  });

  chatModeBubbleBtnEl.addEventListener("click", function () {
    sendAction("set-chat-display-mode", { mode: "bubble" });
  });

  statusDetailsToggleBtnEl.addEventListener("click", function () {
    const snapshot = state.snapshot || {};
    sendAction("toggle-status-details", {
      expanded: !(snapshot.statusExpanded === true),
    });
  });

  authenticateBtnEl.addEventListener("click", function () {
    const snapshot = state.snapshot || {};
    const authMethods = Array.isArray(snapshot.authMethods) ? snapshot.authMethods : [];
    const methodId = authMethods[0] && authMethods[0].id ? authMethods[0].id : "";
    sendAction("authenticate", { methodId: methodId });
  });

  diagnosticsToggleBtnEl.addEventListener("click", function () {
    const snapshot = state.snapshot || {};
    sendAction("toggle-diagnostics", {
      visible: !(snapshot.showDiagnostics === true),
    });
  });

  diagnosticsCopyBtnEl.addEventListener("click", function () {
    const snapshot = state.snapshot || {};
    const labels = snapshot.labels || {};
    state.copyStatus = labels.diagnosticsCopyRequested || "Diagnostics copied.";
    state.diagnosticsSignature = "";
    sendAction("copy-diagnostics", {});
    renderDiagnostics(snapshot);
  });

  manageBackendsBtnEl.addEventListener("click", function () {
    sendAction("open-backend-manager", {});
  });

  permissionSummaryEl.addEventListener("click", function () {
    state.permissionDrawerOpen = true;
    renderPermission(state.snapshot || {});
  });

  permissionDetailsBtnEl.addEventListener("click", function () {
    state.permissionDrawerOpen = true;
    renderPermission(state.snapshot || {});
  });

  permissionDrawerCloseBtnEl.addEventListener("click", function () {
    state.permissionDrawerOpen = false;
    renderPermission(state.snapshot || {});
  });

  permissionDrawerEl.addEventListener("click", function (event) {
    if (
      event.target &&
      event.target.closest &&
      event.target.closest("[data-acp-permission-drawer-close]")
    ) {
      state.permissionDrawerOpen = false;
      renderPermission(state.snapshot || {});
    }
  });

  newConversationBtnEl.addEventListener("click", function () {
    sendAction("new-conversation", {});
  });

  connectBtnEl.addEventListener("click", function () {
    sendAction("connect", {});
  });

  disconnectBtnEl.addEventListener("click", function () {
    sendAction("disconnect", {});
  });

  closeBtnEl.addEventListener("click", function () {
    sendAction("close-sidebar", {});
  });

  window.addEventListener("message", function (event) {
    const data = event.data;
    if (!data || (data.type !== "acp:init" && data.type !== "acp:snapshot")) {
      return;
    }
    const payload = data.payload && typeof data.payload === "object" ? data.payload : null;
    if (!payload) {
      return;
    }
    render(payload);
  });

  sendAction("ready", {});
})();
