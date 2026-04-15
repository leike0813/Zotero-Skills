(function () {
  const state = {
    snapshot: null,
    workspace: null,
    workspaceLabels: null,
    chatModel: null,
    chatDisplayMode: "plain",
    markdownParser: undefined,
    renderedChatOrder: [],
    renderedChatKeys: new Set(),
    promptSig: "",
    authSig: "",
  };

  const titleEl = document.getElementById("run-title");
  const subtitleEl = document.getElementById("run-subtitle");
  const statusEl = document.getElementById("run-status");
  const runEngineEl = document.getElementById("run-engine");
  const runModelEl = document.getElementById("run-model");
  const pendingIdEl = document.getElementById("pending-id");
  const updatedAtEl = document.getElementById("run-updated-at");
  const pendingOwnerEl = document.getElementById("run-pending-owner");
  const cancelBtnEl = document.getElementById("cancel-run-btn");

  const chatEl = document.getElementById("chat-panel");
  const chatModePlainEl = document.getElementById("chat-mode-plain");
  const chatModeBubbleEl = document.getElementById("chat-mode-bubble");
  const thinkingCardEl = document.getElementById("thinking-card");
  const thinkingTitleEl = document.getElementById("thinking-title");
  const thinkingDescEl = document.getElementById("thinking-desc");
  const finalSummaryCardEl = document.getElementById("final-summary-card");
  const finalSummaryStatusEl = document.getElementById("final-summary-status");

  const promptCardEl = document.getElementById("prompt-card");
  const promptTitleEl = document.getElementById("prompt-card-title");
  const promptTextEl = document.getElementById("prompt-card-text");
  const promptHintEl = document.getElementById("prompt-card-hint");
  const promptFilesEl = document.getElementById("prompt-card-files");
  const promptIdEl = document.getElementById("prompt-card-id");
  const promptKindEl = document.getElementById("prompt-card-kind");
  const promptRequiredEl = document.getElementById("prompt-card-required");
  const promptActionsEl = document.getElementById("prompt-card-actions");
  const promptMetaIdLabelEl = document.getElementById("prompt-meta-id-label");
  const promptMetaKindLabelEl = document.getElementById("prompt-meta-kind-label");

  const authCardEl = document.getElementById("auth-card");
  const authTitleEl = document.getElementById("auth-card-title");
  const authTextEl = document.getElementById("auth-card-text");
  const authHintEl = document.getElementById("auth-card-hint");
  const authIdEl = document.getElementById("auth-card-id");
  const authEngineEl = document.getElementById("auth-card-engine");
  const authProviderEl = document.getElementById("auth-card-provider");
  const authActionsEl = document.getElementById("auth-card-actions");
  const authLinkEl = document.getElementById("auth-card-link");
  const authCodeEl = document.getElementById("auth-card-code");
  const authErrorEl = document.getElementById("auth-card-error");
  const authMetaSessionLabelEl = document.getElementById("auth-meta-session-label");
  const authMetaEngineLabelEl = document.getElementById("auth-meta-engine-label");
  const authMetaProviderLabelEl = document.getElementById("auth-meta-provider-label");
  const authImportPanelEl = document.getElementById("auth-import-panel");
  const authImportHintEl = document.getElementById("auth-import-hint");
  const authImportRiskEl = document.getElementById("auth-import-risk");
  const authImportFilesEl = document.getElementById("auth-import-files");
  const authImportSubmitEl = document.getElementById("auth-import-submit");

  const replyFormEl = document.getElementById("reply-form");
  const replyComposerEl = document.getElementById("reply-composer");
  const interactionIdEl = document.getElementById("interaction-id");
  const authSessionIdEl = document.getElementById("auth-session-id");
  const authReplyModeEl = document.getElementById("auth-reply-mode");
  const authInputKindEl = document.getElementById("auth-input-kind");
  const replyTextEl = document.getElementById("reply-text");
  const replySubmitEl = document.getElementById("reply-submit");
  const replyShortcutHintEl = document.getElementById("reply-shortcut-hint");
  const replyErrorEl = document.getElementById("reply-error");

  const metaStatusLabelEl = document.getElementById("meta-label-status");
  const metaEngineLabelEl = document.getElementById("meta-label-engine");
  const metaModelLabelEl = document.getElementById("meta-label-model");
  const metaPendingIdLabelEl = document.getElementById("meta-label-pending-id");
  const metaUpdatedAtLabelEl = document.getElementById("meta-label-updated-at");
  const metaPendingOwnerLabelEl = document.getElementById("meta-label-pending-owner");
  const workspaceGroupsEl = document.getElementById("workspace-groups");
  const workspaceEmptyEl = document.getElementById("workspace-empty");
  const DEFAULT_INTERACTION_PROMPT = "The agent is waiting for your reply.";

  function sendAction(action, payload) {
    const msg = { type: "run-dialog:action", action, payload: payload || {} };
    const targets = [window.parent, window.top, window.opener];
    const dedup = new Set();
    targets.forEach(function (target) {
      if (!target || dedup.has(target)) return;
      dedup.add(target);
      try {
        target.postMessage(msg, "*");
      } catch {}
    });
  }

  function labels() {
    return state.snapshot && state.snapshot.labels && typeof state.snapshot.labels === "object"
      ? state.snapshot.labels
      : {};
  }

  function workspaceLabels() {
    return state.workspaceLabels && typeof state.workspaceLabels === "object"
      ? state.workspaceLabels
      : {};
  }

  function safeText(v) {
    return typeof v === "string" ? v : "";
  }

  function escapeHtml(value) {
    return safeText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createCompatibleThinkingChatModel(initialMode) {
    const core = window.SkillRunnerThinkingChatCore;
    if (!core || typeof core.createThinkingChatModel !== "function") {
      return null;
    }
    const model = core.createThinkingChatModel(initialMode);
    if (model && typeof model.setDisplayMode === "function") {
      model.setDisplayMode(initialMode);
    }
    if (!model || typeof model.getEntries !== "function") {
      return null;
    }
    const hasGetDisplayMode = typeof model.getDisplayMode === "function";
    if (!hasGetDisplayMode) {
      model.getDisplayMode = function () {
        return safeText(initialMode).trim().toLowerCase() === "bubble" ? "bubble" : "plain";
      };
    }
    return model;
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
    const markdownText = safeText(textValue);
    const mdParser = ensureMarkdownParser();
    if (!mdParser || typeof markdownText !== "string") {
      return escapeHtml(markdownText);
    }
    try {
      return mdParser.render(markdownText).trimEnd();
    } catch (error) {
      console.warn("Markdown render error, falling back to plain text:", error);
      return escapeHtml(markdownText);
    }
  }

  function setChatDisplayMode(mode) {
    state.chatDisplayMode = safeText(mode).trim().toLowerCase() === "bubble" ? "bubble" : "plain";
    if (state.chatModel && typeof state.chatModel.setDisplayMode === "function") {
      state.chatModel.setDisplayMode(state.chatDisplayMode);
    }
    chatEl.classList.toggle("plain-mode", state.chatDisplayMode === "plain");
    chatEl.classList.toggle("bubble-mode", state.chatDisplayMode === "bubble");
    if (chatModePlainEl) {
      chatModePlainEl.classList.toggle("active", state.chatDisplayMode === "plain");
      chatModePlainEl.setAttribute("aria-pressed", state.chatDisplayMode === "plain" ? "true" : "false");
    }
    if (chatModeBubbleEl) {
      chatModeBubbleEl.classList.toggle("active", state.chatDisplayMode === "bubble");
      chatModeBubbleEl.setAttribute("aria-pressed", state.chatDisplayMode === "bubble" ? "true" : "false");
    }
  }

  function text(v) {
    return String(v == null ? "" : v);
  }

  function toArray(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(function (x) { return text(x).trim(); }).filter(Boolean);
  }

  function choiceOptions(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    raw.forEach(function (item) {
      if (typeof item === "string") {
        const t = item.trim();
        if (t) out.push({ label: t, value: t });
        return;
      }
      if (!item || typeof item !== "object") return;
      const label = text(item.label).trim();
      if (!label) return;
      out.push({ label, value: Object.prototype.hasOwnProperty.call(item, "value") ? item.value : label });
    });
    return out;
  }

  function resolvePromptOptions(kind, raw) {
    const options = choiceOptions(raw);
    if (kind === "confirm" && options.length === 0) {
      const l = labels();
      const yesText = safeText(l.confirmYes) || "Yes";
      const noText = safeText(l.confirmNo) || "No";
      return [
        { label: yesText, value: yesText },
        { label: noText, value: noText },
      ];
    }
    return options;
  }

  function uploadSpecs(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(function (item) {
      if (!item || typeof item !== "object") return null;
      const name = safeText(item.name).trim();
      if (!name) return null;
      return { name, required: item.required === true, hint: safeText(item.hint).trim(), accept: safeText(item.accept).trim() };
    }).filter(Boolean);
  }

  function resolveStatusSemantics(snapshot) {
    const raw = snapshot && snapshot.statusSemantics && typeof snapshot.statusSemantics === "object"
      ? snapshot.statusSemantics
      : null;
    const normalized = safeText((raw && raw.normalized) || (snapshot && snapshot.status))
      .trim()
      .toLowerCase();
    const terminal = raw && typeof raw.terminal === "boolean"
      ? raw.terminal
      : (normalized === "succeeded" || normalized === "failed" || normalized === "canceled");
    const waiting = raw && typeof raw.waiting === "boolean"
      ? raw.waiting
      : (normalized === "waiting_user" || normalized === "waiting_auth");
    return {
      normalized: normalized || "running",
      terminal,
      waiting,
    };
  }

  function isTerminal(status, semantics) {
    if (semantics && typeof semantics === "object" && typeof semantics.terminal === "boolean") {
      return semantics.terminal;
    }
    const s = safeText(status).trim().toLowerCase();
    return s === "succeeded" || s === "failed" || s === "canceled";
  }

  function setStatusBadge(status) {
    const s = safeText(status).trim().toLowerCase() || "unknown";
    statusEl.textContent = s;
    statusEl.className = "status-badge status-" + s;
  }

  function setReplyEnabled(enabled, opts) {
    const options = opts || {};
    const textEnabled = enabled && options.textEnabled !== false;
    replyTextEl.disabled = !textEnabled;
    replySubmitEl.disabled = !enabled;
  }

  function setReplyComposerVisible(visible) {
    replyComposerEl.classList.toggle("hidden", !visible);
  }

  function clearReplyError() {
    replyErrorEl.textContent = "";
    replyErrorEl.classList.add("hidden");
  }

  function showReplyError(message) {
    const m = safeText(message).trim();
    if (!m) {
      clearReplyError();
      return;
    }
    replyErrorEl.textContent = m;
    replyErrorEl.classList.remove("hidden");
  }

  function resetReplyComposer() {
    const l = labels();
    clearReplyError();
    replyTextEl.placeholder = safeText(l.replyPlaceholder) || "Reply to agent...";
    replyTextEl.value = "";
    replySubmitEl.textContent = safeText(l.replySend) || "Send Reply";
    setReplyComposerVisible(true);
    authReplyModeEl.value = "";
    authInputKindEl.value = "";
  }

  function clearFinalSummary() {
    finalSummaryCardEl.classList.add("hidden");
    finalSummaryStatusEl.textContent = "";
  }

  function renderFinalSummary(status) {
    const normalized = safeText(status).trim().toLowerCase();
    finalSummaryStatusEl.textContent = normalized || "-";
    finalSummaryCardEl.classList.remove("hidden");
  }

  function clearPromptCard() {
    state.promptSig = "";
    promptCardEl.classList.add("hidden");
    promptTextEl.textContent = "";
    promptHintEl.textContent = "";
    promptHintEl.classList.add("hidden");
    promptFilesEl.textContent = "";
    promptFilesEl.classList.add("hidden");
    promptRequiredEl.textContent = "";
    promptRequiredEl.classList.add("hidden");
    promptActionsEl.textContent = "";
    promptActionsEl.classList.add("hidden");
    promptIdEl.textContent = "-";
    promptKindEl.textContent = "-";
    interactionIdEl.value = "";
    resetReplyComposer();
  }

  function clearAuthImportPanel() {
    authImportPanelEl.classList.add("hidden");
    authImportHintEl.textContent = "";
    authImportRiskEl.textContent = "";
    authImportRiskEl.classList.add("hidden");
    authImportFilesEl.textContent = "";
    authImportSubmitEl.disabled = false;
  }

  function clearAuthCard() {
    state.authSig = "";
    clearAuthImportPanel();
    authCardEl.classList.add("hidden");
    authTextEl.textContent = "";
    authHintEl.textContent = "";
    authHintEl.classList.add("hidden");
    authIdEl.textContent = "-";
    authEngineEl.textContent = "-";
    authProviderEl.textContent = "-";
    authActionsEl.textContent = "";
    authActionsEl.classList.add("hidden");
    authLinkEl.textContent = "";
    authLinkEl.classList.add("hidden");
    authCodeEl.textContent = "";
    authCodeEl.classList.add("hidden");
    authErrorEl.textContent = "";
    authErrorEl.classList.add("hidden");
    authSessionIdEl.value = "";
    resetReplyComposer();
  }

  function renderActionButtons(container, actions) {
    container.textContent = "";
    if (!Array.isArray(actions) || !actions.length) {
      container.classList.add("hidden");
      return;
    }
    actions.forEach(function (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "action-chip";
      button.textContent = safeText(action.label).trim() || "Continue";
      button.addEventListener("click", action.onClick);
      container.appendChild(button);
    });
    container.classList.remove("hidden");
  }

  function updateThinkingCard(status) {
    const l = labels();
    thinkingTitleEl.textContent = safeText(l.thinkingTitle) || "Agent is thinking";
    thinkingDescEl.textContent = safeText(l.thinkingDesc) || "Running inference and preparing the next response...";
    thinkingCardEl.classList.toggle("hidden", safeText(status).trim().toLowerCase() !== "running");
  }

  function processTypeLabel(processType) {
    const l = labels();
    const p = safeText(processType).trim().toLowerCase();
    if (p === "tool_call") return safeText(l.processToolCall) || "Tool Call";
    if (p === "command_execution") return safeText(l.processCommandExecution) || "Command Execution";
    return safeText(l.processReasoning) || "Reasoning";
  }

  function nearBottom(target, threshold) {
    const t = typeof threshold === "number" ? threshold : 24;
    if (!target) return true;
    return target.scrollTop + target.clientHeight >= target.scrollHeight - t;
  }

  function ensureChatModel() {
    if (state.chatModel) return;
    state.chatModel = createCompatibleThinkingChatModel(state.chatDisplayMode);
    setChatDisplayMode(state.chatDisplayMode);
  }

  function chatRoleClass(role) {
    if (role === "assistant") return "agent";
    if (role === "user") return "user";
    return "system";
  }

  function chatRoleText(role) {
    const l = labels();
    if (role === "assistant") return safeText(l.roleAgent) || "Agent";
    if (role === "user") return safeText(l.roleUser) || "User";
    return safeText(l.roleSystem) || "System";
  }

  function toChatEvent(raw) {
    if (!raw || typeof raw !== "object") return null;
    const role = safeText(raw.role).trim().toLowerCase();
    const normalizedRole =
      role === "assistant" || role === "user" || role === "system"
        ? role
        : "system";
    const displayText = safeText(raw.displayText || raw.display_text);
    const textBody = displayText || safeText(raw.text);
    if (!textBody.trim()) return null;
    return {
      seq: Number(raw.seq || 0),
      ts: safeText(raw.ts),
      role: normalizedRole,
      kind: safeText(raw.kind),
      text: textBody,
      displayText: displayText || safeText(raw.text),
      displayFormat: safeText(raw.displayFormat || raw.display_format),
      attempt: Number(raw.attempt || 1),
      correlation:
        raw.correlation && typeof raw.correlation === "object"
          ? raw.correlation
          : {},
    };
  }

  function chatEventKey(event) {
    const correlation =
      event && event.correlation && typeof event.correlation === "object"
        ? event.correlation
        : {};
    return `chat:${Number(event.seq || 0)}:${safeText(event.role)}:${safeText(event.kind)}:${safeText(event.text)}:${Number(event.attempt || 1)}:${safeText(correlation.message_id)}:${safeText(correlation.replaces_message_id)}`;
  }

  function renderChatEmpty() {
    const l = labels();
    chatEl.textContent = "";
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = safeText(l.chatEmpty) || "No chat events yet.";
    chatEl.appendChild(empty);
  }

  function resetConversationRenderState() {
    state.renderedChatOrder = [];
    state.renderedChatKeys.clear();
    state.chatModel = null;
    ensureChatModel();
    chatEl.textContent = "";
  }

  function appendRenderedMarkdown(container, textValue) {
    container.innerHTML = renderMarkdown(textValue);
  }

  function renderMessageEntry(entry, mode) {
    const event = entry.event && typeof entry.event === "object" ? entry.event : {};
    const role = safeText(event.role).trim() || "assistant";
    const messageText = safeText(event.text).trim();
    if (!messageText) return null;
    if (mode === "plain") {
      const row = document.createElement("div");
      row.className = "chat-plain-entry " + chatRoleClass(role);
      const roleEl = document.createElement("span");
      roleEl.className = "chat-plain-role";
      roleEl.textContent = chatRoleText(role);
      const body = document.createElement("div");
      body.className = "chat-plain-body";
      body.innerHTML = renderMarkdown(messageText);
      row.appendChild(roleEl);
      row.appendChild(body);
      return row;
    }
    const row = document.createElement("div");
    row.className = "chat-row " + chatRoleClass(role);
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble " + chatRoleClass(role);
    const roleEl = document.createElement("span");
    roleEl.className = "chat-role";
    roleEl.textContent = chatRoleText(role);
    const body = document.createElement("div");
    body.className = "chat-bubble-body";
    body.innerHTML = renderMarkdown(messageText);
    bubble.appendChild(roleEl);
    bubble.appendChild(body);
    row.appendChild(bubble);
    return row;
  }

  function renderThinkingEntry(entry, mode) {
    const items = Array.isArray(entry.items) ? entry.items : [];
    if (!items.length) return null;
    const latest = items[items.length - 1];
    const toggle = function () {
      state.chatModel.toggleThinking(entry.id);
      renderChatModel({ preserveScroll: true });
    };
    if (mode === "plain") {
      const row = document.createElement("div");
      row.className = "chat-plain-process";
      const header = document.createElement("div");
      header.className = "chat-plain-process-header";
      header.setAttribute("role", "button");
      header.setAttribute("tabindex", "0");
      const title = document.createElement("span");
      title.className = "chat-plain-role";
      title.textContent = safeText(labels().roleThinking) || "Thinking";
      const arrow = document.createElement("span");
      arrow.className = "thinking-arrow";
      arrow.textContent = entry.collapsed ? "◀" : "▼";
      header.appendChild(title);
      header.appendChild(arrow);
      header.addEventListener("click", toggle);
      header.addEventListener("keydown", function (evt) {
        if (evt.key === "Enter" || evt.key === " ") {
          evt.preventDefault();
          toggle();
        }
      });
      row.appendChild(header);
      if (entry.collapsed) {
        const latestLine = document.createElement("div");
        latestLine.className = "chat-plain-process-latest";
        latestLine.textContent = `${processTypeLabel(latest.processType)}: ${safeText(latest.text || latest.summary)}`;
        row.appendChild(latestLine);
      } else {
        const list = document.createElement("div");
        list.className = "chat-plain-process-list";
        items.forEach(function (item) {
          const itemEl = document.createElement("div");
          itemEl.className = "chat-plain-process-item";
          const meta = document.createElement("div");
          meta.className = "thinking-item-meta";
          meta.textContent = processTypeLabel(item.processType);
          const txt = document.createElement("div");
          txt.className = "thinking-item-text";
          appendRenderedMarkdown(txt, safeText(item.text || item.summary));
          itemEl.appendChild(meta);
          itemEl.appendChild(txt);
          list.appendChild(itemEl);
        });
        row.appendChild(list);
      }
      return row;
    }

    const row = document.createElement("div");
    row.className = "chat-row agent";
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble agent thinking-bubble";
    bubble.setAttribute("role", "button");
    bubble.setAttribute("tabindex", "0");
    const roleEl = document.createElement("span");
    roleEl.className = "chat-role";
    roleEl.textContent = safeText(labels().roleThinking) || "Thinking";
    bubble.appendChild(roleEl);
    const header = document.createElement("div");
    header.className = "thinking-header";
    const title = document.createElement("span");
    title.className = "thinking-header-title";
    title.textContent = processTypeLabel(latest.processType);
    const arrow = document.createElement("span");
    arrow.className = "thinking-arrow";
    arrow.textContent = entry.collapsed ? "◀" : "▼";
    header.appendChild(title);
    header.appendChild(arrow);
    bubble.appendChild(header);
    bubble.addEventListener("click", toggle);
    bubble.addEventListener("keydown", function (evt) {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        toggle();
      }
    });
    if (entry.collapsed) {
      const latestLine = document.createElement("div");
      latestLine.className = "thinking-latest";
      latestLine.textContent = `${processTypeLabel(latest.processType)}: ${safeText(latest.text || latest.summary)}`;
      bubble.appendChild(latestLine);
    } else {
      const list = document.createElement("div");
      list.className = "thinking-list";
      items.forEach(function (item) {
        const itemEl = document.createElement("div");
        itemEl.className = "thinking-item";
        const meta = document.createElement("div");
        meta.className = "thinking-item-meta";
        meta.textContent = processTypeLabel(item.processType);
        const txt = document.createElement("div");
        txt.className = "thinking-item-text";
        appendRenderedMarkdown(txt, safeText(item.text || item.summary));
        itemEl.appendChild(meta);
        itemEl.appendChild(txt);
        list.appendChild(itemEl);
      });
      bubble.appendChild(list);
    }
    row.appendChild(bubble);
    return row;
  }

  function renderChatModel(options) {
    const opts = options || {};
    const shouldStick = opts.forceScroll === true || (opts.preserveScroll !== true && nearBottom(chatEl));
    const oldTop = chatEl.scrollTop;
    const oldHeight = chatEl.scrollHeight;
    chatEl.textContent = "";
    if (!state.chatModel) return;

    const mode = typeof state.chatModel.getDisplayMode === "function"
      ? state.chatModel.getDisplayMode()
      : state.chatDisplayMode;
    setChatDisplayMode(mode);

    const entries = state.chatModel.getEntries();
    entries.forEach(function (entry) {
      if (!entry || typeof entry !== "object") return;
      if (entry.type === "message") {
        const node = renderMessageEntry(entry, mode);
        if (node) {
          chatEl.appendChild(node);
        }
        return;
      }
      if (entry.type !== "thinking") return;
      const node = renderThinkingEntry(entry, mode);
      if (node) {
        chatEl.appendChild(node);
      }
    });

    if (shouldStick) {
      chatEl.scrollTop = chatEl.scrollHeight;
    } else if (opts.preserveScroll === true) {
      chatEl.scrollTop = Math.max(0, oldTop + (chatEl.scrollHeight - oldHeight));
    }
  }

  function appendChatBubble(event, key, options) {
    const opts = options || {};
    if (!event || !event.text.trim()) return;
    if (key && state.renderedChatKeys.has(key)) return;
    if (key) state.renderedChatKeys.add(key);

    if (state.chatModel) {
      state.chatModel.consume(event);
      if (!opts.deferRender) {
        renderChatModel(opts.renderOptions);
      }
      return;
    }

    if (chatEl.childElementCount === 1 && chatEl.firstElementChild?.classList.contains("muted")) {
      chatEl.textContent = "";
    }
    const node = renderMessageEntry({ event }, state.chatDisplayMode);
    if (node) {
      chatEl.appendChild(node);
    }
    if (opts.deferScroll !== true) {
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  }

  function syncChat() {
    const rawMessages = state.snapshot && Array.isArray(state.snapshot.messages) ? state.snapshot.messages : [];
    const messages = rawMessages.map(toChatEvent).filter(Boolean);
    if (!messages.length) {
      if (state.renderedChatOrder.length !== 0 || chatEl.childElementCount === 0) {
        resetConversationRenderState();
        renderChatEmpty();
      }
      return;
    }

    ensureChatModel();
    const keys = messages.map(chatEventKey);
    const old = state.renderedChatOrder;
    let isPrefix = old.length <= keys.length;
    for (let i = 0; isPrefix && i < old.length; i += 1) {
      if (old[i] !== keys[i]) isPrefix = false;
    }
    if (isPrefix && old.length === keys.length) {
      return;
    }

    const appendOnly = isPrefix && old.length > 0;
    if (!appendOnly) {
      resetConversationRenderState();
    }
    const start = appendOnly ? old.length : 0;
    for (let i = start; i < messages.length; i += 1) {
      appendChatBubble(messages[i], keys[i], {
        deferRender: true,
        deferScroll: true,
      });
    }

    if (state.chatModel) {
      renderChatModel({ forceScroll: true });
    } else {
      chatEl.scrollTop = chatEl.scrollHeight;
    }
    state.renderedChatOrder = keys;
    state.renderedChatKeys = new Set(keys);
  }

  function promptView(snapshot) {
    const askUser = snapshot && snapshot.pendingAskUser && typeof snapshot.pendingAskUser === "object"
      ? snapshot.pendingAskUser
      : null;
    const uiHints = snapshot && snapshot.pendingUiHints && typeof snapshot.pendingUiHints === "object"
      ? snapshot.pendingUiHints
      : (askUser && askUser.ui_hints && typeof askUser.ui_hints === "object" ? askUser.ui_hints : {});
    const prompt = safeText(uiHints.prompt).trim()
      || safeText((askUser && askUser.prompt) || snapshot.pendingPrompt).trim()
      || DEFAULT_INTERACTION_PROMPT;
    const kind = safeText((askUser && askUser.kind) || snapshot.pendingKind).trim().toLowerCase() || "open_text";
    const optionsRaw = askUser && Array.isArray(askUser.options) ? askUser.options : snapshot.pendingOptions;
    const askHint = askUser
      ? (
          safeText(askUser.hint).trim()
          || (
            askUser.ui_hints && typeof askUser.ui_hints === "object"
              ? safeText(askUser.ui_hints.hint).trim()
              : ""
          )
        )
      : "";
    const directHint = safeText(uiHints.hint).trim();
    return {
      interactionId: Number(snapshot.pendingInteractionId || 0),
      prompt,
      kind,
      options: resolvePromptOptions(kind, optionsRaw),
      requiredFields: toArray(snapshot.pendingRequiredFields),
      hint: askHint || directHint,
      files: uploadSpecs(uiHints.files),
    };
  }

  function authView(snapshot) {
    const askUser = snapshot && snapshot.authAskUser && typeof snapshot.authAskUser === "object"
      ? snapshot.authAskUser
      : null;
    const askOptions = choiceOptions(askUser && askUser.options);
    const methods = toArray(snapshot.authAvailableMethods);
    const selectionOptions = askOptions.length
      ? askOptions
      : methods.map(function (method) { return { label: method, value: method }; });
    const askHint = askUser
      ? (
          safeText(askUser.hint).trim()
          || (
            askUser.ui_hints && typeof askUser.ui_hints === "object"
              ? safeText(askUser.ui_hints.hint).trim()
              : ""
          )
        )
      : "";
    const directHint = snapshot && snapshot.authUiHints && typeof snapshot.authUiHints === "object"
      ? safeText(snapshot.authUiHints.hint).trim()
      : "";
    return {
      phase: safeText(snapshot.authPhase).trim() || "challenge_active",
      authSessionId: safeText(snapshot.authSessionId).trim(),
      providerId: safeText(snapshot.authProviderId).trim(),
      engine: safeText(snapshot.authEngine).trim(),
      challengeKind: safeText(snapshot.authChallengeKind).trim(),
      acceptsChatInput: snapshot.authAcceptsChatInput === true,
      inputKind: safeText(snapshot.authInputKind).trim(),
      authUrl: safeText(snapshot.authUrl).trim(),
      userCode: safeText(snapshot.authUserCode).trim(),
      lastError: safeText(snapshot.authLastError).trim(),
      prompt: safeText((askUser && askUser.prompt) || snapshot.authPrompt).trim(),
      hint: askHint || directHint,
      askUser,
      selectionOptions,
    };
  }

  function renderPromptCard() {
    const l = labels();
    const p = promptView(state.snapshot || {});
    const signature = JSON.stringify({
      interaction_id: p.interactionId,
      kind: p.kind,
      prompt: p.prompt,
      options: p.options,
      required_fields: p.requiredFields,
      hint: p.hint,
      files: p.files,
    });
    if (signature && signature === state.promptSig && !promptCardEl.classList.contains("hidden")) return;
    state.promptSig = signature;
    clearAuthCard();
    promptCardEl.classList.remove("hidden");
    promptTitleEl.textContent = safeText(l.pendingInputTitle) || "Pending Input Request";
    promptMetaIdLabelEl.textContent = safeText(l.interactionIdLabel) || "interaction_id:";
    promptMetaKindLabelEl.textContent = safeText(l.kindLabel) || "kind:";
    promptTextEl.textContent = p.prompt;
    promptIdEl.textContent = p.interactionId > 0 ? String(p.interactionId) : "-";
    promptKindEl.textContent = p.kind;
    interactionIdEl.value = p.interactionId > 0 ? String(p.interactionId) : "";
    pendingIdEl.textContent = p.interactionId > 0 ? String(p.interactionId) : "-";
    if (p.hint) {
      promptHintEl.textContent = p.hint;
      promptHintEl.classList.remove("hidden");
    } else {
      promptHintEl.textContent = "";
      promptHintEl.classList.add("hidden");
    }
    if (p.files.length) {
      promptFilesEl.textContent = "";
      p.files.forEach(function (item) {
        const row = document.createElement("div");
        const requirement = item.required
          ? (safeText(l.authImportRequired) || "Required")
          : (safeText(l.authImportOptional) || "Optional");
        row.textContent = item.hint
          ? `${item.name} (${requirement}) - ${item.hint}`
          : `${item.name} (${requirement})`;
        promptFilesEl.appendChild(row);
      });
      promptFilesEl.classList.remove("hidden");
    } else {
      promptFilesEl.textContent = "";
      promptFilesEl.classList.add("hidden");
    }
    if (p.requiredFields.length) {
      promptRequiredEl.textContent = `${safeText(l.requiredFieldsPrefix) || "Required:"} ${p.requiredFields.join(", ")}`;
      promptRequiredEl.classList.remove("hidden");
    } else {
      promptRequiredEl.textContent = "";
      promptRequiredEl.classList.add("hidden");
    }
    if (p.options.length) {
      renderActionButtons(promptActionsEl, p.options.map(function (opt) {
        return {
          label: opt.label,
          onClick: function () {
            sendAction("reply-run", {
              requestId: state.snapshot.requestId,
              mode: "interaction",
              interactionId: p.interactionId,
              responseValue: opt.value,
            });
            setReplyEnabled(false);
          },
        };
      }));
      setReplyComposerVisible(false);
      setReplyEnabled(false);
    } else {
      promptActionsEl.classList.add("hidden");
      promptActionsEl.textContent = "";
      replyTextEl.placeholder = p.hint || safeText(l.replyPlaceholder) || "Reply to agent...";
      setReplyComposerVisible(true);
      setReplyEnabled(p.interactionId > 0);
    }
  }

  function renderAuthImportPanel(a) {
    const l = labels();
    const askUser = a.askUser;
    if (!askUser || safeText(askUser.kind).trim() !== "upload_files") return false;
    const files = uploadSpecs(askUser.files);
    if (!files.length) return false;
    authImportPanelEl.classList.remove("hidden");
    authImportHintEl.textContent = a.hint || safeText(askUser.hint).trim() || safeText(l.authImportHintDefault) || "Upload auth files.";
    const uiHints = askUser.ui_hints && typeof askUser.ui_hints === "object" ? askUser.ui_hints : {};
    if (uiHints.risk_notice_required === true) {
      authImportRiskEl.textContent = safeText(l.authImportRiskNotice) || "Review files before import.";
      authImportRiskEl.classList.remove("hidden");
    } else {
      authImportRiskEl.textContent = "";
      authImportRiskEl.classList.add("hidden");
    }
    authImportFilesEl.textContent = "";
    files.forEach(function (item) {
      const row = document.createElement("div");
      row.className = "auth-import-file-item";
      const label = document.createElement("label");
      label.textContent = `${item.name} (${item.required ? (safeText(l.authImportRequired) || "Required") : (safeText(l.authImportOptional) || "Optional")})`;
      const input = document.createElement("input");
      input.type = "file";
      if (item.accept) input.accept = item.accept;
      input.setAttribute("data-import-filename", item.name);
      input.required = item.required;
      const hint = document.createElement("small");
      hint.textContent = item.hint || "";
      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(hint);
      authImportFilesEl.appendChild(row);
    });
    authImportSubmitEl.textContent = safeText(l.authImportSubmit) || "Import and Continue";
    authImportSubmitEl.disabled = false;
    return true;
  }

  function renderAuthCard() {
    const l = labels();
    const a = authView(state.snapshot || {});
    const signature = JSON.stringify({
      phase: a.phase,
      auth_session_id: a.authSessionId,
      prompt: a.prompt,
      available_methods: a.selectionOptions.map(function (x) { return text(x.value); }),
      challenge_kind: a.challengeKind,
      accepts_chat_input: a.acceptsChatInput,
      input_kind: a.inputKind,
      auth_url: a.authUrl,
      user_code: a.userCode,
      last_error: a.lastError,
    });
    if (signature && signature === state.authSig && !authCardEl.classList.contains("hidden")) return;
    state.authSig = signature;
    clearPromptCard();
    clearAuthImportPanel();
    authCardEl.classList.remove("hidden");
    authTitleEl.textContent = safeText(l.waitingAuthTitle) || "Authentication Required";
    authMetaSessionLabelEl.textContent = safeText(l.authSessionIdLabel) || "auth_session_id:";
    authMetaEngineLabelEl.textContent = safeText(l.authEngineLabel) || "engine:";
    authMetaProviderLabelEl.textContent = safeText(l.authProviderLabel) || "provider:";
    authTextEl.textContent = a.prompt || safeText(l.authRequiredPrompt) || "Authentication required.";
    authIdEl.textContent = a.authSessionId || "-";
    authEngineEl.textContent = a.engine || "-";
    authProviderEl.textContent = a.providerId || "-";
    authSessionIdEl.value = a.authSessionId || "";
    authInputKindEl.value = a.inputKind || "";
    if (a.hint) {
      authHintEl.textContent = a.hint;
      authHintEl.classList.remove("hidden");
    } else {
      authHintEl.textContent = "";
      authHintEl.classList.add("hidden");
    }
    const isMethodSelection = a.phase === "method_selection";
    const isImportChallenge = a.inputKind === "import_files" || a.challengeKind === "import_files" || (a.askUser && safeText(a.askUser.kind).trim() === "upload_files");
    authReplyModeEl.value = isMethodSelection ? "selection" : "submission";
    if (isMethodSelection && a.selectionOptions.length) {
      renderActionButtons(authActionsEl, a.selectionOptions.map(function (opt) {
        return {
          label: opt.label,
          onClick: function () {
            sendAction("reply-run", {
              requestId: state.snapshot.requestId,
              mode: "auth",
              selection: {
                kind: "auth_method",
                value: opt.value,
              },
            });
            setReplyEnabled(false);
          },
        };
      }));
      setReplyComposerVisible(false);
      setReplyEnabled(false);
      pendingIdEl.textContent = safeText(l.pendingMethodSelection) || "method-selection";
    } else {
      authActionsEl.classList.add("hidden");
      authActionsEl.textContent = "";
      pendingIdEl.textContent = a.authSessionId || "-";
    }
    if (a.authUrl) {
      authLinkEl.innerHTML = "";
      const prefix = document.createElement("span");
      prefix.textContent = `${safeText(l.authUrlPrefix) || "auth_url:"} `;
      const anchor = document.createElement("a");
      anchor.href = a.authUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = a.authUrl;
      authLinkEl.appendChild(prefix);
      authLinkEl.appendChild(anchor);
      authLinkEl.classList.remove("hidden");
    } else {
      authLinkEl.textContent = "";
      authLinkEl.classList.add("hidden");
    }
    if (a.userCode) {
      authCodeEl.textContent = `${safeText(l.userCodePrefix) || "user_code:"} ${a.userCode}`;
      authCodeEl.classList.remove("hidden");
    } else {
      authCodeEl.textContent = "";
      authCodeEl.classList.add("hidden");
    }
    if (a.lastError) {
      authErrorEl.textContent = `${safeText(l.lastErrorPrefix) || "last_error:"} ${a.lastError}`;
      authErrorEl.classList.remove("hidden");
    } else {
      authErrorEl.textContent = "";
      authErrorEl.classList.add("hidden");
    }
    if (isMethodSelection) {
      setReplyComposerVisible(false);
      setReplyEnabled(false);
      return;
    }
    if (isImportChallenge) {
      const rendered = renderAuthImportPanel(a);
      setReplyComposerVisible(false);
      setReplyEnabled(false);
      if (!rendered) {
        showReplyError(safeText(l.authImportUnsupported) || "unsupported import target");
      }
      return;
    }
    if (a.acceptsChatInput && a.inputKind) {
      const isApiKey = a.inputKind === "api_key";
      replyTextEl.placeholder = a.hint || (isApiKey ? (safeText(l.authPasteApiKey) || "Paste API key") : (safeText(l.authPasteCode) || "Paste authorization code"));
      replySubmitEl.textContent = isApiKey ? (safeText(l.authSubmitApiKey) || "Submit API Key") : (safeText(l.authSubmitCode) || "Submit Code");
      setReplyComposerVisible(true);
      setReplyEnabled(true);
      return;
    }
    replyTextEl.placeholder = safeText(l.authInProgress) || "Awaiting auth state update...";
    replySubmitEl.textContent = safeText(l.authAwaiting) || "Awaiting";
    setReplyComposerVisible(false);
    setReplyEnabled(false);
  }

  function renderWorkspaceTask(task, isSelected, isCompact) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `task-tab${isCompact ? " compact" : ""}${isSelected ? " active" : ""}`;
    button.disabled = task.selectable !== true;
    button.title = task.selectable === true
      ? ""
      : (safeText(workspaceLabels().waitingRequestId) || "Waiting for requestId");
    const title = document.createElement("div");
    title.className = "task-tab-title";
    title.textContent = safeText(task.title) || safeText(workspaceLabels().waitingRequestId) || "Waiting for requestId";
    const workflow = document.createElement("div");
    workflow.className = "task-tab-workflow";
    workflow.textContent = safeText(task.workflowLabel).trim() || "-";
    const meta = document.createElement("div");
    meta.className = "task-tab-meta";
    const status = document.createElement("span");
    status.textContent = safeText(task.stateLabel) || safeText(task.status) || "-";
    const time = document.createElement("span");
    time.textContent = safeText(task.updatedAt) || "-";
    meta.appendChild(status);
    meta.appendChild(time);
    button.appendChild(title);
    button.appendChild(workflow);
    button.appendChild(meta);
    if (task.selectable === true && safeText(task.key)) {
      button.addEventListener("click", function () {
        sendAction("select-task", {
          taskKey: task.key,
        });
      });
    }
    return button;
  }

  function renderWorkspace() {
    const workspace = state.workspace && typeof state.workspace === "object"
      ? state.workspace
      : { selectedTaskKey: "", groups: [] };
    const groups = Array.isArray(workspace.groups) ? workspace.groups : [];
    const selectedTaskKey = safeText(workspace.selectedTaskKey).trim();
    workspaceGroupsEl.textContent = "";
    const showEmpty = groups.length === 0;
    workspaceEmptyEl.textContent = safeText(workspaceLabels().emptyTasks) || "No SkillRunner tasks.";
    workspaceEmptyEl.classList.toggle("hidden", !showEmpty);
    if (showEmpty) {
      return;
    }
    groups.forEach(function (group) {
      if (!group || typeof group !== "object") return;
      const groupBox = document.createElement("section");
      groupBox.className = "workspace-group";
      if (group.disabled === true) {
        groupBox.classList.add("is-disabled");
      }
      const groupHeader = document.createElement("button");
      groupHeader.type = "button";
      groupHeader.className = "workspace-group-header";
      groupHeader.disabled = group.disabled === true;
      groupHeader.textContent =
        safeText(group.backendDisplayName) || safeText(group.backendId) || "-";
      if (group.disabled === true) {
        const disabledTag = document.createElement("span");
        disabledTag.className = "workspace-group-disabled-tag";
        disabledTag.textContent =
          safeText(workspaceLabels().backendUnavailable) || "Unavailable";
        groupHeader.appendChild(disabledTag);
      } else {
        groupHeader.addEventListener("click", function () {
          sendAction("toggle-group-collapse", {
            backendId: safeText(group.backendId),
          });
        });
      }
      groupBox.appendChild(groupHeader);

      const groupBody = document.createElement("div");
      groupBody.className = "workspace-group-body";
      if (group.collapsed === true) {
        groupBody.classList.add("hidden");
      }
      if (group.disabled === true) {
        const disabledHint = document.createElement("div");
        disabledHint.className = "workspace-group-disabled-hint";
        disabledHint.textContent =
          safeText(group.disabledReason) ||
          safeText(workspaceLabels().backendUnavailable) ||
          "Backend unavailable";
        groupBody.appendChild(disabledHint);
      }

      const activeTasks = Array.isArray(group.activeTasks) ? group.activeTasks : [];
      activeTasks.forEach(function (task) {
        groupBody.appendChild(
          renderWorkspaceTask(task, safeText(task.key) === selectedTaskKey, false),
        );
      });

      const finishedTasks = Array.isArray(group.finishedTasks) ? group.finishedTasks : [];
      if (finishedTasks.length > 0) {
        const finishedBox = document.createElement("section");
        finishedBox.className = "workspace-finished";
        const finishedHeader = document.createElement("button");
        finishedHeader.type = "button";
        finishedHeader.className = "workspace-finished-header";
        finishedHeader.textContent = safeText(workspaceLabels().completedTasksTitle) || "Completed Tasks";
        finishedHeader.addEventListener("click", function () {
          sendAction("toggle-finished-collapse", {
            backendId: safeText(group.backendId),
          });
        });
        const finishedBody = document.createElement("div");
        finishedBody.className = "workspace-finished-body";
        if (group.finishedCollapsed !== false) {
          finishedBody.classList.add("hidden");
        }
        finishedTasks.forEach(function (task) {
          finishedBody.appendChild(
            renderWorkspaceTask(task, safeText(task.key) === selectedTaskKey, true),
          );
        });
        finishedBox.appendChild(finishedHeader);
        finishedBox.appendChild(finishedBody);
        groupBody.appendChild(finishedBox);
      }

      groupBox.appendChild(groupBody);
      workspaceGroupsEl.appendChild(groupBox);
    });
  }

  function applySnapshot(snapshot) {
    const envelope = snapshot && typeof snapshot === "object" ? snapshot : null;
    state.workspace = envelope && envelope.workspace && typeof envelope.workspace === "object"
      ? envelope.workspace
      : null;
    state.workspaceLabels = envelope && envelope.labels && typeof envelope.labels === "object"
      ? envelope.labels
      : null;
    state.snapshot = envelope && envelope.session && typeof envelope.session === "object"
      ? envelope.session
      : null;
    renderWorkspace();
    if (!state.snapshot) {
      document.title = "Run Details";
      titleEl.textContent = "Run Details";
      subtitleEl.textContent = "";
      statusEl.textContent = "-";
      runEngineEl.textContent = "-";
      runModelEl.textContent = "-";
      pendingIdEl.textContent = "-";
      updatedAtEl.textContent = "-";
      pendingOwnerEl.textContent = "-";
      cancelBtnEl.disabled = true;
      clearPromptCard();
      clearAuthCard();
      clearFinalSummary();
      renderChatEmpty();
      return;
    }
    const semantics = resolveStatusSemantics(state.snapshot);
    const l = labels();
    document.title = safeText(state.snapshot.title) || "Run Details";
    titleEl.textContent = safeText(state.snapshot.title) || "Run Details";
    subtitleEl.textContent = safeText(state.snapshot.backendTitle);
    cancelBtnEl.textContent = safeText(l.cancel) || "Cancel Run";
    cancelBtnEl.disabled = isTerminal(state.snapshot.status, semantics);
    metaStatusLabelEl.textContent = safeText(l.status) || "Status";
    metaEngineLabelEl.textContent = safeText(l.engine) || "Engine";
    metaModelLabelEl.textContent = safeText(l.model) || "Model";
    metaPendingIdLabelEl.textContent = safeText(l.pendingInteractionId) || "Pending Interaction ID";
    metaUpdatedAtLabelEl.textContent = safeText(l.updatedAt) || "Updated At";
    metaPendingOwnerLabelEl.textContent = safeText(l.pendingOwner) || "Pending Owner";
    setStatusBadge(semantics.normalized);
    runEngineEl.textContent = safeText(state.snapshot.engine) || "-";
    runModelEl.textContent = safeText(state.snapshot.model) || "-";
    pendingIdEl.textContent = state.snapshot.pendingInteractionId != null
      ? text(state.snapshot.pendingInteractionId)
      : (safeText(state.snapshot.authSessionId) || "-");
    updatedAtEl.textContent = safeText(state.snapshot.updatedAt) || "-";
    pendingOwnerEl.textContent = safeText(state.snapshot.pendingOwner) || "-";
    replyShortcutHintEl.textContent = safeText(l.replyShortcut) || "Ctrl+Enter / Cmd+Enter to send";
    clearFinalSummary();
    syncChat();
    updateThinkingCard(semantics.normalized);
    if (semantics.terminal) {
      renderFinalSummary(semantics.normalized);
    }
    if (semantics.waiting && semantics.normalized === "waiting_user") {
      renderPromptCard();
      return;
    }
    if (semantics.waiting && semantics.normalized === "waiting_auth") {
      renderAuthCard();
      return;
    }
    clearPromptCard();
    clearAuthCard();
    setReplyEnabled(false);
  }

  function submitReply() {
    clearReplyError();
    if (!state.snapshot) return;
    const textValue = safeText(replyTextEl.value).trim();
    const semantics = resolveStatusSemantics(state.snapshot);
    if (semantics.waiting && semantics.normalized === "waiting_auth") {
      if (safeText(authReplyModeEl.value).trim() === "selection") return;
      const authSessionId = safeText(authSessionIdEl.value).trim();
      if (!authSessionId || !textValue) return;
      sendAction("reply-run", {
        requestId: state.snapshot.requestId,
        mode: "auth",
        authSessionId,
        submission: {
          kind: safeText(authInputKindEl.value).trim() || "auth_code_or_url",
          value: textValue,
        },
      });
      replyTextEl.value = "";
      setReplyEnabled(false, { textEnabled: true });
      return;
    }
    const interactionId = Number(interactionIdEl.value || "0");
    if (!interactionId || !textValue) return;
    sendAction("reply-run", {
      requestId: state.snapshot.requestId,
      mode: "interaction",
      interactionId,
      responseObject: { text: textValue },
    });
    replyTextEl.value = "";
    setReplyEnabled(false, { textEnabled: true });
  }

  function submitAuthImport() {
    if (!state.snapshot || authImportPanelEl.classList.contains("hidden")) return;
    const jobs = [];
    const inputs = authImportPanelEl.querySelectorAll("input[data-import-filename]");
    inputs.forEach(function (node) {
      const input = node;
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      jobs.push(new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () {
          const raw = text(reader.result);
          const mark = "base64,";
          const idx = raw.indexOf(mark);
          if (idx < 0) {
            reject(new Error("base64 conversion failed"));
            return;
          }
          resolve({
            name: file.name,
            contentBase64: raw.slice(idx + mark.length),
          });
        };
        reader.onerror = function () { reject(new Error("file read failed")); };
        reader.readAsDataURL(file);
      }));
    });
    if (!jobs.length) return;
    authImportSubmitEl.disabled = true;
    Promise.all(jobs)
      .then(function (files) {
        sendAction("auth-import-run", {
          requestId: state.snapshot.requestId,
          providerId: state.snapshot.authProviderId,
          files,
        });
      })
      .catch(function () {
        authImportSubmitEl.disabled = false;
      });
  }

  cancelBtnEl.addEventListener("click", function () {
    if (!state.snapshot) return;
    sendAction("cancel-run", { requestId: state.snapshot.requestId });
  });
  replyFormEl.addEventListener("submit", function (evt) {
    evt.preventDefault();
    submitReply();
  });
  replyTextEl.addEventListener("keydown", function (evt) {
    if (!((evt.ctrlKey || evt.metaKey) && evt.key === "Enter")) return;
    evt.preventDefault();
    if (replySubmitEl.disabled) return;
    submitReply();
  });
  authImportSubmitEl.addEventListener("click", submitAuthImport);
  if (chatModePlainEl) {
    chatModePlainEl.addEventListener("click", function () {
      setChatDisplayMode("plain");
      renderChatModel({ preserveScroll: true });
    });
  }
  if (chatModeBubbleEl) {
    chatModeBubbleEl.addEventListener("click", function () {
      setChatDisplayMode("bubble");
      renderChatModel({ preserveScroll: true });
    });
  }

  window.addEventListener("message", function (event) {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "run-dialog:init" || data.type === "run-dialog:snapshot") {
      applySnapshot(data.payload || null);
    }
  });

  setReplyEnabled(false);
  setReplyComposerVisible(true);
  setChatDisplayMode("plain");
  sendAction("ready", {});
})();
