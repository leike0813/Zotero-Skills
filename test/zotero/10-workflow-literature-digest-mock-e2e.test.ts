import { assert } from "chai";
import fs from "fs/promises";
import path from "path";
import { handlers } from "../../src/handlers";
import { JobQueueManager } from "../../src/jobQueue/manager";
import { buildSelectionContext } from "../../src/modules/selectionContext";
import { SkillRunnerProvider } from "../../src/providers/skillrunnerProvider";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import {
  executeApplyResult,
  executeBuildRequests,
} from "../../src/workflows/runtime";
import singleMarkdownFixture from "../fixtures/selection-context/selection-context-single-markdown.json";
import {
  fixturePath,
  isZoteroRuntime,
  joinPath,
  mkTempDir,
  workflowsPath,
} from "./workflow-test-utils";

const MOCK_SKILLRUNNER_BASE_URL =
  (typeof process !== "undefined" &&
    process.env?.ZOTERO_TEST_SKILLRUNNER_ENDPOINT) ||
  "http://127.0.0.1:8030";

async function isMockSkillRunnerReachable(baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(`${baseUrl}/v1/jobs`, {
      method: "GET",
      signal: controller.signal,
    });
    return response.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

type DynamicImport = (specifier: string) => Promise<any>;
const dynamicImport: DynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as DynamicImport;

type SingleMarkdownFixture = {
  items: {
    attachments: Array<{
      item: {
        title: string;
        data?: {
          contentType?: string;
        };
      };
      parent: {
        itemType: string;
        title: string;
      } | null;
      filePath: string;
    }>;
  };
};

class ZipBundleReader {
  private extractedDirPromise: Promise<string> | null = null;

  constructor(private readonly bundlePath: string) {}

  private readZipEntryInZotero(entryPath: string) {
    const runtime = globalThis as {
      Cc: Record<string, { createInstance: (iface: unknown) => any }>;
      Ci: Record<string, unknown> & {
        nsIZipReader: unknown;
        nsIConverterInputStream: { DEFAULT_REPLACEMENT_CHARACTER: number };
      };
      Zotero: { File: { pathToFile: (targetPath: string) => unknown } };
    };
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

  private async ensureExtractedDirInNode() {
    if (!this.extractedDirPromise) {
      this.extractedDirPromise = (async () => {
        const tmpDir = await mkTempDir("zotero-skills-e2e-bundle");
        const childProcess = await dynamicImport("child_process");
        const util = await dynamicImport("util");
        const execFileAsync = util.promisify(childProcess.execFile);
        const processObj = globalThis as {
          process?: { platform?: string };
        };
        if (processObj.process?.platform === "win32") {
          const command = [
            "Expand-Archive",
            `-LiteralPath '${this.bundlePath.replace(/'/g, "''")}'`,
            `-DestinationPath '${tmpDir.replace(/'/g, "''")}'`,
            "-Force",
          ].join(" ");
          await execFileAsync("powershell", [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            command,
          ]);
          return tmpDir;
        }
        await execFileAsync("unzip", ["-q", this.bundlePath, "-d", tmpDir]);
        return tmpDir;
      })();
    }
    return this.extractedDirPromise;
  }

  async readText(entryPath: string) {
    if (isZoteroRuntime()) {
      return this.readZipEntryInZotero(entryPath);
    }
    const extractedDir = await this.ensureExtractedDirInNode();
    const targetPath = joinPath(
      extractedDir,
      ...entryPath.split("/").filter(Boolean),
    );
    return fs.readFile(targetPath, "utf8");
  }
}

describe("integration: literature-digest with mock skill-runner", function () {
  this.timeout(30000);

  it("rebuilds single-markdown selection and finishes full run with notes written", async function () {
    if (!(await isMockSkillRunnerReachable(MOCK_SKILLRUNNER_BASE_URL))) {
      this.skip();
    }

    const fixture = singleMarkdownFixture as SingleMarkdownFixture;
    const source = fixture.items.attachments[0];
    const parent = await handlers.item.create({
      itemType: source.parent?.itemType || "conferencePaper",
      fields: {
        title: source.parent?.title || "Fixture Parent",
      },
    });
    const attachmentRelPath = source.filePath;
    const attachmentAbsPath = fixturePath("selection-context", attachmentRelPath);
    const attachment = await handlers.attachment.createFromPath({
      parent,
      path: attachmentAbsPath,
      title: source.item.title || path.basename(attachmentRelPath),
      mimeType: source.item.data?.contentType || "text/plain",
    });

    const selectionContext = await buildSelectionContext([attachment]);
    assert.equal(selectionContext.selectionType, "attachment");
    assert.equal(selectionContext.summary.attachmentCount, 1);
    assert.equal(selectionContext.items.attachments[0].item.parentItemID, parent.id);

    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "workflow literature-digest not found");

    const requests = (await executeBuildRequests({
      workflow: workflow!,
      selectionContext,
    })) as Array<{
      kind: string;
      targetParentID: number;
      steps: Array<{
        id: string;
        files?: Array<{ key: string; path: string }>;
        request: { json?: { skill_id?: string; engine?: string } };
      }>;
    }>;
    assert.lengthOf(requests, 1);
    assert.equal(requests[0].kind, "http.steps");
    assert.equal(requests[0].targetParentID, parent.id);
    const createStep = requests[0].steps.find((step) => step.id === "create");
    const uploadStep = requests[0].steps.find((step) => step.id === "upload");
    assert.equal(createStep?.request.json?.skill_id, "literature-digest");
    assert.equal(createStep?.request.json?.engine, "gemini");
    assert.equal(uploadStep?.files?.[0].key, "md_path");
    assert.equal(uploadStep?.files?.[0].path, attachmentAbsPath);

    const provider = new SkillRunnerProvider({
      baseUrl: MOCK_SKILLRUNNER_BASE_URL,
    });
    const queue = new JobQueueManager({
      concurrency: 1,
      executeJob: (job) =>
        provider.execute({
          requestKind: workflow!.manifest.request!.kind,
          request: job.request,
        }),
    });
    const jobId = queue.enqueue({
      workflowId: workflow!.manifest.id,
      request: requests[0],
      meta: { fixture: "selection-context-single-markdown.json" },
    });
    await queue.waitForIdle();
    const finishedJob = queue.getJob(jobId) as {
      state: string;
      result?: {
        status?: string;
        bundleBytes?: Uint8Array;
        requestId?: string;
      };
    } | null;
    assert.isOk(finishedJob);
    assert.equal(finishedJob?.state, "succeeded");
    assert.equal(finishedJob?.result?.status, "succeeded");
    assert.isAbove(finishedJob?.result?.bundleBytes?.length || 0, 0);

    const downloadDir = await mkTempDir("zotero-skills-e2e-download");
    const bundlePath = joinPath(
      downloadDir,
      `${finishedJob?.result?.requestId || "mock"}-run_bundle.zip`,
    );
    await fs.writeFile(
      bundlePath,
      Buffer.from(finishedJob!.result!.bundleBytes as Uint8Array),
    );

    const bundleReader = new ZipBundleReader(bundlePath);
    const applyResult = (await executeApplyResult({
      workflow: workflow!,
      parent,
      bundleReader,
    })) as { notes: Zotero.Item[] };
    assert.lengthOf(applyResult.notes, 2);
    const firstNote = Zotero.Items.get(applyResult.notes[0].id)!;
    const secondNote = Zotero.Items.get(applyResult.notes[1].id)!;
    assert.equal(firstNote.parentItemID, parent.id);
    assert.equal(secondNote.parentItemID, parent.id);
    assert.match(firstNote.getNote(), /Literature Digest/);
    assert.match(secondNote.getNote(), /References JSON/);
    const parentNotes = parent.getNotes();
    assert.include(parentNotes, firstNote.id);
    assert.include(parentNotes, secondNote.id);
  });
});
