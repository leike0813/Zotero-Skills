import { JobQueueManager } from "../jobQueue/manager";
import { buildSelectionContext } from "./selectionContext";
import {
  buildWorkflowFinishMessage,
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

type BundleReader = { readText: (entryPath: string) => Promise<string> };

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
  return /has no valid input units after filtering/i.test(
    normalizeErrorMessage(error),
  );
}

function alertWindow(win: _ZoteroTypes.MainWindow, message: string) {
  if (typeof win.alert === "function") {
    win.alert(message);
    return;
  }
  new ztoolkit.ProgressWindow(addon.data.config.addonName)
    .createLine({
      text: message,
      type: "default",
      progress: 100,
    })
    .show();
}

export async function executeWorkflowFromCurrentSelection(args: {
  win: _ZoteroTypes.MainWindow;
  workflow: LoadedWorkflow;
}) {
  const selectedItems = args.win.ZoteroPane?.getSelectedItems?.() || [];
  if (selectedItems.length === 0) {
    alertWindow(args.win, "No items selected.");
    return;
  }

  let requests: unknown[];
  let skippedByFilter = 0;
  let executionContext:
    | Awaited<ReturnType<typeof resolveWorkflowExecutionContext>>
    | null = null;
  try {
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
  } catch (error) {
    if (isNoValidInputUnitsError(error)) {
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
          skipped: 1,
          failureReasons: [],
        }),
      );
      return;
    }
    alertWindow(
      args.win,
      `Workflow ${args.workflow.manifest.label} cannot run: ${normalizeErrorMessage(error)}`,
    );
    return;
  }

  if (requests.length === 0) {
    alertWindow(
      args.win,
      buildWorkflowFinishMessage({
        workflowLabel: args.workflow.manifest.label,
        succeeded: 0,
        failed: 0,
        skipped: Math.max(1, skippedByFilter),
        failureReasons: [],
      }),
    );
    return;
  }

  if (!executionContext) {
    alertWindow(
      args.win,
      `Workflow ${args.workflow.manifest.label} cannot run: execution context is unavailable`,
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
    queue.enqueue({
      workflowId: args.workflow.manifest.id,
      request,
      meta: {
        index,
        runId,
        workflowLabel: args.workflow.manifest.label,
        taskName: resolveTaskNameFromRequest(request, index),
        targetParentID: resolveTargetParentID(request),
      },
    }),
  );

  await queue.waitForIdle();

  let succeeded = 0;
  let failed = 0;
  const failureReasons: string[] = [];
  for (let i = 0; i < jobIds.length; i++) {
    const job = queue.getJob(jobIds[i]);
    if (!job || job.state !== "succeeded") {
      failed += 1;
      if (!job) {
        failureReasons.push(`job-${i}: record missing`);
      } else {
        const reason = job.error || `state=${job.state}`;
        failureReasons.push(`job-${i}: ${reason}`);
      }
      continue;
    }
    const targetParentID =
      typeof job.meta.targetParentID === "number"
        ? job.meta.targetParentID
        : resolveTargetParentID(requests[i]);
    if (!targetParentID) {
      failed += 1;
      failureReasons.push(`job-${i}: cannot resolve target parent`);
      continue;
    }

    const result = job.result as {
      bundleBytes?: Uint8Array;
      requestId?: string;
    };
    if (!result?.requestId) {
      failed += 1;
      failureReasons.push(`job-${i}: missing requestId in execution result`);
      continue;
    }

    let bundlePath = "";
    try {
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
        runResult: job.result,
      });
      succeeded += 1;
    } catch (error) {
      failed += 1;
      failureReasons.push(
        `job-${i} (request_id=${result.requestId}): ${normalizeErrorMessage(error)}`,
      );
    } finally {
      if (bundlePath) {
        await removeFileIfExists(bundlePath);
      }
    }
  }

  alertWindow(
    args.win,
    buildWorkflowFinishMessage({
      workflowLabel: args.workflow.manifest.label,
      succeeded,
      failed,
      skipped: skippedByFilter,
      failureReasons,
    }),
  );
}
