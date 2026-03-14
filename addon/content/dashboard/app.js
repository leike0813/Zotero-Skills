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

  function render() {
    const app = document.getElementById("app");
    if (!app) {
      return;
    }
    clearNode(app);
    const snapshot = state.snapshot;
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
      const divider = el("div", "tab-divider");
      sidebar.appendChild(divider);
      sidebar.appendChild(
        el("h3", "sidebar-title", snapshot.labels.tabBackends || "Backends"),
      );
      tabs
        .filter((tab) => tab.key !== "home")
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
    } else if (snapshot.backendView && snapshot.backendView.backendType === "skillrunner") {
      main.classList.add("skillrunner-fill");
      renderSkillRunnerBackend(main, snapshot);
    } else {
      renderGenericBackend(main, snapshot);
    }
    app.appendChild(main);
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
