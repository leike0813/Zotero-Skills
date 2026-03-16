(() => {
  "use strict";

  function safeText(value) {
    return typeof value === "string" ? value : "";
  }

  function normalizeText(value) {
    return safeText(value).replace(/\s+/g, " ").trim();
  }

  function toPositiveInt(value, fallback = 1) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return fallback;
    return Math.floor(num);
  }

  function correlationOf(event) {
    const correlation = event && event.correlation;
    return correlation && typeof correlation === "object" ? correlation : {};
  }

  function processTypeOf(event) {
    const correlation = correlationOf(event);
    const fromCorrelation = normalizeText(correlation.process_type);
    if (fromCorrelation) return fromCorrelation;
    const kind = normalizeText(event && event.kind);
    if (kind === "assistant_process") {
      const classification = normalizeText(correlation.classification);
      return classification || "reasoning";
    }
    return "reasoning";
  }

  function createThinkingChatModel() {
    const entries = [];
    const thinkingById = new Map();
    let activeThinkingId = null;
    let nextThinkingId = 1;

    function createThinkingEntry(attempt) {
      const id = `thinking-${nextThinkingId}`;
      nextThinkingId += 1;
      const entry = {
        type: "thinking",
        id,
        attempt,
        collapsed: true,
        items: [],
      };
      entries.push(entry);
      thinkingById.set(id, entry);
      activeThinkingId = id;
      return entry;
    }

    function removeThinkingEntry(entry) {
      const idx = entries.indexOf(entry);
      if (idx >= 0) {
        entries.splice(idx, 1);
      }
      if (activeThinkingId === entry.id) {
        activeThinkingId = null;
      }
      thinkingById.delete(entry.id);
    }

    function toProcessItem(event) {
      const correlation = correlationOf(event);
      const text = normalizeText(event && event.text);
      const summary = normalizeText(correlation.summary) || text;
      return {
        seq: toPositiveInt(event && event.seq, 0),
        attempt: toPositiveInt(event && event.attempt, 1),
        processType: processTypeOf(event),
        text: text || summary,
        summary: summary || text,
        messageId: normalizeText(correlation.message_id) || null,
        normalizedText: normalizeText(text || summary),
        details:
          correlation.details && typeof correlation.details === "object"
            ? correlation.details
            : null,
        rawRef:
          correlation.raw_ref && typeof correlation.raw_ref === "object"
            ? correlation.raw_ref
            : null,
        sourceEvent: event,
      };
    }

    function appendProcess(event) {
      const attempt = toPositiveInt(event && event.attempt, 1);
      let entry = activeThinkingId ? thinkingById.get(activeThinkingId) || null : null;
      if (!entry || entry.attempt !== attempt) {
        entry = createThinkingEntry(attempt);
      }
      entry.items.push(toProcessItem(event));
    }

    function dedupeThinkingByFinal(event) {
      const attempt = toPositiveInt(event && event.attempt, 1);
      const correlation = correlationOf(event);
      const finalMessageId = normalizeText(correlation.message_id);
      const normalizedFinalText = normalizeText(event && event.text);

      for (const entry of [...entries]) {
        if (entry.type !== "thinking") continue;
        if (entry.attempt !== attempt) continue;
        entry.items = entry.items.filter((item) => {
          if (finalMessageId && item.messageId) {
            return item.messageId !== finalMessageId;
          }
          if (!finalMessageId && normalizedFinalText) {
            return item.normalizedText !== normalizedFinalText;
          }
          return true;
        });
        if (!entry.items.length) {
          removeThinkingEntry(entry);
        }
      }
    }

    function appendMessage(event) {
      activeThinkingId = null;
      entries.push({
        type: "message",
        event,
      });
    }

    function isAssistantProcess(event) {
      return (
        normalizeText(event && event.role) === "assistant" &&
        normalizeText(event && event.kind) === "assistant_process"
      );
    }

    function isAssistantFinal(event) {
      return (
        normalizeText(event && event.role) === "assistant" &&
        normalizeText(event && event.kind) === "assistant_final"
      );
    }

    function consume(event) {
      if (!event || typeof event !== "object") return false;
      if (isAssistantProcess(event)) {
        appendProcess(event);
        return true;
      }
      if (isAssistantFinal(event)) {
        dedupeThinkingByFinal(event);
        appendMessage(event);
        return true;
      }
      appendMessage(event);
      return true;
    }

    function toggleThinking(id) {
      const entry = thinkingById.get(id);
      if (!entry) return false;
      entry.collapsed = !entry.collapsed;
      return true;
    }

    function getEntries() {
      return entries;
    }

    return {
      consume,
      toggleThinking,
      getEntries,
    };
  }

  window.SkillRunnerThinkingChatCore = {
    createThinkingChatModel,
    normalizeText,
  };
})();
