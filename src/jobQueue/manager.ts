import { appendRuntimeLog } from "../modules/runtimeLogManager";

export type JobState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export type JobRecord = {
  id: string;
  workflowId: string;
  request: unknown;
  meta: Record<string, unknown>;
  state: JobState;
  error?: string;
  result?: unknown;
  createdAt: string;
  updatedAt: string;
};

type QueueConfig = {
  concurrency: number;
  executeJob: (job: JobRecord) => Promise<unknown>;
  onJobUpdated?: (job: JobRecord) => void;
};

export class JobQueueManager {
  private readonly concurrency: number;

  private readonly executeJob: (job: JobRecord) => Promise<unknown>;

  private readonly onJobUpdated?: (job: JobRecord) => void;

  private readonly jobs = new Map<string, JobRecord>();

  private readonly pendingIds: string[] = [];

  private runningCount = 0;

  private nextId = 1;

  private idleWaiters: Array<() => void> = [];

  constructor(config: QueueConfig) {
    this.concurrency = Math.max(1, config.concurrency);
    this.executeJob = config.executeJob;
    this.onJobUpdated = config.onJobUpdated;
  }

  enqueue(args: {
    workflowId: string;
    request: unknown;
    meta?: Record<string, unknown>;
  }) {
    const now = new Date().toISOString();
    const id = `job-${this.nextId++}`;
    const job: JobRecord = {
      id,
      workflowId: args.workflowId,
      request: args.request,
      meta: args.meta || {},
      state: "queued",
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(id, job);
    this.emitJobUpdated(job);
    appendRuntimeLog({
      level: "info",
      scope: "job",
      workflowId: job.workflowId,
      jobId: job.id,
      stage: "queue-queued",
      message: "job queued",
      details: {
        runId: String(job.meta.runId || ""),
      },
    });
    this.pendingIds.push(id);
    void this.drain();
    return id;
  }

  getJob(jobId: string) {
    const value = this.jobs.get(jobId);
    if (!value) {
      return null;
    }
    return { ...value };
  }

  listJobs() {
    return Array.from(this.jobs.values()).map((job) => ({ ...job }));
  }

  async waitForIdle() {
    if (this.runningCount === 0 && this.pendingIds.length === 0) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  private touch(job: JobRecord) {
    job.updatedAt = new Date().toISOString();
  }

  private emitJobUpdated(job: JobRecord) {
    if (!this.onJobUpdated) {
      return;
    }
    this.onJobUpdated({
      ...job,
      meta: { ...job.meta },
    });
  }

  private resolveIdleIfNeeded() {
    if (this.runningCount !== 0 || this.pendingIds.length !== 0) {
      return;
    }
    const waiters = [...this.idleWaiters];
    this.idleWaiters = [];
    for (const waiter of waiters) {
      waiter();
    }
  }

  private async runOne(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }
    job.state = "running";
    this.touch(job);
    this.emitJobUpdated(job);
    appendRuntimeLog({
      level: "info",
      scope: "job",
      workflowId: job.workflowId,
      jobId: job.id,
      stage: "dispatch-start",
      message: "provider dispatch started",
    });
    this.runningCount += 1;
    try {
      job.result = await this.executeJob({ ...job });
      job.state = "succeeded";
      this.touch(job);
      this.emitJobUpdated(job);
      const requestId = String(
        (job.result as { requestId?: unknown })?.requestId || "",
      ).trim();
      appendRuntimeLog({
        level: "info",
        scope: "job",
        workflowId: job.workflowId,
        jobId: job.id,
        requestId: requestId || undefined,
        stage: "dispatch-succeeded",
        message: "provider dispatch finished",
      });
    } catch (error) {
      this.logJobError(job, error);
      job.state = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      this.touch(job);
      this.emitJobUpdated(job);
      appendRuntimeLog({
        level: "error",
        scope: "job",
        workflowId: job.workflowId,
        jobId: job.id,
        stage: "dispatch-failed",
        message: "provider dispatch failed",
        error,
      });
    } finally {
      this.runningCount -= 1;
    }
  }

  private logJobError(job: JobRecord, error: unknown) {
    const label = `[workflow-job-error] workflow=${job.workflowId} job=${job.id}`;
    const runtime = globalThis as {
      Zotero?: { logError?: (err: unknown) => void };
    };
    try {
      if (typeof console !== "undefined" && typeof console.error === "function") {
        console.error(label, error);
      }
    } catch {
      // ignore logging failures
    }
    if (typeof runtime.Zotero?.logError === "function") {
      const normalized =
        error instanceof Error ? error : new Error(String(error));
      runtime.Zotero.logError(normalized);
    }
  }

  private async drain() {
    while (this.runningCount < this.concurrency && this.pendingIds.length > 0) {
      const nextJobId = this.pendingIds.shift();
      if (!nextJobId) {
        break;
      }
      void this.runOne(nextJobId).then(() => {
        void this.drain();
        this.resolveIdleIfNeeded();
      });
    }
    this.resolveIdleIfNeeded();
  }
}
