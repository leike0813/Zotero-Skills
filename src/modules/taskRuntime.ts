import type { JobRecord, JobState } from "../jobQueue/manager";

export type WorkflowTaskRecord = {
  id: string;
  runId: string;
  jobId: string;
  workflowId: string;
  workflowLabel: string;
  taskName: string;
  inputUnitIdentity?: string;
  inputUnitLabel?: string;
  state: JobState;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type TaskListener = (tasks: WorkflowTaskRecord[]) => void;

const taskRecords = new Map<string, WorkflowTaskRecord>();
const listeners = new Set<TaskListener>();

function normalizeMetaString(meta: Record<string, unknown>, key: string) {
  const value = meta[key];
  return typeof value === "string" ? value.trim() : "";
}

function getTaskIdFromJob(job: JobRecord) {
  const runId = normalizeMetaString(job.meta, "runId");
  if (runId) {
    return `${runId}:${job.id}`;
  }
  return `${job.workflowId}:${job.id}:${job.createdAt}`;
}

function buildTaskRecordFromJob(job: JobRecord): WorkflowTaskRecord {
  const runId =
    normalizeMetaString(job.meta, "runId") ||
    `${job.workflowId}:${job.createdAt}`;
  const workflowLabel =
    normalizeMetaString(job.meta, "workflowLabel") || job.workflowId;
  const taskName = normalizeMetaString(job.meta, "taskName") || job.id;
  const inputUnitIdentity = normalizeMetaString(job.meta, "inputUnitIdentity");
  const inputUnitLabel =
    normalizeMetaString(job.meta, "inputUnitLabel") || taskName;
  return {
    id: getTaskIdFromJob(job),
    runId,
    jobId: job.id,
    workflowId: job.workflowId,
    workflowLabel,
    taskName,
    inputUnitIdentity: inputUnitIdentity || undefined,
    inputUnitLabel: inputUnitLabel || undefined,
    state: job.state,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function emitTasksChanged() {
  const snapshot = listWorkflowTasks();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function isFinishedState(state: JobState) {
  return state === "succeeded" || state === "failed" || state === "canceled";
}

export function recordWorkflowTaskUpdate(job: JobRecord) {
  const record = buildTaskRecordFromJob(job);
  taskRecords.set(record.id, record);
  emitTasksChanged();
}

export function listWorkflowTasks() {
  return Array.from(taskRecords.values())
    .map((entry) => ({ ...entry }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listActiveWorkflowTasks() {
  return listWorkflowTasks().filter(
    (entry) => entry.state === "queued" || entry.state === "running",
  );
}

export function clearFinishedWorkflowTasks() {
  let removed = false;
  for (const [id, record] of taskRecords.entries()) {
    if (!isFinishedState(record.state)) {
      continue;
    }
    taskRecords.delete(id);
    removed = true;
  }
  if (removed) {
    emitTasksChanged();
  }
}

export function subscribeWorkflowTasks(listener: TaskListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetWorkflowTasks() {
  if (taskRecords.size === 0) {
    return;
  }
  taskRecords.clear();
  emitTasksChanged();
}
