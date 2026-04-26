(function () {
  const state = {
    snapshot: null,
    allowOptionId: "",
    denyOptionId: "",
    copyStatus: "",
    transcriptNodeMap: new Map(),
    transcriptOrderKey: "",
    transcriptMode: "",
    pickerSignature: "",
    backendPickerSignature: "",
    diagnosticsSignature: "",
    actionsMenuOpen: false,
    toolGroupExpandedIds: new Set(),
  };
  const SIDEBAR_ACTION_BRIDGE_KEY = "__zsAcpSidebarBridge";

  const titleEl = document.getElementById("acp-title");
  const subtitleEl = document.getElementById("acp-subtitle");
  const statusBannerEl = document.getElementById("acp-status-banner");
  const statusSummaryEl = document.getElementById("acp-status-summary");
  const statusSummaryTextEl = document.getElementById("acp-status-summary-text");
  const statusDetailsPanelEl = document.getElementById("acp-status-details-panel");
  const statusDetailsToggleBtnEl = document.getElementById(
    "acp-status-details-toggle-btn",
  );
  const chatModePlainBtnEl = document.getElementById("acp-chat-mode-plain");
  const chatModeBubbleBtnEl = document.getElementById("acp-chat-mode-bubble");
  const moreBtnEl = document.getElementById("acp-more-btn");
  const actionsMenuEl = document.getElementById("acp-actions-menu");
  const backendLabelEl = document.getElementById("acp-backend-label");
  const backendPickerLabelEl = document.getElementById("acp-backend-picker-label");
  const backendSelectEl = document.getElementById("acp-backend-select");
  const statusLabelEl = document.getElementById("acp-status-label");
  const targetLabelEl = document.getElementById("acp-target-label");
  const agentLabelEl = document.getElementById("acp-agent-label");
  const sessionLabelEl = document.getElementById("acp-session-label");
  const commandLabelEl = document.getElementById("acp-command-label");
  const transcriptEl = document.getElementById("acp-transcript");
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
  const allowBtnEl = document.getElementById("acp-allow-btn");
  const denyBtnEl = document.getElementById("acp-deny-btn");
  const workspaceLabelEl = document.getElementById("acp-workspace-label");
  const runtimeLabelEl = document.getElementById("acp-runtime-label");
  const hostContextLabelEl = document.getElementById("acp-host-context-label");
  const workspaceDirEl = document.getElementById("acp-workspace-dir");
  const runtimeDirEl = document.getElementById("acp-runtime-dir");
  const hostContextSummaryEl = document.getElementById("acp-host-context-summary");
  const stopReasonEl = document.getElementById("acp-stop-reason");
  const usageSummaryEl = document.getElementById("acp-usage-summary");
  const diagnosticsCopyStatusEl = document.getElementById(
    "acp-diagnostics-copy-status",
  );
  const formEl = document.getElementById("acp-composer-form");
  const inputEl = document.getElementById("acp-composer-input");
  const sendBtnEl = document.getElementById("acp-send-btn");
  const newConversationBtnEl = document.getElementById("acp-new-conversation-btn");
  const reconnectBtnEl = document.getElementById("acp-reconnect-btn");
  const cancelBtnEl = document.getElementById("acp-cancel-btn");
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

  function findPermissionOption(options, kinds) {
    const matched = (options || []).find(function (entry) {
      return kinds.indexOf(String(entry.kind || "")) >= 0;
    });
    return matched ? String(matched.optionId || "").trim() : "";
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

  function renderBanner(snapshot) {
    const labels = snapshot.labels || {};
    const parts = [];
    if (snapshot.lastError) {
      parts.push((labels.errorPrefix || "Error") + ": " + snapshot.lastError);
    }
    if (snapshot.lastStopReason) {
      parts.push((labels.stopReason || "Stop reason") + ": " + snapshot.lastStopReason);
    }
    if (snapshot.usage && typeof snapshot.usage.used === "number") {
      parts.push(
        (labels.usage || "Usage") +
          ": " +
          String(snapshot.usage.used) +
          "/" +
          String(snapshot.usage.size),
      );
    }
    if (parts.length === 0) {
      statusBannerEl.textContent = "";
      statusBannerEl.className = "acp-status-banner hidden";
      return;
    }
    statusBannerEl.textContent = parts.join(" • ");
    statusBannerEl.className =
      "acp-status-banner" + (snapshot.status === "error" ? " is-error" : " is-warning");
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
    const signature =
      optionsSignature(modeOptions, snapshot.currentMode) +
      "|" +
      optionsSignature(modelOptions, snapshot.currentDisplayModel || snapshot.currentModel) +
      "|" +
      optionsSignature(reasoningOptions, snapshot.currentReasoningEffort);
    if (signature !== state.pickerSignature) {
      renderSelect(modeSelectEl, modeOptions, snapshot.currentMode);
      renderSelect(
        modelSelectEl,
        modelOptions,
        snapshot.currentDisplayModel || snapshot.currentModel,
      );
      renderSelect(reasoningSelectEl, reasoningOptions, snapshot.currentReasoningEffort);
      state.pickerSignature = signature;
    }
    modeSelectEl.closest(".acp-picker").classList.toggle("hidden", modeOptions.length === 0);
    modelSelectEl
      .closest(".acp-picker")
      .classList.toggle("hidden", modelOptions.length === 0);
    reasoningSelectEl
      .closest(".acp-picker")
      .classList.toggle("hidden", reasoningOptions.length <= 1);
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
        backendSelectEl.disabled = options.length <= 1;
      }
      state.backendPickerSignature = signature;
    }
  }

  function renderPermission(snapshot) {
    const labels = snapshot.labels || {};
    const request = snapshot.pendingPermissionRequest;
    if (!request) {
      state.allowOptionId = "";
      state.denyOptionId = "";
      permissionBannerEl.className = "acp-permission-banner hidden";
      permissionSummaryEl.textContent = "";
      return;
    }
    state.allowOptionId = findPermissionOption(request.options, [
      "allow_once",
      "allow_always",
    ]);
    state.denyOptionId = findPermissionOption(request.options, [
      "reject_once",
      "reject_always",
    ]);
    permissionTitleEl.textContent = labels.permission || "Permission request";
    permissionSummaryEl.textContent =
      String(request.toolTitle || "Tool Call") +
      " • " +
      (request.options || [])
        .map(function (entry) {
          return entry.name;
        })
        .join(", ");
    allowBtnEl.textContent = labels.allow || "Allow";
    denyBtnEl.textContent = labels.deny || "Deny";
    allowBtnEl.disabled = !state.allowOptionId;
    denyBtnEl.disabled = !state.denyOptionId;
    permissionBannerEl.className = "acp-permission-banner";
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
    usageSummaryEl.textContent =
      snapshot.usage && typeof snapshot.usage.used === "number"
        ? (labels.usage || "Usage") +
          ": " +
          String(snapshot.usage.used) +
          "/" +
          String(snapshot.usage.size)
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
        : item.kind === "tool_call" || item.kind === "tool_group"
          ? "tool"
          : String(item.kind || "assistant");
    row.className = "acp-message acp-role-" + role;
    if (item.kind === "tool_call") {
      row.classList.add("acp-tool-line");
    }
    if (item.kind === "tool_group") {
      row.classList.add("acp-tool-group");
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
        : item.kind === "tool_call" || item.kind === "tool_group"
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

  function renderTranscriptItem(row, item) {
    const meta = row.querySelector(".acp-message-meta");
    const body = row.querySelector("[data-acp-body]");
    updateMessageClasses(row, item);
    row.onclick =
      item.kind === "tool_group"
        ? function () {
            if (state.toolGroupExpandedIds.has(item.id)) {
              state.toolGroupExpandedIds.delete(item.id);
            } else {
              state.toolGroupExpandedIds.add(item.id);
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
      body.textContent = String(item.text || "");
      return;
    }
    if (item.kind === "thought") {
      meta.textContent = "Thought";
      body.textContent = String(item.text || "");
      return;
    }
    if (item.kind === "tool_call") {
      meta.textContent = "Tool";
      body.textContent = [
        String(item.title || "Tool"),
        String(item.state || "").trim(),
        String(item.toolKind || "").trim(),
      ]
        .filter(Boolean)
        .join(" • ");
      return;
    }
    if (item.kind === "tool_group") {
      const latest = item.items[item.items.length - 1] || {};
      meta.appendChild(
        el(
          "span",
          "acp-message-role",
          "Tool activity" + " (" + String(item.items.length) + ")",
        ),
      );
      meta.appendChild(el("span", "acp-message-time", String(latest.state || "")));
      body.appendChild(
        el(
          "div",
          "acp-tool-group-summary",
          [
            String(latest.title || "Tool"),
            String(latest.state || "").trim(),
            item.expanded ? "expanded" : "collapsed",
          ]
            .filter(Boolean)
            .join(" • "),
        ),
      );
      const list = el("div", "acp-tool-group-list");
      item.items.forEach(function (tool) {
        const entry = el("div", "acp-tool-group-item");
        entry.appendChild(el("span", "", String(tool.title || "Tool")));
        entry.appendChild(
          el(
            "span",
            "",
            [String(tool.state || "").trim(), String(tool.toolKind || "").trim()]
              .filter(Boolean)
              .join(" • "),
          ),
        );
        list.appendChild(entry);
      });
      body.appendChild(list);
      return;
    }
    if (item.kind === "plan") {
      meta.textContent = "Plan";
      body.className = "acp-plan-list";
      (item.entries || []).forEach(function (entry) {
        body.appendChild(
          el(
            "div",
            "acp-plan-entry",
            String(entry.status || "") + " • " + String(entry.content || ""),
          ),
        );
      });
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

  function flushToolGroup(entries, group) {
    if (!group || group.length === 0) {
      return;
    }
    if (group.length === 1) {
      entries.push(group[0]);
      return;
    }
    const first = group[0];
    const last = group[group.length - 1];
    const id =
      "acp-tool-group-" +
      String(first.id || "") +
      "-" +
      String(last.id || "") +
      "-" +
      String(group.length);
    entries.push({
      id,
      kind: "tool_group",
      items: group,
      createdAt: first.createdAt,
      updatedAt: last.updatedAt || last.createdAt,
      state: last.state,
      expanded: state.toolGroupExpandedIds.has(id),
    });
  }

  function buildTranscriptRenderItems(items, mode) {
    if (mode !== "bubble") {
      return items;
    }
    const entries = [];
    let toolGroup = [];
    items.forEach(function (item) {
      if (item.kind === "tool_call") {
        toolGroup.push(item);
        return;
      }
      flushToolGroup(entries, toolGroup);
      toolGroup = [];
      entries.push(item);
    });
    flushToolGroup(entries, toolGroup);
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
    backendLabelEl.textContent = snapshot.backendLabel || "-";
    renderBackendPicker(snapshot);
    statusLabelEl.textContent = snapshot.statusLabel || "-";
    targetLabelEl.textContent =
      snapshot.target === "reader"
        ? labels.targetReader || "Reader"
        : labels.targetLibrary || "Library";
    agentLabelEl.textContent =
      [snapshot.agentLabel, snapshot.agentVersion].filter(Boolean).join(" ") || "-";
    sessionLabelEl.textContent = snapshot.sessionTitle || snapshot.sessionId || "-";
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
    sendBtnEl.textContent = labels.send || "Send";
    newConversationBtnEl.textContent = labels.newConversation || "New Conversation";
    reconnectBtnEl.textContent = labels.reconnect || "Reconnect";
    cancelBtnEl.textContent = labels.cancel || "Cancel";
    closeBtnEl.textContent = labels.close || "Close";
    authenticateBtnEl.textContent = labels.authenticate || "Authenticate";
    manageBackendsBtnEl.textContent = labels.manageBackends || "Manage Backends";
    const isConnecting =
      snapshot.status === "checking-command" ||
      snapshot.status === "spawning" ||
      snapshot.status === "initializing";
    const isBusy = snapshot.busy === true;
    inputEl.disabled = isConnecting;
    sendBtnEl.disabled = isConnecting;
    cancelBtnEl.disabled = !isBusy;
    authenticateBtnEl.disabled =
      !Array.isArray(snapshot.authMethods) || snapshot.authMethods.length === 0;
    statusSummaryEl.setAttribute("data-status", String(snapshot.status || "idle"));
    renderBanner(snapshot);
    renderActionsMenu(snapshot);
    renderChatMode(snapshot);
    renderStatusDetails(snapshot);
    renderPickers(snapshot);
    renderPermission(snapshot);
    renderDiagnostics(snapshot);
    renderTranscript(snapshot);
  }

  formEl.addEventListener("submit", function (event) {
    event.preventDefault();
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

  moreBtnEl.addEventListener("click", function (event) {
    event.stopPropagation();
    state.actionsMenuOpen = !state.actionsMenuOpen;
    renderActionsMenu(state.snapshot || {});
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

  allowBtnEl.addEventListener("click", function () {
    if (!state.allowOptionId) {
      return;
    }
    sendAction("resolve-permission", {
      outcome: "selected",
      optionId: state.allowOptionId,
    });
  });

  denyBtnEl.addEventListener("click", function () {
    sendAction("resolve-permission", {
      outcome: state.denyOptionId ? "selected" : "cancelled",
      optionId: state.denyOptionId || "",
    });
  });

  newConversationBtnEl.addEventListener("click", function () {
    sendAction("new-conversation", {});
  });

  reconnectBtnEl.addEventListener("click", function () {
    sendAction("reconnect", {});
  });

  cancelBtnEl.addEventListener("click", function () {
    sendAction("cancel", {});
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
