(function () {
  const state = {
    snapshot: null,
  };

  function sendAction(action, payload) {
    const message = {
      type: "dashboard:action",
      action,
      payload: payload || {},
    };
    const rawTargets = [window.parent, window.top, window.opener];
    const dedup = new Set();
    rawTargets.forEach(function (target) {
      if (!target) {
        return;
      }
      if (dedup.has(target)) {
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
      return "-";
    }
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return text;
    }
    return parsed.toLocaleString();
  }

  function isTerminalStatus(status, semantics) {
    if (semantics && typeof semantics === "object") {
      if (typeof semantics.terminal === "boolean") {
        return semantics.terminal;
      }
    }
    const normalized = String(status || "").trim().toLowerCase();
    return normalized === "succeeded" || normalized === "failed" || normalized === "canceled";
  }

  function renderStatusBadge(stateValue, label) {
    const status = el("span", `status ${String(stateValue || "").toLowerCase()}`, label);
    return status;
  }

  function renderTaskTable(args) {
    const rows = Array.isArray(args.rows) ? args.rows : [];
    const labels = args.labels;
    const wrap = el("div", "panel");
    if (args.panelClassName) {
      wrap.classList.add(args.panelClassName);
    }
    if (rows.length === 0) {
      wrap.appendChild(el("div", "empty", args.emptyText));
      return wrap;
    }

    const tableWrap = el("div", "table-wrap");
    const table = document.createElement("table");
    if (args.tableClassName) {
      table.className = args.tableClassName;
    }
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const columns = args.columns || [
      labels.colTask,
      labels.colWorkflow,
      labels.colStatus,
      labels.colRequestId,
      labels.colUpdatedAt,
      labels.colActions || "Actions",
    ];
    columns.forEach((title) => {
      const th = document.createElement("th");
      th.textContent = title;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      if (args.selectedId && args.selectedId === row.id) {
        tr.classList.add("selected");
      }
      if (typeof args.onRowClick === "function") {
        tr.classList.add("clickable");
        tr.addEventListener("click", function () {
          args.onRowClick(row);
        });
      }

      if (typeof args.renderRow === "function") {
        args.renderRow(tr, row);
      } else {
        const taskCell = document.createElement("td");
        taskCell.textContent = row.taskName;
        tr.appendChild(taskCell);

        const workflowCell = document.createElement("td");
        workflowCell.textContent = row.workflowLabel;
        tr.appendChild(workflowCell);

        const statusCell = document.createElement("td");
        statusCell.appendChild(renderStatusBadge(row.state, row.stateLabel));
        tr.appendChild(statusCell);

        const requestCell = document.createElement("td");
        requestCell.className = "mono";
        requestCell.textContent = row.requestId || "-";
        tr.appendChild(requestCell);

        const updatedCell = document.createElement("td");
        updatedCell.textContent = formatTime(row.updatedAt);
        tr.appendChild(updatedCell);

        const actionCell = document.createElement("td");
        actionCell.className = "actions-cell";
        const actionsWrap = el("div", "actions-wrap");
        const actionButtons = args.buildActions ? args.buildActions(row) : [];
        if (actionButtons.length === 0) {
          actionsWrap.textContent = "-";
        } else {
          actionButtons.forEach((button) => actionsWrap.appendChild(button));
        }
        actionCell.appendChild(actionsWrap);
        tr.appendChild(actionCell);
      }

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);
    return wrap;
  }

  function renderLogTable(main, snapshot) {
    const labels = snapshot.labels;
    const backend = snapshot.backendView;
    if (!backend) {
      return;
    }

    const section = el("section", "section");
    section.appendChild(el("h3", "section-title", labels.logsTitle));

    const bound = el("div", "bound-task");
    const boundTaskId = backend.selectedLogTaskId || "-";
    const boundRequestId = backend.selectedLogTaskRequestId || "-";
    const boundJobId = backend.selectedLogTaskJobId || "-";
    bound.appendChild(
      el("div", "bound-task-item mono", `${labels.logsBoundTask}: ${boundTaskId}`),
    );
    bound.appendChild(
      el("div", "bound-task-item mono", `${labels.logsBoundRequestId}: ${boundRequestId}`),
    );
    bound.appendChild(
      el("div", "bound-task-item mono", `${labels.logsBoundJobId}: ${boundJobId}`),
    );
    section.appendChild(bound);

    section.appendChild(
      renderTaskTable({
        rows: backend.logRows || [],
        labels,
        selectedId: backend.selectedLogEntryId,
        emptyText: labels.logsEmpty,
        tableClassName: "logs-table",
        columns: [
          labels.colTime,
          labels.colLevel,
          labels.colStage,
          labels.colScope,
          labels.colMessage,
          labels.colRequestId,
          labels.colJobId,
        ],
        onRowClick: (row) => {
          sendAction("select-log-entry", {
            backendId: backend.backendId,
            logEntryId: row.id,
          });
        },
        renderRow: (tr, row) => {
          const timeCell = document.createElement("td");
          timeCell.textContent = formatTime(row.ts);
          tr.appendChild(timeCell);

          const levelCell = document.createElement("td");
          levelCell.appendChild(
            renderStatusBadge(row.level, String(row.level || "").toUpperCase()),
          );
          tr.appendChild(levelCell);

          const stageCell = document.createElement("td");
          stageCell.textContent = row.stage || "-";
          tr.appendChild(stageCell);

          const scopeCell = document.createElement("td");
          scopeCell.textContent = row.scope || "-";
          tr.appendChild(scopeCell);

          const messageCell = document.createElement("td");
          messageCell.textContent = row.message || "-";
          tr.appendChild(messageCell);

          const requestCell = document.createElement("td");
          requestCell.className = "mono";
          requestCell.textContent = row.requestId || "-";
          tr.appendChild(requestCell);

          const jobCell = document.createElement("td");
          jobCell.className = "mono";
          jobCell.textContent = row.jobId || "-";
          tr.appendChild(jobCell);
        },
      }),
    );

    const detailSection = el("div", "log-detail");
    detailSection.appendChild(el("h4", "section-title", labels.logsDetailTitle));
    const detailPayload = backend.selectedLogEntryPayload || null;
    const detailText = detailPayload
      ? JSON.stringify(detailPayload, null, 2)
      : labels.logsEmpty;
    const detail = el("pre", "log-view mono");
    detail.textContent = detailText;
    detailSection.appendChild(detail);
    section.appendChild(detailSection);
    main.appendChild(section);
  }

  function renderSummary(main, snapshot) {
    const labels = snapshot.labels;
    const cards = el("div", "cards");
    [
      { label: labels.summaryTotal, value: snapshot.summary.total },
      { label: labels.summaryRunning, value: snapshot.summary.running },
      { label: labels.summarySucceeded, value: snapshot.summary.succeeded },
      { label: labels.summaryFailed, value: snapshot.summary.failed },
      { label: labels.summaryCanceled, value: snapshot.summary.canceled },
    ].forEach((entry) => {
      const card = el("div", "card");
      card.appendChild(el("div", "card-label", String(entry.label)));
      card.appendChild(el("div", "card-value", String(entry.value)));
      cards.appendChild(card);
    });
    main.appendChild(cards);

    const section = el("section", "section");
    section.appendChild(el("h3", "section-title", labels.runningTitle));
    section.appendChild(
      renderTaskTable({
        rows: snapshot.runningRows || [],
        labels,
        emptyText: labels.noRunning,
        onRowClick: (row) => {
          sendAction("open-running-task", {
            taskId: row.id,
            backendId: row.backendId || "",
            backendType: row.backendType || "",
            requestId: row.requestId || "",
          });
        },
        columns: [
          labels.colTask,
          labels.colWorkflow,
          labels.colBackend || "Backend",
          labels.colStatus,
          labels.colUpdatedAt,
        ],
        renderRow: (tr, row) => {
          const taskCell = document.createElement("td");
          taskCell.textContent = row.taskName || "-";
          tr.appendChild(taskCell);

          const workflowCell = document.createElement("td");
          workflowCell.textContent = row.workflowLabel || "-";
          tr.appendChild(workflowCell);

          const backendCell = document.createElement("td");
          backendCell.textContent = row.backendLabel || "-";
          tr.appendChild(backendCell);

          const statusCell = document.createElement("td");
          statusCell.appendChild(renderStatusBadge(row.state, row.stateLabel));
          tr.appendChild(statusCell);

          const updatedCell = document.createElement("td");
          updatedCell.textContent = formatTime(row.updatedAt);
          tr.appendChild(updatedCell);
        },
      }),
    );
    main.appendChild(section);
  }

  function renderGenericBackend(main, snapshot) {
    const labels = snapshot.labels;
    const backend = snapshot.backendView;
    if (!backend) {
      main.appendChild(el("div", "empty", labels.noHistory));
      return;
    }
    const toolbar = el("div", "toolbar");
    toolbar.appendChild(el("h2", "page-title", backend.title));
    const openDiagnostics = el(
      "button",
      "btn",
      labels.logsOpenDiagnostics || "Diagnostic Export",
    );
    openDiagnostics.disabled = !backend.selectedLogTaskId;
    openDiagnostics.addEventListener("click", function () {
      sendAction("open-log-diagnostics", {
        backendId: backend.backendId,
        taskId: backend.selectedLogTaskId || "",
      });
    });
    toolbar.appendChild(openDiagnostics);
    main.appendChild(toolbar);

    main.appendChild(
      renderTaskTable({
        rows: backend.rows || [],
        labels,
        selectedId: backend.selectedLogTaskId,
        emptyText: backend.emptyRowsText || labels.backendNoTasks || labels.noHistory,
        onRowClick: (row) => {
          sendAction("select-log-task", {
            backendId: backend.backendId,
            taskId: row.id,
          });
        },
        buildActions: (row) => {
          const view = el("button", "btn", labels.logsViewTask);
          view.addEventListener("click", function () {
            sendAction("select-log-task", {
              backendId: backend.backendId,
              taskId: row.id,
            });
          });
          return [view];
        },
      }),
    );

    renderLogTable(main, snapshot);
  }

  function renderSkillRunnerBackend(main, snapshot) {
    const labels = snapshot.labels;
    const backend = snapshot.backendView;
    if (!backend) {
      main.appendChild(el("div", "empty", labels.noHistory));
      return;
    }
    const toolbar = el("div", "toolbar");
    toolbar.appendChild(el("h2", "page-title", backend.title));
    const openManagement = el("button", "btn", labels.openManagement);
    openManagement.addEventListener("click", function () {
      sendAction("open-management", {
        backendId: backend.backendId,
      });
    });
    toolbar.appendChild(openManagement);
    main.appendChild(toolbar);

    main.appendChild(
      renderTaskTable({
        rows: backend.rows || [],
        labels,
        panelClassName: "skillrunner-task-panel",
        emptyText: backend.emptyRowsText || labels.backendNoTasks || labels.noHistory,
        columns: [
          labels.colTask,
          labels.colWorkflow,
          labels.colEngine || "Engine",
          labels.colStatus,
          labels.colRequestId,
          labels.colUpdatedAt,
          labels.colActions || "Actions",
        ],
        renderRow: (tr, row) => {
          const taskCell = document.createElement("td");
          taskCell.textContent = row.taskName;
          tr.appendChild(taskCell);

          const workflowCell = document.createElement("td");
          workflowCell.textContent = row.workflowLabel;
          tr.appendChild(workflowCell);

          const engineCell = document.createElement("td");
          engineCell.textContent = row.engine || "-";
          tr.appendChild(engineCell);

          const statusCell = document.createElement("td");
          statusCell.appendChild(renderStatusBadge(row.state, row.stateLabel));
          tr.appendChild(statusCell);

          const requestCell = document.createElement("td");
          requestCell.className = "mono";
          requestCell.textContent = row.requestId || "-";
          tr.appendChild(requestCell);

          const updatedCell = document.createElement("td");
          updatedCell.textContent = formatTime(row.updatedAt);
          tr.appendChild(updatedCell);

          const actionCell = document.createElement("td");
          actionCell.className = "actions-cell";
          const actionsWrap = el("div", "actions-wrap");
          const actionButtons = [];
          if (row.requestId) {
            const openRun = el("button", "btn", labels.openRun);
            openRun.addEventListener("click", function () {
              sendAction("open-run", {
                backendId: backend.backendId,
                requestId: row.requestId,
              });
            });
            actionButtons.push(openRun);
            const cancelRun = el("button", "btn", labels.cancelRun);
            cancelRun.disabled = isTerminalStatus(row.state, row.stateSemantics);
            cancelRun.addEventListener("click", function () {
              sendAction("cancel-run", {
                backendId: backend.backendId,
                requestId: row.requestId,
              });
            });
            actionButtons.push(cancelRun);
          }
          if (actionButtons.length === 0) {
            actionsWrap.textContent = "-";
          } else {
            actionButtons.forEach((button) => actionsWrap.appendChild(button));
          }
          actionCell.appendChild(actionsWrap);
          tr.appendChild(actionCell);
        },
      }),
    );
  }

  function cloneRecord(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {};
    }
    return JSON.parse(JSON.stringify(raw));
  }

  function isPositiveIntegerField(entry) {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const key = String(entry.key || "").trim().toLowerCase();
    if (!key) {
      return false;
    }
    if (key === "hard_timeout_seconds") {
      return true;
    }
    return key.includes("timeout");
  }

  function validateNumberFieldValue(args) {
    const raw = String(args.rawValue == null ? "" : args.rawValue).trim();
    if (!raw) {
      return { ok: true, remove: true };
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return {
        ok: false,
        message:
          args.labels.workflowSettingsNumberInvalid ||
          "Please enter a valid number.",
      };
    }
    if (isPositiveIntegerField(args.entry)) {
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return {
          ok: false,
          message:
            args.labels.workflowSettingsPositiveIntegerRequired ||
            "Please enter a positive integer.",
        };
      }
    }
    return { ok: true, value: parsed };
  }

  function renderWorkflowField(args) {
    const row = el("div", "workflow-settings-field");
    const label = el(
      "label",
      "workflow-settings-field-label",
      args.entry.title || args.entry.key,
    );
    row.appendChild(label);
    if (args.entry.description) {
      row.appendChild(
        el("div", "workflow-settings-field-desc", args.entry.description),
      );
    }
    const currentValue = Object.prototype.hasOwnProperty.call(
      args.values,
      args.entry.key,
    )
      ? args.values[args.entry.key]
      : args.entry.defaultValue;
    let control;
    const enumValues = Array.isArray(args.entry.enumValues)
      ? args.entry.enumValues
      : [];
    if (args.entry.type === "boolean") {
      const line = el("label", "workflow-settings-field-checkbox");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = currentValue === true;
      checkbox.addEventListener("change", function () {
        args.values[args.entry.key] = checkbox.checked;
        args.onChange({
          changedKey: args.entry.key,
        });
      });
      line.appendChild(checkbox);
      line.appendChild(
        el("span", "", args.entry.title || args.entry.key),
      );
      row.appendChild(line);
      return row;
    }
    if (enumValues.length > 0 && args.entry.allowCustom !== true) {
      const options = enumValues.map(function(val) { return { value: String(val), label: String(val) }; });
      const currentValueStr = String(currentValue == null ? enumValues[0] || "" : currentValue);
      const customSelect = window.createCustomSelect(options, currentValueStr, function (newValue) {
        args.values[args.entry.key] = newValue;
        args.onChange({
          changedKey: args.entry.key,
        });
      });
      control = customSelect.element;
      control.classList.add("workflow-settings-field-control");
    } else {
      control = document.createElement("input");
      control.type = "text";
      if (args.entry.type === "number") {
        control.setAttribute(
          "inputmode",
          isPositiveIntegerField(args.entry) ? "numeric" : "decimal",
        );
      }
      control.value = String(currentValue == null ? "" : currentValue);
      control.className = "workflow-settings-field-control";
      if (args.entry.type === "number") {
        control.classList.add("numeric");
      }
    }
    const errorNode = el("div", "workflow-settings-field-error");
    const setFieldError = function (message) {
      if (message) {
        control.classList.add("invalid");
        errorNode.textContent = message;
        if (!errorNode.parentNode) {
          row.appendChild(errorNode);
        }
      } else {
        control.classList.remove("invalid");
        if (errorNode.parentNode) {
          errorNode.parentNode.removeChild(errorNode);
        }
      }
    };
    control.addEventListener("change", function () {
      if (args.entry.type === "number") {
        const validation = validateNumberFieldValue({
          entry: args.entry,
          rawValue: control.value,
          labels: args.labels || {},
        });
        if (!validation.ok) {
          setFieldError(validation.message);
          return;
        }
        setFieldError("");
        if (validation.remove) {
          delete args.values[args.entry.key];
        } else {
          args.values[args.entry.key] = validation.value;
        }
      } else {
        setFieldError("");
        args.values[args.entry.key] = control.value;
      }
      args.onChange({
        changedKey: args.entry.key,
      });
    });
    row.appendChild(control);
    return row;
  }

  function renderWorkflowSettingsSection(args) {
    const card = el("section", "workflow-settings-card");
    card.appendChild(el("h3", "workflow-settings-card-title", args.title));
    if (!Array.isArray(args.entries) || args.entries.length === 0) {
      card.appendChild(
        el("div", "workflow-settings-empty", args.emptyText),
      );
      return card;
    }
    args.entries.forEach(function (entry) {
      card.appendChild(
        renderWorkflowField({
          entry,
          values: args.values,
          onChange: function (changeMeta) {
            args.onChange({
              changedSection: args.changedSection,
              changedKey:
                changeMeta && typeof changeMeta.changedKey === "string"
                  ? changeMeta.changedKey
                  : "",
            });
          },
          labels: args.labels,
        }),
      );
    });
    return card;
  }

  function renderWorkflowOptions(main, snapshot) {
    const labels = snapshot.labels || {};
    const view = snapshot.workflowOptionsView || {};
    main.appendChild(
      el(
        "h2",
        "page-title",
        labels.tabWorkflowOptions || "Workflow Options",
      ),
    );
    const workflows = Array.isArray(view.workflows) ? view.workflows : [];
    if (workflows.length === 0) {
      main.appendChild(
        el(
          "div",
          "empty",
          labels.workflowSettingsNoConfigurable ||
            "No configurable workflows.",
        ),
      );
      return;
    }
    const tabs = el("div", "workflow-subtabs");
    workflows.forEach(function (workflow) {
      const btn = el(
        "button",
        "workflow-subtab-btn",
        workflow.workflowLabel || workflow.workflowId,
      );
      if (workflow.workflowId === view.selectedWorkflowId) {
        btn.classList.add("active");
      }
      btn.addEventListener("click", function () {
        sendAction("select-workflow-settings-workflow", {
          workflowId: workflow.workflowId,
        });
      });
      tabs.appendChild(btn);
    });
    main.appendChild(tabs);

    const descriptor = view.selectedDescriptor;
    if (!descriptor) {
      return;
    }
    const shell = el("div", "workflow-settings-shell");
    const banner = el("div", "workflow-settings-banner");
    const meta = el("div", "workflow-settings-meta");
    meta.appendChild(
      el(
        "div",
        "",
        `${labels.workflowSettingsWorkflowLabel || "Workflow"}: ${descriptor.workflowLabel}`,
      ),
    );
    meta.appendChild(
      el(
        "div",
        "",
        `${labels.workflowSettingsProviderLabel || "Provider"}: ${descriptor.providerId}`,
      ),
    );

    const draft = {
      backendId: String(descriptor.selectedProfile || "").trim(),
      workflowParams: cloneRecord(descriptor.workflowParams),
      providerOptions: cloneRecord(descriptor.providerOptions),
    };
    const emitDraft = function (changeMeta) {
      const meta =
        changeMeta && typeof changeMeta === "object" ? changeMeta : {};
      sendAction("workflow-settings-draft", {
        workflowId: view.selectedWorkflowId,
        executionOptions: draft,
        changedSection:
          typeof meta.changedSection === "string" ? meta.changedSection : "",
        changedKey: typeof meta.changedKey === "string" ? meta.changedKey : "",
      });
    };

    if (descriptor.requiresBackendProfile) {
      const profileWrap = el("div", "workflow-settings-banner-profile");
      profileWrap.appendChild(
        el(
          "div",
          "workflow-settings-banner-profile-label",
          labels.workflowSettingsProfileLabel || "Profile",
        ),
      );
      if (descriptor.profileEditable) {
        const options = (descriptor.profiles || []).map(function(entry) { return { value: entry.id, label: entry.label }; });
        const customSelect = window.createCustomSelect(options, String(draft.backendId || ""), function(newValue) {
          draft.backendId = String(newValue || "").trim();
          emitDraft({
            changedSection: "backend",
            changedKey: "backendId",
          });
        });
        const selectWrap = customSelect.element;
        selectWrap.classList.add("workflow-settings-banner-profile-select");
        profileWrap.appendChild(selectWrap);
      } else if (descriptor.profileMissing) {
        profileWrap.appendChild(
          el(
            "div",
            "workflow-settings-error",
            labels.workflowSettingsBlockedNoProfile ||
              "No backend profile available. Please configure one first.",
          ),
        );
      } else {
        const fixed = (descriptor.profiles || []).find(function (entry) {
          return String(entry.id || "").trim() === String(descriptor.selectedProfile || "").trim();
        });
        profileWrap.appendChild(
          el(
            "div",
            "workflow-settings-empty",
            fixed ? fixed.label : "-",
          ),
        );
      }
      banner.appendChild(profileWrap);
    }
    banner.appendChild(meta);
    shell.appendChild(banner);

    const sectionsGrid = el("div", "workflow-settings-sections-grid");
    sectionsGrid.appendChild(
      renderWorkflowSettingsSection({
        title:
          labels.workflowSettingsWorkflowParamsTitle ||
          "Workflow Parameters",
        emptyText:
          labels.workflowSettingsNoWorkflowParams ||
          "This workflow has no configurable parameters.",
        entries: descriptor.workflowSchemaEntries || [],
        values: draft.workflowParams,
        onChange: emitDraft,
        changedSection: "workflowParams",
        labels: labels,
      }),
    );
    sectionsGrid.appendChild(
      renderWorkflowSettingsSection({
        title:
          labels.workflowSettingsProviderOptionsTitle ||
          "Provider Runtime Options",
        emptyText:
          labels.workflowSettingsNoProviderOptions ||
          "This provider has no configurable runtime options.",
        entries: descriptor.providerSchemaEntries || [],
        values: draft.providerOptions,
        onChange: emitDraft,
        changedSection: "providerOptions",
        labels: labels,
      }),
    );
    shell.appendChild(sectionsGrid);
    main.appendChild(shell);
  }

  function render() {
    const app = document.getElementById("app");
    if (!app) {
      return;
    }
    const snapshot = state.snapshot;
    const shouldRestoreWorkflowOptionsScroll = Boolean(
      snapshot && snapshot.selectedTabKey === "workflow-options",
    );
    let previousMainScrollTop = 0;
    if (shouldRestoreWorkflowOptionsScroll) {
      const existingMain = app.querySelector(".main");
      if (
        existingMain &&
        typeof existingMain.scrollTop === "number" &&
        Number.isFinite(existingMain.scrollTop)
      ) {
        previousMainScrollTop = existingMain.scrollTop;
      }
    }
    clearNode(app);
    if (!snapshot) {
      const loading = el("div", "main");
      loading.appendChild(el("div", "empty", "Loading dashboard..."));
      app.appendChild(el("aside", "sidebar"));
      app.appendChild(loading);
      return;
    }

    document.title = snapshot.title || "Task Dashboard";

    const sidebar = el("aside", "sidebar");
    sidebar.appendChild(el("h3", "sidebar-title", snapshot.labels.tabHome || "Home"));
    const tabs = Array.isArray(snapshot.tabs) ? snapshot.tabs : [];
    if (tabs.length === 0) {
      sidebar.appendChild(el("div", "empty", snapshot.labels.noBackends));
    } else {
      const homeTab = tabs.find((tab) => tab.key === "home");
      if (homeTab) {
        const btn = el("button", "tab-btn", homeTab.label || homeTab.key);
        if (homeTab.key === snapshot.selectedTabKey) {
          btn.classList.add("active");
        }
        btn.addEventListener("click", function () {
          sendAction("select-tab", {
            tabKey: homeTab.key,
          });
        });
        sidebar.appendChild(btn);
      }
      const workflowOptionsTab = tabs.find(
        (tab) => tab.key === "workflow-options",
      );
      if (workflowOptionsTab) {
        const btn = el(
          "button",
          "tab-btn",
          workflowOptionsTab.label || workflowOptionsTab.key,
        );
        if (workflowOptionsTab.key === snapshot.selectedTabKey) {
          btn.classList.add("active");
        }
        btn.addEventListener("click", function () {
          sendAction("select-tab", {
            tabKey: workflowOptionsTab.key,
          });
        });
        sidebar.appendChild(btn);
      }
      const divider = el("div", "tab-divider");
      sidebar.appendChild(divider);
      sidebar.appendChild(
        el("h3", "sidebar-title", snapshot.labels.tabBackends || "Backends"),
      );
      tabs
        .filter((tab) => tab.key !== "home" && tab.key !== "workflow-options")
        .forEach(function (tab) {
        const btn = el("button", "tab-btn", tab.label || tab.key);
        if (tab.key === snapshot.selectedTabKey) {
          btn.classList.add("active");
        }
        btn.addEventListener("click", function () {
          sendAction("select-tab", {
            tabKey: tab.key,
          });
        });
        sidebar.appendChild(btn);
        });
    }
    app.appendChild(sidebar);

    const main = el("main", "main");
    main.classList.remove("skillrunner-fill");
    if (snapshot.backendLoadError) {
      main.appendChild(el("div", "error-banner", snapshot.backendLoadError));
    }
    if (snapshot.selectedTabKey === "home") {
      main.appendChild(el("h2", "page-title", snapshot.title));
      renderSummary(main, snapshot);
    } else if (snapshot.selectedTabKey === "workflow-options") {
      renderWorkflowOptions(main, snapshot);
    } else if (snapshot.backendView && snapshot.backendView.backendType === "skillrunner") {
      main.classList.add("skillrunner-fill");
      renderSkillRunnerBackend(main, snapshot);
    } else {
      renderGenericBackend(main, snapshot);
    }
    app.appendChild(main);
    if (shouldRestoreWorkflowOptionsScroll && previousMainScrollTop > 0) {
      main.scrollTop = previousMainScrollTop;
    }
  }

  window.addEventListener("message", function (event) {
    const data = event.data;
    if (!data || typeof data !== "object") {
      return;
    }
    if (data.type === "dashboard:init" || data.type === "dashboard:snapshot") {
      state.snapshot = data.payload || null;
      render();
    }
  });

  sendAction("ready", {});
  render();
})();
