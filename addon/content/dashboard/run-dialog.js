(function () {
  const state = {
    snapshot: null,
    draft: "",
  };

  function sendAction(action, payload) {
    const message = {
      type: "run-dialog:action",
      action,
      payload: payload || {},
    };
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

  function renderMetaItem(meta, label, value, className) {
    const item = el("div", "meta-item");
    item.appendChild(el("div", "meta-label", label));
    item.appendChild(el("div", className || "meta-value", String(value || "-")));
    meta.appendChild(item);
  }

  function renderStatusBadge(status) {
    return el("span", "status " + String(status || "").toLowerCase(), String(status || "-"));
  }

  function isTerminalStatus(status) {
    const normalized = String(status || "").trim().toLowerCase();
    return normalized === "succeeded" || normalized === "failed" || normalized === "canceled";
  }

  function render() {
    const app = document.getElementById("app");
    if (!app) {
      return;
    }
    clearNode(app);
    const snapshot = state.snapshot;
    if (!snapshot) {
      const panel = el("div", "panel", "Loading run details...");
      app.appendChild(panel);
      return;
    }

    document.title = snapshot.title || "Run Details";
    const labels = snapshot.labels || {};

    const header = el("div", "header");
    const titleWrap = el("div");
    titleWrap.appendChild(el("h1", "title", snapshot.title || "Run Details"));
    titleWrap.appendChild(el("div", "subtitle", snapshot.backendTitle || ""));
    header.appendChild(titleWrap);
    const cancelTopBtn = el("button", "btn", labels.cancel || "Cancel Run");
    cancelTopBtn.disabled = isTerminalStatus(snapshot.status);
    cancelTopBtn.addEventListener("click", function () {
      sendAction("cancel-run", {
        requestId: snapshot.requestId,
      });
    });
    header.appendChild(cancelTopBtn);
    app.appendChild(header);

    const metaPanel = el("div", "panel");
    const meta = el("div", "meta");
    renderMetaItem(meta, labels.requestId || "Request ID", snapshot.requestId || "-");
    const statusItem = el("div", "meta-item");
    statusItem.appendChild(el("div", "meta-label", labels.status || "Status"));
    const statusVal = el("div", "meta-value");
    statusVal.appendChild(renderStatusBadge(snapshot.status || ""));
    statusItem.appendChild(statusVal);
    meta.appendChild(statusItem);
    renderMetaItem(meta, labels.updatedAt || "Updated At", snapshot.updatedAt || "-");
    renderMetaItem(meta, labels.pendingOwner || "Pending Owner", snapshot.pendingOwner || "-");
    renderMetaItem(
      meta,
      labels.pendingInteractionId || "Pending Interaction ID",
      snapshot.pendingInteractionId || "-",
    );
    renderMetaItem(meta, labels.loading || "Loading", snapshot.loading ? "true" : "false");
    if (snapshot.error) {
      renderMetaItem(meta, labels.error || "Error", snapshot.error, "meta-value error");
    }
    metaPanel.appendChild(meta);
    app.appendChild(metaPanel);

    const chat = el("pre", "chat-view");
    const lines = (snapshot.messages || []).map(function (entry) {
      const prefix = entry.ts ? "[" + entry.ts + "] " : "";
      return prefix + entry.text;
    });
    chat.textContent = lines.length > 0 ? lines.join("\n") : labels.chatEmpty || "No chat events yet.";
    app.appendChild(chat);

    const inputRow = el("div", "input-row");
    const input = el("input", "text-input");
    input.type = "text";
    input.value = state.draft;
    input.placeholder = snapshot.pendingPrompt || labels.replyPlaceholder || "Reply text...";
    input.addEventListener("input", function () {
      state.draft = input.value;
    });
    inputRow.appendChild(input);

    const replyBtn = el("button", "btn primary", labels.reply || "Reply");
    replyBtn.disabled = !snapshot.pendingInteractionId;
    replyBtn.addEventListener("click", function () {
      sendAction("reply-run", {
        requestId: snapshot.requestId,
        interactionId: snapshot.pendingInteractionId,
        replyText: String(input.value || ""),
      });
      state.draft = "";
      input.value = "";
    });
    inputRow.appendChild(replyBtn);

    app.appendChild(inputRow);
  }

  window.addEventListener("message", function (event) {
    const data = event.data;
    if (!data || typeof data !== "object") {
      return;
    }
    if (data.type === "run-dialog:init" || data.type === "run-dialog:snapshot") {
      state.snapshot = data.payload || null;
      render();
    }
  });

  sendAction("ready", {});
  render();
})();
