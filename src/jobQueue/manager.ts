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
};

export class JobQueueManager {
  private readonly concurrency: number;

  private readonly executeJob: (job: JobRecord) => Promise<unknown>;

  private readonly jobs = new Map<string, JobRecord>();

  private readonly pendingIds: string[] = [];

  private runningCount = 0;

  private nextId = 1;

  private idleWaiters: Array<() => void> = [];

  constructor(config: QueueConfig) {
    this.concurrency = Math.max(1, config.concurrency);
    this.executeJob = config.executeJob;
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
    this.runningCount += 1;
    try {
      job.result = await this.executeJob({ ...job });
      job.state = "succeeded";
      this.touch(job);
    } catch (error) {
      job.state = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      this.touch(job);
    } finally {
      this.runningCount -= 1;
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

