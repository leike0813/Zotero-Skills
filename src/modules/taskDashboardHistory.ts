import type { JobRecord } from "../jobQueue/manager";
import { PASS_THROUGH_BACKEND_TYPE } from "../config/defaults";
import { getPref, setPref } from "../utils/prefs";
import {
  buildWorkflowTaskRecordFromJob,
  type WorkflowTaskRecord,
} from "./taskRuntime";

const HISTORY_PREF_KEY = "taskDashboardHistoryJson";
const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export type TaskDashboardHistoryRecord = WorkflowTaskRecord & {
  archivedAt: string;
};

type DashboardHistoryDocument = {
  records?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isPassThroughTask(record: WorkflowTaskRecord) {
  if (record.backendType === PASS_THROUGH_BACKEND_TYPE) {
    return true;
  }
  if (record.providerId === PASS_THROUGH_BACKEND_TYPE) {
    return true;
  }
  return false;
}

function parseHistoryRecord(raw: unknown): TaskDashboardHistoryRecord | null {
  if (!isObject(raw)) {
    return null;
  }
  const id = String(raw.id || "").trim();
  const runId = String(raw.runId || "").trim();
  const jobId = String(raw.jobId || "").trim();
  const workflowId = String(raw.workflowId || "").trim();
  const workflowLabel = String(raw.workflowLabel || "").trim();
  const taskName = String(raw.taskName || "").trim();
  const state = String(raw.state || "").trim();
  const createdAt = String(raw.createdAt || "").trim();
  const updatedAt = String(raw.updatedAt || "").trim();
  const archivedAt = String(raw.archivedAt || "").trim();
  if (
    !id ||
    !runId ||
    !jobId ||
    !workflowId ||
    !workflowLabel ||
    !taskName ||
    !state ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }
  if (
    state !== "queued" &&
    state !== "running" &&
    state !== "succeeded" &&
    state !== "failed" &&
    state !== "canceled"
  ) {
    return null;
  }
  return {
    id,
    runId,
    jobId,
    workflowId,
    workflowLabel,
    taskName,
    state: state as WorkflowTaskRecord["state"],
    requestId: String(raw.requestId || "").trim() || undefined,
    inputUnitIdentity: String(raw.inputUnitIdentity || "").trim() || undefined,
    inputUnitLabel: String(raw.inputUnitLabel || "").trim() || undefined,
    providerId: String(raw.providerId || "").trim() || undefined,
    backendId: String(raw.backendId || "").trim() || undefined,
    backendType: String(raw.backendType || "").trim() || undefined,
    backendBaseUrl: String(raw.backendBaseUrl || "").trim() || undefined,
    error: String(raw.error || "").trim() || undefined,
    createdAt,
    updatedAt,
    archivedAt: archivedAt || updatedAt,
  };
}

function readHistoryRecords(): TaskDashboardHistoryRecord[] {
  const raw = String(getPref(HISTORY_PREF_KEY) || "").trim();
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as DashboardHistoryDocument | unknown[];
    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.records)
        ? parsed.records
        : [];
    const normalized: TaskDashboardHistoryRecord[] = [];
    for (const row of rows) {
      const parsedRecord = parseHistoryRecord(row);
      if (!parsedRecord) {
        continue;
      }
      normalized.push(parsedRecord);
    }
    return normalized;
  } catch {
    return [];
  }
}

function writeHistoryRecords(records: TaskDashboardHistoryRecord[]) {
  setPref(
    HISTORY_PREF_KEY,
    JSON.stringify({
      records,
    }),
  );
}

function pruneExpiredRecords(records: TaskDashboardHistoryRecord[]) {
  const threshold = Date.now() - RETENTION_MS;
  return records.filter((record) => {
    const ts = Date.parse(record.updatedAt || record.archivedAt || "");
    if (!Number.isFinite(ts)) {
      return true;
    }
    return ts >= threshold;
  });
}

export function getTaskDashboardHistoryRetentionConfig() {
  return {
    retentionDays: RETENTION_DAYS,
    retentionMs: RETENTION_MS,
  };
}

export function listTaskDashboardHistory(args?: {
  backendId?: string;
  backendType?: string;
  workflowId?: string;
  requestId?: string;
}) {
  const backendId = String(args?.backendId || "").trim();
  const backendType = String(args?.backendType || "").trim();
  const workflowId = String(args?.workflowId || "").trim();
  const requestId = String(args?.requestId || "").trim();
  return readHistoryRecords()
    .filter((record) => {
      if (backendId && record.backendId !== backendId) {
        return false;
      }
      if (backendType && record.backendType !== backendType) {
        return false;
      }
      if (workflowId && record.workflowId !== workflowId) {
        return false;
      }
      if (requestId && record.requestId !== requestId) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((record) => ({ ...record }));
}

export function cleanupTaskDashboardHistory() {
  const before = readHistoryRecords();
  const after = pruneExpiredRecords(before);
  if (after.length !== before.length) {
    writeHistoryRecords(after);
  }
  return {
    before: before.length,
    after: after.length,
  };
}

export function resetTaskDashboardHistory() {
  writeHistoryRecords([]);
}

export function recordTaskDashboardHistoryFromJob(job: JobRecord) {
  const record = buildWorkflowTaskRecordFromJob(job);
  if (isPassThroughTask(record)) {
    return null;
  }
  const current = pruneExpiredRecords(readHistoryRecords());
  const nextById = new Map<string, TaskDashboardHistoryRecord>();
  for (const row of current) {
    nextById.set(row.id, row);
  }
  const now = new Date().toISOString();
  nextById.set(record.id, {
    ...record,
    archivedAt: now,
  });
  const next = Array.from(nextById.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  writeHistoryRecords(next);
  return {
    ...record,
    archivedAt: now,
  };
}

export function summarizeTaskDashboardHistory(
  records: TaskDashboardHistoryRecord[],
) {
  const summary = {
    total: records.length,
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    canceled: 0,
  };
  for (const record of records) {
    if (record.state === "queued") {
      summary.queued += 1;
      continue;
    }
    if (record.state === "running") {
      summary.running += 1;
      continue;
    }
    if (record.state === "succeeded") {
      summary.succeeded += 1;
      continue;
    }
    if (record.state === "failed") {
      summary.failed += 1;
      continue;
    }
    if (record.state === "canceled") {
      summary.canceled += 1;
    }
  }
  return summary;
}
