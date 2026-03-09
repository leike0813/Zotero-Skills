import { JobQueueManager } from "../../jobQueue/manager";
import { executeWithProvider } from "../../providers/registry";
import { appendRuntimeLog } from "../runtimeLogManager";
import { recordWorkflowTaskUpdate } from "../taskRuntime";
import { recordTaskDashboardHistoryFromJob } from "../taskDashboardHistory";
import type { PreparedWorkflowExecution, WorkflowRunState } from "./contracts";
import {
  resolveInputUnitIdentityFromRequest,
  resolveInputUnitLabelFromRequest,
  resolveTargetParentIDFromRequest,
  resolveTaskNameFromRequest,
} from "./requestMeta";

type RunSeamDeps = {
  createQueue: (config: ConstructorParameters<typeof JobQueueManager>[0]) => JobQueueManager;
  executeWithProvider: typeof executeWithProvider;
  appendRuntimeLog: typeof appendRuntimeLog;
  recordWorkflowTaskUpdate: typeof recordWorkflowTaskUpdate;
  recordTaskDashboardHistoryFromJob: typeof recordTaskDashboardHistoryFromJob;
};

const defaultRunSeamDeps: RunSeamDeps = {
  createQueue: (config) => new JobQueueManager(config),
  executeWithProvider,
  appendRuntimeLog,
  recordWorkflowTaskUpdate,
  recordTaskDashboardHistoryFromJob,
};

export function runWorkflowExecutionSeam(args: {
  prepared: PreparedWorkflowExecution;
}, deps: Partial<RunSeamDeps> = {}): WorkflowRunState {
  const resolved = {
    ...defaultRunSeamDeps,
    ...deps,
  };
  const runId = `run-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const queue = resolved.createQueue({
    concurrency: 1,
    executeJob: (job, runtime) =>
      resolved.executeWithProvider({
        requestKind: args.prepared.executionContext.requestKind,
        request: job.request,
        backend: args.prepared.executionContext.backend,
        providerOptions: args.prepared.executionContext.providerOptions,
        onProgress: (event) => {
          runtime.reportProgress(event);
        },
      }),
    onJobProgress: (job, event) => {
      if (event.type === "request-created") {
        const requestId = String(event.requestId || "").trim();
        if (requestId) {
          job.meta.requestId = requestId;
        }
      }
    },
    onJobUpdated: (job) => {
      resolved.recordWorkflowTaskUpdate(job);
      resolved.recordTaskDashboardHistoryFromJob(job);
    },
  });

  const jobIds = args.prepared.requests.map((request, index) => {
    const taskName = resolveTaskNameFromRequest(request, index);
    const inputUnitIdentity = resolveInputUnitIdentityFromRequest(request);
    const inputUnitLabel = resolveInputUnitLabelFromRequest(request, index);
    const jobId = queue.enqueue({
      workflowId: args.prepared.workflow.manifest.id,
      request,
      meta: {
        index,
        runId,
        workflowLabel: args.prepared.workflow.manifest.label,
        taskName,
        inputUnitIdentity,
        inputUnitLabel,
        targetParentID: resolveTargetParentIDFromRequest(request),
        providerId: args.prepared.executionContext.providerId,
        backendId: args.prepared.executionContext.backend.id,
        backendType: args.prepared.executionContext.backend.type,
        backendBaseUrl: args.prepared.executionContext.backend.baseUrl,
      },
    });
    resolved.appendRuntimeLog({
      level: "info",
      scope: "job",
      workflowId: args.prepared.workflow.manifest.id,
      jobId,
      stage: "job-enqueued",
      message: "job enqueued",
      details: {
        runId,
        index,
        taskName,
      },
    });
    return jobId;
  });

  return {
    workflow: args.prepared.workflow,
    requests: args.prepared.requests,
    queue,
    jobIds,
    runId,
    totalJobs: jobIds.length,
    idlePromise: queue.waitForIdle(),
  };
}
