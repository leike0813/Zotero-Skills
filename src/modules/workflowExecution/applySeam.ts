import { appendRuntimeLog } from "../runtimeLogManager";
import { normalizeErrorMessage, type WorkflowMessageFormatter } from "../workflowExecuteMessage";
import { executeApplyResult } from "../../workflows/runtime";
import { ZipBundleReader } from "../../workflows/zipBundleReader";
import type { BundleReader } from "./bundleIO";
import {
  buildTempBundlePath,
  createUnavailableBundleReader,
  removeFileIfExists,
  writeBytes,
} from "./bundleIO";
import type { WorkflowApplySummary, WorkflowRunState } from "./contracts";
import {
  resolveTargetParentIDFromRequest,
  resolveTaskNameFromRequest,
} from "./requestMeta";
import { isActive } from "../skillRunnerProviderStateMachine";
import { resolveSkillRunnerExecutionModeFromRequest } from "../skillRunnerExecutionMode";

type RunResultLike = {
  status?: string;
  backendStatus?: string;
  bundleBytes?: Uint8Array;
  requestId?: string;
};

function isSkillRunnerAutoRequest(args: {
  workflow: { manifest?: { provider?: string; request?: { kind?: string } } };
  request: unknown;
}) {
  const provider = String(args.workflow.manifest?.provider || "").trim();
  const requestKind = String(args.workflow.manifest?.request?.kind || "").trim();
  if (provider !== "skillrunner" && requestKind !== "skillrunner.job.v1") {
    return false;
  }
  return resolveSkillRunnerExecutionModeFromRequest(args.request) === "auto";
}

function isPendingWorkflowJobState(state: string) {
  return isActive(state);
}

type ApplySeamDeps = {
  appendRuntimeLog: typeof appendRuntimeLog;
  normalizeErrorMessage: typeof normalizeErrorMessage;
  executeApplyResult: typeof executeApplyResult;
  buildTempBundlePath: typeof buildTempBundlePath;
  writeBytes: typeof writeBytes;
  removeFileIfExists: typeof removeFileIfExists;
  createUnavailableBundleReader: typeof createUnavailableBundleReader;
  createZipBundleReader: (bundlePath: string) => BundleReader;
};

const defaultApplySeamDeps: ApplySeamDeps = {
  appendRuntimeLog,
  normalizeErrorMessage,
  executeApplyResult,
  buildTempBundlePath,
  writeBytes,
  removeFileIfExists,
  createUnavailableBundleReader,
  createZipBundleReader: (bundlePath) => new ZipBundleReader(bundlePath),
};

export async function runWorkflowApplySeam(args: {
  runState: WorkflowRunState;
  messageFormatter: WorkflowMessageFormatter;
}, deps: Partial<ApplySeamDeps> = {}): Promise<WorkflowApplySummary> {
  const resolved = {
    ...defaultApplySeamDeps,
    ...deps,
  };
  let succeeded = 0;
  let failed = 0;
  let pending = 0;
  const failureReasons: string[] = [];
  const jobOutcomes: WorkflowApplySummary["jobOutcomes"] = [];
  const reconcileOwnedPendingJobs: WorkflowApplySummary["reconcileOwnedPendingJobs"] = [];

  for (let i = 0; i < args.runState.jobIds.length; i++) {
    const taskLabel = resolveTaskNameFromRequest(args.runState.requests[i], i);
    const jobId = args.runState.jobIds[i];
    const job = args.runState.queue.getJob(jobId);
    if (!job || job.state !== "succeeded") {
      failed += 1;
      if (!job) {
        const reason = "record missing";
        failureReasons.push(`job-${i}: ${reason}`);
        jobOutcomes.push({
          index: i,
          taskLabel,
          succeeded: false,
          reason,
          jobId,
        });
        resolved.appendRuntimeLog({
          level: "error",
          scope: "job",
          workflowId: args.runState.workflow.manifest.id,
          jobId,
          stage: "job-missing",
          message: "job record missing after queue drain",
          details: { index: i, taskLabel },
        });
      } else {
        const isDeferredResult =
          (job.result as RunResultLike | undefined)?.status === "deferred";
        if (isDeferredResult && isPendingWorkflowJobState(job.state)) {
          pending += 1;
          failed -= 1;
          resolved.appendRuntimeLog({
            level: "info",
            scope: "job",
            workflowId: args.runState.workflow.manifest.id,
            jobId: job.id,
            requestId: String(job.meta.requestId || "").trim() || undefined,
            stage: "job-pending",
            message: "job pending backend state reconciler",
            details: { index: i, taskLabel, state: job.state },
          });
          continue;
        }
        const reason = job.error || `state=${job.state}`;
        failureReasons.push(`job-${i}: ${reason}`);
        jobOutcomes.push({
          index: i,
          taskLabel,
          succeeded: false,
          reason,
          jobId: job.id,
        });
        resolved.appendRuntimeLog({
          level: "error",
          scope: "job",
          workflowId: args.runState.workflow.manifest.id,
          jobId: job.id,
          stage: "job-failed",
          message: "job execution failed",
          details: { index: i, taskLabel, reason },
        });
      }
      continue;
    }

    const targetParentID =
      typeof job.meta.targetParentID === "number"
        ? job.meta.targetParentID
        : resolveTargetParentIDFromRequest(args.runState.requests[i]);
    if (!targetParentID) {
      failed += 1;
      const reason = "cannot resolve target parent";
      failureReasons.push(`job-${i}: ${reason}`);
      jobOutcomes.push({
        index: i,
        taskLabel,
        succeeded: false,
        reason,
        jobId: job.id,
      });
      resolved.appendRuntimeLog({
        level: "error",
        scope: "job",
        workflowId: args.runState.workflow.manifest.id,
        jobId: job.id,
        stage: "apply-parent-missing",
        message: "cannot resolve target parent before applyResult",
        details: { index: i, taskLabel },
      });
      continue;
    }

    const result = job.result as RunResultLike;
    if (!result?.requestId) {
      failed += 1;
      const reason = "missing requestId in execution result";
      failureReasons.push(`job-${i}: ${reason}`);
      jobOutcomes.push({
        index: i,
        taskLabel,
        succeeded: false,
        reason,
        jobId: job.id,
      });
      resolved.appendRuntimeLog({
        level: "error",
        scope: "job",
        workflowId: args.runState.workflow.manifest.id,
        jobId: job.id,
        stage: "provider-result-missing-request-id",
        message: "provider result missing requestId",
        details: { index: i, taskLabel },
      });
      continue;
    }

    resolved.appendRuntimeLog({
      level: "info",
      scope: "job",
      workflowId: args.runState.workflow.manifest.id,
      jobId: job.id,
      requestId: result.requestId,
      stage: "provider-finished",
      message: "provider execution finished for job",
      details: { index: i, taskLabel },
    });

    if (
      isSkillRunnerAutoRequest({
        workflow: args.runState.workflow,
        request: args.runState.requests[i],
      })
    ) {
      pending += 1;
      reconcileOwnedPendingJobs.push({
        index: i,
        taskLabel,
        succeeded: true,
        terminalState: "succeeded",
        jobId: job.id,
        requestId: result.requestId,
      });
      resolved.appendRuntimeLog({
        level: "info",
        scope: "job",
        workflowId: args.runState.workflow.manifest.id,
        jobId: job.id,
        requestId: result.requestId,
        stage: "foreground-apply-skipped-auto",
        message: "foreground apply skipped for reconcile-owned skillrunner auto terminal result",
        details: { index: i, taskLabel, runId: args.runState.runId },
      });
      continue;
    }

    let bundlePath = "";
    try {
      resolved.appendRuntimeLog({
        level: "info",
        scope: "job",
        workflowId: args.runState.workflow.manifest.id,
        jobId: job.id,
        requestId: result.requestId,
        stage: "apply-start",
        message: "applyResult started",
        details: { index: i, taskLabel },
      });
      let bundleReader: BundleReader = resolved.createUnavailableBundleReader(
        result.requestId,
      );
      if (result.bundleBytes && result.bundleBytes.length > 0) {
        bundlePath = resolved.buildTempBundlePath(result.requestId);
        await resolved.writeBytes(bundlePath, result.bundleBytes);
        bundleReader = resolved.createZipBundleReader(bundlePath);
      }
      await resolved.executeApplyResult({
        workflow: args.runState.workflow,
        parent: targetParentID,
        bundleReader,
        request: args.runState.requests[i],
        runResult: job.result,
      });
      succeeded += 1;
      jobOutcomes.push({
        index: i,
        taskLabel,
        succeeded: true,
        terminalState: "succeeded",
        jobId: job.id,
        requestId: result.requestId,
      });
      resolved.appendRuntimeLog({
        level: "info",
        scope: "job",
        workflowId: args.runState.workflow.manifest.id,
        jobId: job.id,
        requestId: result.requestId,
        stage: "apply-succeeded",
        message: "applyResult succeeded",
        details: { index: i, taskLabel, targetParentID },
      });
    } catch (error) {
      failed += 1;
      const reason = resolved.normalizeErrorMessage(error, args.messageFormatter);
      failureReasons.push(
        `job-${i} (request_id=${result.requestId}): ${reason}`,
      );
      jobOutcomes.push({
        index: i,
        taskLabel,
        succeeded: false,
        terminalState: "failed",
        reason,
        jobId: job.id,
        requestId: result.requestId,
      });
      resolved.appendRuntimeLog({
        level: "error",
        scope: "job",
        workflowId: args.runState.workflow.manifest.id,
        jobId: job.id,
        requestId: result.requestId,
        stage: "apply-failed",
        message: "applyResult failed",
        details: { index: i, taskLabel, reason },
        error,
      });
    } finally {
      if (bundlePath) {
        await resolved.removeFileIfExists(bundlePath);
      }
    }
  }

  return {
    succeeded,
    failed,
    pending,
    failureReasons,
    jobOutcomes,
    reconcileOwnedPendingJobs,
  };
}
