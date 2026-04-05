import { createConversationNote } from "../../lib/literatureDigestNotes.mjs";

function stringifyUnknownError(error) {
  if (error instanceof Error) {
    return error.message || error.name || "unknown error";
  }
  if (!error || typeof error !== "object") {
    return String(error || "unknown error");
  }
  const record = error;
  const parts = [];
  if (record.name) {
    parts.push(`name=${String(record.name)}`);
  }
  if (record.message) {
    parts.push(`message=${String(record.message)}`);
  }
  try {
    const asText = String(error);
    if (asText && asText !== "[object Object]") {
      parts.push(`text=${asText}`);
    }
  } catch {
    // ignore
  }
  if (parts.length > 0) {
    return parts.join(", ");
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "unknown object error";
  }
}

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getNotePathFromRecord(record) {
  if (!isRecord(record)) {
    return "";
  }
  const candidates = [
    record.note_path,
    record.data?.note_path,
    record.result?.note_path,
    record.result?.data?.note_path,
    record.data?.result?.note_path,
    record.data?.result?.data?.note_path,
  ];
  for (const value of candidates) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function resolveNotePathFromRunResult(runResult) {
  const candidates = [
    runResult?.resultJson?.result?.data,
    runResult?.resultJson?.result,
    runResult?.resultJson?.data?.data,
    runResult?.resultJson?.data,
    runResult?.resultJson,
    runResult?.responseJson?.result?.data,
    runResult?.responseJson?.result,
    runResult?.responseJson?.data?.data,
    runResult?.responseJson?.data,
    runResult?.responseJson,
    runResult?.result?.data,
    runResult?.result,
    runResult?.data?.data,
    runResult?.data,
    runResult,
  ];
  for (const candidate of candidates) {
    const resolved = getNotePathFromRecord(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return "";
}

function normalizePathForCompare(targetPath) {
  const text = String(targetPath || "").trim();
  if (!text) {
    return "";
  }
  return text
    .replace(/^file:\/\/+/, "")
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/");
}

function resolveBundleEntryPath(rawPath, fallbackPath) {
  const normalizedRaw = normalizePathForCompare(rawPath);
  const normalizedFallback = normalizePathForCompare(fallbackPath);
  const candidates = [];
  const seen = new Set();

  const addCandidate = (value) => {
    const normalized = normalizePathForCompare(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  addCandidate(normalizedRaw);
  const lowered = normalizedRaw.toLowerCase();
  for (const marker of ["/uploads/", "/artifacts/", "/result/", "/bundle/"]) {
    const index = lowered.lastIndexOf(marker);
    if (index >= 0) {
      addCandidate(normalizedRaw.slice(index + 1));
    }
  }
  addCandidate(normalizedFallback);
  return candidates;
}

async function resolveNotePath(args) {
  const fromRunResult = resolveNotePathFromRunResult(args.runResult);
  if (fromRunResult) {
    return fromRunResult;
  }
  try {
    const resultJsonText = await args.bundleReader.readText("result/result.json");
    const parsed = JSON.parse(resultJsonText);
    return getNotePathFromRecord(parsed);
  } catch {
    return "";
  }
}

function formatLocalTimestamp() {
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${yy}${mm}${dd}${hh}${min}`;
}

function resolveHostApi(runtime) {
  const hostApi = runtime?.hostApi;
  if (hostApi && typeof hostApi === "object") {
    return hostApi;
  }
  throw new Error("workflow hostApi is unavailable in runtime");
}

export async function applyResult({ parent, bundleReader, runResult, runtime }) {
  let stage = "resolve-parent";
  try {
    const hostApi = resolveHostApi(runtime);
    if (!hostApi.items || typeof hostApi.items.resolve !== "function") {
      throw new Error("workflow hostApi.items.resolve is unavailable");
    }
    const parentItem = hostApi.items.resolve(parent);
    stage = "resolve-note-path";
    const notePath = await resolveNotePath({
      bundleReader,
      runResult,
    });

    if (!notePath) {
      return {
        notes: [],
        skipped: true,
        reason: "note_path is empty",
      };
    }

    const noteCandidates = resolveBundleEntryPath(
      notePath,
      "result/conversation-note.md",
    );
    if (noteCandidates.length === 0) {
      return {
        notes: [],
        skipped: true,
        reason: "note_path not found in bundle",
        note_path: notePath,
      };
    }

    stage = "read-bundle-entry";
    let markdown = "";
    let noteEntry = "";
    let lastError = null;
    for (const candidate of noteCandidates) {
      try {
        markdown = await bundleReader.readText(candidate);
        noteEntry = candidate;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!noteEntry) {
      return {
        notes: [],
        skipped: true,
        reason: "note_path not found in bundle",
        note_path: notePath,
        bundle_entry: noteCandidates[0],
        candidates: noteCandidates,
        last_error: String(
          lastError && lastError.message ? lastError.message : lastError || "unknown",
        ),
      };
    }

    stage = "create-note";
    const title = `Conversation Note ${formatLocalTimestamp()}`;
    const note = await createConversationNote({
      runtime,
      parentItem,
      title,
      markdown,
      noteEntry,
    });

    return {
      notes: [note],
      requested_note_path: notePath,
      note_path: noteEntry,
      bundle_candidates: noteCandidates,
      parent_item_id: parentItem.id,
      created_note_id: note?.id,
      title,
    };
  } catch (error) {
    throw new Error(
      `literature-explainer applyResult failed at ${stage}: ${stringifyUnknownError(error)}`,
    );
  }
}
