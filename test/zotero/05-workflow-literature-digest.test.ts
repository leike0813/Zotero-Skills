import { assert } from "chai";
import { handlers } from "../../src/handlers";
import { buildSelectionContext } from "../../src/modules/selectionContext";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import {
  executeApplyResult,
  executeBuildRequests,
} from "../../src/workflows/runtime";
import { fixturePath, isZoteroRuntime, joinPath, mkTempDir, workflowsPath } from "./workflow-test-utils";

type DynamicImport = (specifier: string) => Promise<any>;
const dynamicImport: DynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as DynamicImport;

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
      Zotero: { File: { pathToFile: (path: string) => unknown } };
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
        const tmpDir = await mkTempDir("zotero-skills-bundle");
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
    const fs = await dynamicImport("fs/promises");
    const extractedDir = await this.ensureExtractedDirInNode();
    const targetPath = joinPath(
      extractedDir,
      ...entryPath.split("/").filter(Boolean),
    );
    return fs.readFile(targetPath, "utf8") as Promise<string>;
  }
}

describe("workflow: literature-digest", function () {
  it("loads literature-digest workflow manifest from workflows directory", async function () {
    const loaded = await loadWorkflowManifests(workflowsPath());

    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "expected literature-digest workflow");
    assert.equal(workflow?.manifest.backend.skillId, "literature-digest");
    assert.equal(workflow?.manifest.backend.engine, "gemini");
    assert.equal(workflow?.manifest.request?.kind, "skillrunner.job.v1");
    assert.equal(
      (workflow?.manifest.request?.create as { parameter?: { language?: string } })
        ?.parameter?.language,
      "en-US",
    );
  });

  it("builds request from selected markdown attachment", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Parent" },
    });

    const mdFile = fixturePath("literature-digest", "example.md");
    const attachment = await handlers.attachment.createFromPath({
      parent,
      path: mdFile,
      title: "example.md",
      mimeType: "text/markdown",
    });

    const context = await buildSelectionContext([attachment]);
    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "missing literature-digest workflow");

    const requests = (await executeBuildRequests({
      workflow: workflow!,
      selectionContext: context,
    })) as Array<{
      kind: string;
      targetParentID: number;
      steps: Array<{
        id: string;
        request: {
          json?: { skill_id?: string; engine?: string; parameter?: { language?: string } };
        };
        files?: Array<{ key: string; path: string }>;
      }>;
    }>;
    assert.lengthOf(requests, 1);
    const request = requests[0];
    const createStep = request.steps.find((step) => step.id === "create");
    const uploadStep = request.steps.find((step) => step.id === "upload");
    assert.equal(request.kind, "http.steps");
    assert.equal(request.targetParentID, parent.id);
    assert.equal(createStep?.request.json?.skill_id, "literature-digest");
    assert.equal(createStep?.request.json?.engine, "gemini");
    assert.equal(createStep?.request.json?.parameter?.language, "en-US");
    assert.equal(uploadStep?.files?.[0].key, "md_path");
    assert.equal(uploadStep?.files?.[0].path, mdFile);
  });

  it("applies bundle by creating digest and references child notes", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Result Parent" },
    });

    const bundle = new ZipBundleReader(
      fixturePath("literature-digest", "run_bundle.zip"),
    );

    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "missing literature-digest workflow");

    const applied = (await executeApplyResult({
      workflow: workflow!,
      parent,
      bundleReader: bundle,
    })) as { notes: Zotero.Item[] };

    assert.lengthOf(applied.notes, 2);
    const firstNote = Zotero.Items.get(applied.notes[0].id)!;
    const secondNote = Zotero.Items.get(applied.notes[1].id)!;
    assert.equal(firstNote.parentItemID, parent.id);
    assert.equal(secondNote.parentItemID, parent.id);
    assert.match(firstNote.getNote(), /Literature Digest/);
    assert.match(secondNote.getNote(), /References JSON/);

    const parentNotes = parent.getNotes();
    assert.include(parentNotes, firstNote.id);
    assert.include(parentNotes, secondNote.id);
  });
});
