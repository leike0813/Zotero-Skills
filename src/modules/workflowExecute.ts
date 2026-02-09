import { JobQueueManager } from "../jobQueue/manager";
import { buildSelectionContext } from "./selectionContext";
import { SkillRunnerProvider } from "../providers/skillrunnerProvider";
import { getPref } from "../utils/prefs";
import { executeApplyResult, executeBuildRequests } from "../workflows/runtime";
import type { LoadedWorkflow } from "../workflows/types";

const DEFAULT_SKILLRUNNER_ENDPOINT = "http://127.0.0.1:8030";

type DynamicImport = (specifier: string) => Promise<any>;
const dynamicImport: DynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as DynamicImport;

function getPathSeparator() {
  return Zotero.isWin ? "\\" : "/";
}

function joinPath(...segments: string[]) {
  const runtime = globalThis as { PathUtils?: { join?: (...parts: string[]) => string } };
  if (typeof runtime.PathUtils?.join === "function") {
    return runtime.PathUtils.join(...segments.filter(Boolean));
  }
  const firstNonEmpty = segments.find((segment) => String(segment || "").length > 0) || "";
  const isPosixAbsolute = firstNonEmpty.startsWith("/");
  const driveMatch = firstNonEmpty.match(/^([A-Za-z]:)[\\/]?/);
  const drivePrefix = driveMatch?.[1] || "";
  const normalized = segments
    .flatMap((segment) => String(segment || "").split(/[\\/]+/))
    .filter(Boolean);
  if (normalized.length === 0) {
    if (drivePrefix) {
      return `${drivePrefix}${getPathSeparator()}`;
    }
    return isPosixAbsolute ? getPathSeparator() : "";
  }
  if (
    drivePrefix &&
    normalized[0].toLowerCase() === drivePrefix.toLowerCase()
  ) {
    normalized.shift();
  }
  const joined = normalized.join(getPathSeparator());
  if (drivePrefix) {
    return `${drivePrefix}${getPathSeparator()}${joined}`;
  }
  if (isPosixAbsolute) {
    return `${getPathSeparator()}${joined}`;
  }
  return joined;
}

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

class ZipBundleReader {
  constructor(private readonly bundlePath: string) {}

  async readText(entryPath: string) {
    const runtime = globalThis as {
      Cc?: Record<string, { createInstance: (iface: unknown) => any }>;
      Ci?: Record<string, unknown> & {
        nsIZipReader?: unknown;
        nsIConverterInputStream?: { DEFAULT_REPLACEMENT_CHARACTER: number };
      };
      Zotero?: { File?: { pathToFile: (targetPath: string) => unknown } };
    };
    if (
      !runtime.Cc ||
      !runtime.Ci?.nsIZipReader ||
      !runtime.Ci?.nsIConverterInputStream ||
      !runtime.Zotero?.File?.pathToFile
    ) {
      throw new Error("Zip bundle reader is unavailable in current runtime");
    }

    const zipReader = runtime.Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(
      runtime.Ci.nsIZipReader,
    );
    zipReader.open(runtime.Zotero.File.pathToFile(this.bundlePath));
    const stream = zipReader.getInputStream(entryPath);
    const converter = runtime.Cc[
      "@mozilla.org/intl/converter-input-stream;1"
    ].createInstance(runtime.Ci.nsIConverterInputStream);
    converter.init(
      stream,
      "UTF-8",
      0,
      runtime.Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER,
    );
    let output = "";
    const chunk = { value: "" };
    while (converter.readString(0xffffffff, chunk) !== 0) {
      output += chunk.value;
    }
    converter.close();
    zipReader.close();
    return output;
  }
}

function resolveSkillRunnerEndpoint() {
  const raw = String(getPref("skillRunnerEndpoint") || "").trim();
  return raw || DEFAULT_SKILLRUNNER_ENDPOINT;
}

function resolveTargetParentID(request: unknown) {
  const parsed = request as { targetParentID?: number };
  return typeof parsed.targetParentID === "number" ? parsed.targetParentID : null;
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
  try {
    const selectionContext = await buildSelectionContext(selectedItems);
    requests = await executeBuildRequests({
      workflow: args.workflow,
      selectionContext,
    });
  } catch (error) {
    alertWindow(
      args.win,
      `Workflow ${args.workflow.manifest.label} cannot run: ${String(error)}`,
    );
    return;
  }

  if (requests.length === 0) {
    alertWindow(args.win, `Workflow ${args.workflow.manifest.label} has no jobs.`);
    return;
  }

  const endpoint = resolveSkillRunnerEndpoint();
  const provider = new SkillRunnerProvider({ baseUrl: endpoint });
  const queue = new JobQueueManager({
    concurrency: 1,
    executeJob: (job) =>
      provider.execute({
        requestKind: args.workflow.manifest.request?.kind || "skillrunner.job.v1",
        request: job.request,
      }),
  });

  const jobIds = requests.map((request, index) =>
    queue.enqueue({
      workflowId: args.workflow.manifest.id,
      request,
      meta: { index },
    }),
  );

  await queue.waitForIdle();

  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < jobIds.length; i++) {
    const job = queue.getJob(jobIds[i]);
    if (!job || job.state !== "succeeded") {
      failed += 1;
      continue;
    }
    const targetParentID = resolveTargetParentID(requests[i]);
    if (!targetParentID) {
      failed += 1;
      continue;
    }

    const result = job.result as { bundleBytes?: Uint8Array; requestId?: string };
    if (!result?.bundleBytes || !result.requestId) {
      failed += 1;
      continue;
    }

    const bundlePath = buildTempBundlePath(result.requestId);
    try {
      await writeBytes(bundlePath, result.bundleBytes);
      const bundleReader = new ZipBundleReader(bundlePath);
      await executeApplyResult({
        workflow: args.workflow,
        parent: targetParentID,
        bundleReader,
        runResult: job.result,
      });
      succeeded += 1;
    } catch {
      failed += 1;
    } finally {
      await removeFileIfExists(bundlePath);
    }
  }

  alertWindow(
    args.win,
    `Workflow ${args.workflow.manifest.label} finished. succeeded=${succeeded}, failed=${failed}`,
  );
}
