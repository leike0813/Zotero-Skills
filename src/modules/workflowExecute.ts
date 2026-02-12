import { JobQueueManager } from "../jobQueue/manager";
import { buildSelectionContext } from "./selectionContext";
import {
  buildWorkflowFinishMessage,
  buildWorkflowJobToastMessage,
  buildWorkflowStartToastMessage,
  normalizeErrorMessage,
} from "./workflowExecuteMessage";
import { joinPath } from "../utils/path";
import { executeApplyResult, executeBuildRequests } from "../workflows/runtime";
import { ZipBundleReader } from "../workflows/zipBundleReader";
import type { LoadedWorkflow } from "../workflows/types";
import { executeWithProvider } from "../providers/registry";
import { resolveWorkflowExecutionContext } from "./workflowSettings";
import { getBaseName } from "../utils/path";
import { recordWorkflowTaskUpdate } from "./taskRuntime";
import { getString } from "../utils/locale";
import { appendRuntimeLog } from "./runtimeLogManager";

type DynamicImport = (specifier: string) => Promise<any>;
const dynamicImport: DynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as DynamicImport;

function buildTempBundlePath(requestId: string) {
  const tempDir = Zotero.getTempDirectory?.()?.path || ".";
  const stamp = Date.now().toString(36);
  return joinPath(tempDir, `zotero-skills-${requestId}-${stamp}.zip`);
}

async function writeBytes(filePath: string, bytes: Uint8Array) {
  const runtime = globalThis as unknown as {
    IOUtils?: { write?: (targetPath: string, data: Uint8Array) => Promise<number | void> };
  };
  if (typeof runtime.IOUtils?.write === "function") {
    await runtime.IOUtils.write(filePath, bytes);
    return;
  }
  const fs = await dynamicImport("fs/promises");
  await fs.writeFile(filePath, Buffer.from(bytes));
}

async function removeFileIfExists(filePath: string) {
  const runtime = globalThis as {
    IOUtils?: { remove?: (targetPath: string, options?: { ignoreAbsent?: boolean }) => Promise<void> };
  };
  if (typeof runtime.IOUtils?.remove === "function") {
    await runtime.IOUtils.remove(filePath, {
      ignoreAbsent: true,
    });
    return;
  }
  try {
    const fs = await dynamicImport("fs/promises");
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

type BundleReader = {
  readText: (entryPath: string) => Promise<string>;
  getExtractedDir?: () => Promise<string>;
};

function createUnavailableBundleReader(requestId: string): BundleReader {
  return {
    readText: async (entryPath: string) => {
      throw new Error(
        `Run ${requestId} does not provide bundle content; entry unavailable: ${entryPath}`,
      );
    },
  };
}

function resolveTargetParentID(request: unknown) {
  const parsed = request as { targetParentID?: number };
  return typeof parsed.targetParentID === "number" ? parsed.targetParentID : null;
}

function resolveAttachmentPathsFromRequest(request: unknown) {
  const typed = request as {
    sourceAttachmentPaths?: unknown;
    request?: { json?: { attachment_paths?: unknown } };
    attachment_paths?: unknown;
  };
  const fromSource = Array.isArray(typed.sourceAttachmentPaths)
    ? typed.sourceAttachmentPaths
    : [];
  const fromRequestJson = Array.isArray(typed.request?.json?.attachment_paths)
    ? typed.request?.json?.attachment_paths || []
    : [];
  const fromTopLevel = Array.isArray(typed.attachment_paths)
    ? typed.attachment_paths || []
    : [];
  return [...fromSource, ...fromRequestJson, ...fromTopLevel]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function resolveParentTaskName(targetParentID: number | null) {
  if (!targetParentID) {
    return "";
  }
  const parent = Zotero.Items.get(targetParentID);
  if (!parent) {
    return "";
  }
  const title = String(parent.getField?.("title") || "").trim();
  return title || "";
}

function resolveTaskNameFromRequest(request: unknown, index: number) {
  const fromRequest = String(
    (request as { taskName?: unknown }).taskName || "",
  ).trim();
  if (fromRequest) {
    return fromRequest;
  }
  const attachmentPaths = resolveAttachmentPathsFromRequest(request);
  if (attachmentPaths.length > 0) {
    return getBaseName(attachmentPaths[0]) || attachmentPaths[0];
  }
  const targetParentID = resolveTargetParentID(request);
  const parentName = resolveParentTaskName(targetParentID);
  if (parentName) {
    return parentName;
  }
  return `task-${index + 1}`;
}

function isNoValidInputUnitsError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === "NO_VALID_INPUT_UNITS"
  ) {
    return true;
  }
  return /has no valid input units after filtering/i.test(
    normalizeErrorMessage(error),
  );
}

function resolveSkippedUnitsFromNoValidInputError(error: unknown) {
  if (!error || typeof error !== "object") {
    return isNoValidInputUnitsError(error) ? 1 : 0;
  }
  const typed = error as {
    code?: unknown;
    skippedUnits?: unknown;
    totalUnits?: unknown;
  };
  if (typed.code === "NO_VALID_INPUT_UNITS") {
    const raw = Number(typed.skippedUnits ?? typed.totalUnits ?? 0);
    if (Number.isFinite(raw) && raw > 0) {
      return Math.floor(raw);
    }
    return 0;
  }
  return isNoValidInputUnitsError(error) ? 1 : 0;
}

function localizeText(
  id: string,
  fallback: string,
  args?: Record<string, unknown>,
) {
  try {
    if (typeof addon === "undefined") {
      return fallback;
    }
    const localized = args
      ? getString(id as any, { args })
      : getString(id as any);
    const unresolved = `${addon.data.config.addonRef}-${id}`;
    if (!localized || localized === unresolved) {
      return fallback;
    }
    return localized;
  } catch {
    return fallback;
  }
}

function createLocalizedMessageFormatter() {
  return {
    summary: ({ workflowLabel, succeeded, failed, skipped }: {
      workflowLabel: string;
      succeeded: number;
      failed: number;
      skipped: number;
    }) => {
      if (skipped > 0) {
        return localizeText(
          "workflow-execute-summary-with-skipped",
          `Workflow ${workflowLabel} finished. succeeded=${succeeded}, failed=${failed}, skipped=${skipped}`,
          { workflowLabel, succeeded, failed, skipped },
        );
      }
      return localizeText(
        "workflow-execute-summary",
        `Workflow ${workflowLabel} finished. succeeded=${succeeded}, failed=${failed}`,
        { workflowLabel, succeeded, failed },
      );
    },
    failureReasonsTitle: localizeText(
      "workflow-execute-failure-reasons-title",
      "Failure reasons:",
    ),
    overflow: (count: number) =>
      localizeText(
        "workflow-execute-failure-overflow",
        `...and ${count} more`,
        { count },
      ),
    unknownError: localizeText(
      "workflow-execute-unknown-error",
      "unknown error",
    ),
    startToast: ({ workflowLabel, totalJobs }: {
      workflowLabel: string;
      totalJobs: number;
    }) =>
      localizeText(
        "workflow-execute-toast-start",
        `Workflow ${workflowLabel} started. jobs=${totalJobs}`,
        { workflowLabel, totalJobs },
      ),
    jobToastSuccess: ({ workflowLabel, taskLabel, index, total }: {
      workflowLabel: string;
      taskLabel: string;
      index: number;
      total: number;
    }) =>
      localizeText(
        "workflow-execute-toast-job-success",
        `Workflow ${workflowLabel} job ${index}/${total} succeeded: ${taskLabel}`,
        { workflowLabel, taskLabel, index, total },
      ),
    jobToastFailed: ({ workflowLabel, taskLabel, index, total, reason }: {
      workflowLabel: string;
      taskLabel: string;
      index: number;
      total: number;
      reason: string;
    }) =>
      localizeText(
        "workflow-execute-toast-job-failed",
        `Workflow ${workflowLabel} job ${index}/${total} failed: ${taskLabel} (${reason})`,
        { workflowLabel, taskLabel, index, total, reason },
      ),
  };
}

function showWorkflowToast(args: {
  text: string;
  type: "default" | "success" | "error";
}) {
  type ProgressWindowInstance = {
    createLine: (args: {
      text: string;
      type?: string;
      progress?: number;
    }) => ProgressWindowInstance;
    show: () => ProgressWindowInstance;
    startCloseTimer?: (delayMs: number) => unknown;
  };
  type ProgressWindowCtor = new (
    title: string,
    options?: Record<string, unknown>,
  ) => ProgressWindowInstance;
  const runtime = globalThis as unknown as {
    ztoolkit?: { ProgressWindow?: ProgressWindowCtor };
  };
  const fromGlobalVar =
    typeof ztoolkit !== "undefined" ? ztoolkit?.ProgressWindow : undefined;
  const fromAddon =
    typeof addon !== "undefined"
      ? addon?.data?.ztoolkit?.ProgressWindow
      : undefined;
  const fromGlobalThis = runtime.ztoolkit?.ProgressWindow;
  const ProgressWindow =
    fromGlobalVar || fromAddon || fromGlobalThis;
  if (!ProgressWindow) {
    return;
  }
  const addonName =
    (typeof addon !== "undefined" && addon?.data?.config?.addonName) ||
    "Zotero Skills";
  try {
    const win = new ProgressWindow(addonName, {
      closeOnClick: true,
      closeTime: 3500,
    });
    const shown = win
      .createLine({
        text: args.text,
        type: args.type,
        progress: 100,
      })
      .show();
    if (typeof shown.startCloseTimer === "function") {
      shown.startCloseTimer(3500);
    }
  } catch {
    // ignore toast failures
  }
}

function alertWindow(win: _ZoteroTypes.MainWindow, message: string) {
  if (typeof win.alert === "function") {
    win.alert(message);
    return;
  }
  showWorkflowToast({
    text: message,
    type: "default",
  });
}

export async function executeWorkflowFromCurrentSelection(args: {
  win: _ZoteroTypes.MainWindow;
  workflow: LoadedWorkflow;
}) {
  const messageFormatter = createLocalizedMessageFormatter();
  const selectedItems = args.win.ZoteroPane?.getSelectedItems?.() || [];
  if (selectedItems.length === 0) {
    appendRuntimeLog({
      level: "warn",
      scope: "workflow-trigger",
      workflowId: args.workflow.manifest.id,
      stage: "trigger-rejected-no-selection",
      message: "workflow trigger rejected: no selected items",
    });
    alertWindow(
      args.win,
      localizeText("workflow-execute-no-selection", "No items selected."),
    );
    return;
  }
  appendRuntimeLog({
    level: "info",
    scope: "workflow-trigger",
    workflowId: args.workflow.manifest.id,
    stage: "trigger-start",
    message: "workflow trigger started",
    details: {
      workflowLabel: args.workflow.manifest.label,
      selectedItems: selectedItems.length,
    },
  });

  let requests: unknown[];
  let skippedByFilter = 0;
  let executionContext:
    | Awaited<ReturnType<typeof resolveWorkflowExecutionContext>>
    | null = null;
  try {
    appendRuntimeLog({
      level: "info",
      scope: "workflow-trigger",
      workflowId: args.workflow.manifest.id,
      stage: "build-requests-start",
      message: "build requests started",
    });
    executionContext = await resolveWorkflowExecutionContext({
      workflow: args.workflow,
      consumeRunOnce: true,
    });
    const selectionContext = await buildSelectionContext(selectedItems);
    const builtRequests = await executeBuildRequests({
      workflow: args.workflow,
      selectionContext,
      executionOptions: {
        workflowParams: executionContext.workflowParams,
        providerOptions: executionContext.providerOptions,
      },
    });
    requests = builtRequests;
    skippedByFilter = Math.max(
      0,
      Number(
        (
          builtRequests as unknown as {
            __stats?: { skippedUnits?: number };
          }
        ).__stats?.skippedUnits || 0,
      ),
    );
    appendRuntimeLog({
      level: "info",
      scope: "workflow-trigger",
      workflowId: args.workflow.manifest.id,
      stage: "build-requests-finished",
      message: "build requests finished",
      details: {
        requestCount: requests.length,
        skippedUnits: skippedByFilter,
      },
    });
  } catch (error) {
    if (isNoValidInputUnitsError(error)) {
      const skippedUnits = resolveSkippedUnitsFromNoValidInputError(error);
      appendRuntimeLog({
        level: "warn",
        scope: "workflow-trigger",
        workflowId: args.workflow.manifest.id,
        stage: "trigger-no-valid-input",
        message: "workflow has no valid input units",
        details: { skippedUnits },
        error,
      });
      if (typeof console !== "undefined") {
        console.info(
          `[workflow-execute] skipped workflow=${args.workflow.manifest.id} reason=no-valid-input-units`,
        );
      }
      alertWindow(
        args.win,
        buildWorkflowFinishMessage({
          workflowLabel: args.workflow.manifest.label,
          succeeded: 0,
          failed: 0,
          skipped: skippedUnits,
          failureReasons: [],
        }, messageFormatter),
      );
      return;
    }
    const reason = normalizeErrorMessage(error, messageFormatter);
    appendRuntimeLog({
      level: "error",
      scope: "workflow-trigger",
      workflowId: args.workflow.manifest.id,
      stage: "build-requests-failed",
      message: "build requests failed",
      details: { reason },
      error,
    });
    alertWindow(
      args.win,
      localizeText(
        "workflow-execute-cannot-run",
        `Workflow ${args.workflow.manifest.label} cannot run: ${reason}`,
        {
          workflowLabel: args.workflow.manifest.label,
          reason,
        },
      ),
    );
    return;
  }

  if (requests.length === 0) {
    appendRuntimeLog({
      level: "warn",
      scope: "workflow-trigger",
      workflowId: args.workflow.manifest.id,
      stage: "trigger-no-requests",
      message: "workflow trigger produced zero requests",
      details: {
        skippedUnits: Math.max(1, skippedByFilter),
      },
    });
    alertWindow(
      args.win,
      buildWorkflowFinishMessage({
        workflowLabel: args.workflow.manifest.label,
        succeeded: 0,
        failed: 0,
        skipped: Math.max(1, skippedByFilter),
        failureReasons: [],
      }, messageFormatter),
    );
    return;
  }

  if (!executionContext) {
    appendRuntimeLog({
      level: "error",
      scope: "workflow-trigger",
      workflowId: args.workflow.manifest.id,
      stage: "execution-context-missing",
      message: "workflow execution context missing",
    });
    alertWindow(
      args.win,
      localizeText(
        "workflow-execute-cannot-run-context-unavailable",
        `Workflow ${args.workflow.manifest.label} cannot run: execution context is unavailable`,
        { workflowLabel: args.workflow.manifest.label },
      ),
    );
    return;
  }
  const queue = new JobQueueManager({
    concurrency: 1,
    executeJob: (job) =>
      executeWithProvider({
        requestKind: executionContext.requestKind,
        request: job.request,
        backend: executionContext.backend,
        providerOptions: executionContext.providerOptions,
      }),
    onJobUpdated: (job) => {
      recordWorkflowTaskUpdate(job);
    },
  });
  const runId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const jobIds = requests.map((request, index) =>
    {
      const jobId = queue.enqueue({
      workflowId: args.workflow.manifest.id,
      request,
      meta: {
        index,
        runId,
        workflowLabel: args.workflow.manifest.label,
        taskName: resolveTaskNameFromRequest(request, index),
        targetParentID: resolveTargetParentID(request),
      },
      });
      appendRuntimeLog({
        level: "info",
        scope: "job",
        workflowId: args.workflow.manifest.id,
        jobId,
        stage: "job-enqueued",
        message: "job enqueued",
        details: {
          runId,
          index,
          taskName: resolveTaskNameFromRequest(request, index),
        },
      });
      return jobId;
    },
  );

  showWorkflowToast({
    text: buildWorkflowStartToastMessage(
      {
        workflowLabel: args.workflow.manifest.label,
        totalJobs: jobIds.length,
      },
      messageFormatter,
    ),
    type: "default",
  });

  await queue.waitForIdle();

  let succeeded = 0;
  let failed = 0;
  const failureReasons: string[] = [];
  const emitJobToast = (jobToastArgs: {
    index: number;
    taskLabel: string;
    succeeded: boolean;
    reason?: string;
  }) => {
    showWorkflowToast({
      text: buildWorkflowJobToastMessage(
        {
          workflowLabel: args.workflow.manifest.label,
          taskLabel: jobToastArgs.taskLabel,
          index: jobToastArgs.index + 1,
          total: jobIds.length,
          succeeded: jobToastArgs.succeeded,
          reason: jobToastArgs.reason,
        },
        messageFormatter,
      ),
      type: jobToastArgs.succeeded ? "success" : "error",
    });
  };
  for (let i = 0; i < jobIds.length; i++) {
    const taskLabel = resolveTaskNameFromRequest(requests[i], i);
    const job = queue.getJob(jobIds[i]);
    if (!job || job.state !== "succeeded") {
      failed += 1;
      if (!job) {
        const reason = "record missing";
        failureReasons.push(`job-${i}: ${reason}`);
        emitJobToast({ index: i, taskLabel, succeeded: false, reason });
        appendRuntimeLog({
          level: "error",
          scope: "job",
          workflowId: args.workflow.manifest.id,
          jobId: jobIds[i],
          stage: "job-missing",
          message: "job record missing after queue drain",
          details: { index: i, taskLabel },
        });
      } else {
        const reason = job.error || `state=${job.state}`;
        failureReasons.push(`job-${i}: ${reason}`);
        emitJobToast({ index: i, taskLabel, succeeded: false, reason });
        appendRuntimeLog({
          level: "error",
          scope: "job",
          workflowId: args.workflow.manifest.id,
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
        : resolveTargetParentID(requests[i]);
    if (!targetParentID) {
      failed += 1;
      const reason = "cannot resolve target parent";
      failureReasons.push(`job-${i}: ${reason}`);
      emitJobToast({ index: i, taskLabel, succeeded: false, reason });
      appendRuntimeLog({
        level: "error",
        scope: "job",
        workflowId: args.workflow.manifest.id,
        jobId: job.id,
        stage: "apply-parent-missing",
        message: "cannot resolve target parent before applyResult",
        details: { index: i, taskLabel },
      });
      continue;
    }

    const result = job.result as {
      bundleBytes?: Uint8Array;
      requestId?: string;
    };
    if (!result?.requestId) {
      failed += 1;
      const reason = "missing requestId in execution result";
      failureReasons.push(`job-${i}: ${reason}`);
      emitJobToast({ index: i, taskLabel, succeeded: false, reason });
      appendRuntimeLog({
        level: "error",
        scope: "job",
        workflowId: args.workflow.manifest.id,
        jobId: job.id,
        stage: "provider-result-missing-request-id",
        message: "provider result missing requestId",
        details: { index: i, taskLabel },
      });
      continue;
    }

    appendRuntimeLog({
      level: "info",
      scope: "job",
      workflowId: args.workflow.manifest.id,
      jobId: job.id,
      requestId: result.requestId,
      stage: "provider-finished",
      message: "provider execution finished for job",
      details: { index: i, taskLabel },
    });

    let bundlePath = "";
    try {
      appendRuntimeLog({
        level: "info",
        scope: "job",
        workflowId: args.workflow.manifest.id,
        jobId: job.id,
        requestId: result.requestId,
        stage: "apply-start",
        message: "applyResult started",
        details: { index: i, taskLabel },
      });
      let bundleReader: BundleReader = createUnavailableBundleReader(
        result.requestId,
      );
      if (result.bundleBytes && result.bundleBytes.length > 0) {
        bundlePath = buildTempBundlePath(result.requestId);
        await writeBytes(bundlePath, result.bundleBytes);
        bundleReader = new ZipBundleReader(bundlePath);
      }
      await executeApplyResult({
        workflow: args.workflow,
        parent: targetParentID,
        bundleReader,
        request: requests[i],
        runResult: job.result,
      });
      succeeded += 1;
      emitJobToast({ index: i, taskLabel, succeeded: true });
      appendRuntimeLog({
        level: "info",
        scope: "job",
        workflowId: args.workflow.manifest.id,
        jobId: job.id,
        requestId: result.requestId,
        stage: "apply-succeeded",
        message: "applyResult succeeded",
        details: { index: i, taskLabel, targetParentID },
      });
    } catch (error) {
      failed += 1;
      const reason = normalizeErrorMessage(error, messageFormatter);
      failureReasons.push(
        `job-${i} (request_id=${result.requestId}): ${reason}`,
      );
      emitJobToast({ index: i, taskLabel, succeeded: false, reason });
      appendRuntimeLog({
        level: "error",
        scope: "job",
        workflowId: args.workflow.manifest.id,
        jobId: job.id,
        requestId: result.requestId,
        stage: "apply-failed",
        message: "applyResult failed",
        details: { index: i, taskLabel, reason },
        error,
      });
    } finally {
      if (bundlePath) {
        await removeFileIfExists(bundlePath);
      }
    }
  }
  appendRuntimeLog({
    level: failed > 0 ? "warn" : "info",
    scope: "workflow-trigger",
    workflowId: args.workflow.manifest.id,
    stage: "trigger-finished",
    message: "workflow trigger finished",
    details: {
      succeeded,
      failed,
      skipped: skippedByFilter,
      failureCount: failureReasons.length,
    },
  });

  alertWindow(
    args.win,
    buildWorkflowFinishMessage({
      workflowLabel: args.workflow.manifest.label,
      succeeded,
      failed,
      skipped: skippedByFilter,
      failureReasons,
    }, messageFormatter),
  );
}
