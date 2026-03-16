import { assert } from "chai";
import { handlers } from "../../src/handlers";
import { buildSelectionContext } from "../../src/modules/selectionContext";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import {
  executeApplyResult,
  executeBuildRequests,
} from "../../src/workflows/runtime";
import {
  decodeBase64Utf8,
  joinPath,
  mkTempDir,
  workflowsPath,
  writeUtf8,
} from "./workflow-test-utils";

function parsePayloadData(noteContent: string) {
  const match = String(noteContent || "").match(
    /data-zs-payload=(["'])conversation-note-markdown\1[^>]*data-zs-value=(["'])([^"']+)\2/i,
  );
  if (!match) {
    return null;
  }
  const decoded = decodeBase64Utf8(match[3]);
  return JSON.parse(decoded) as {
    path?: string;
    format?: string;
    content?: string;
    version?: number;
  };
}

async function getWorkflow() {
  const loaded = await loadWorkflowManifests(workflowsPath());
  const workflow = loaded.workflows.find(
    (entry) => entry.manifest.id === "literature-explainer",
  );
  assert.isOk(workflow, "expected literature-explainer workflow");
  return workflow!;
}

describe("workflow: literature-explainer", function () {
  it("loads literature-explainer workflow manifest", async function () {
    const workflow = await getWorkflow();
    assert.equal(workflow.manifest.provider, "skillrunner");
    assert.equal(workflow.manifest.request?.kind, "skillrunner.job.v1");
    assert.equal(
      (workflow.manifest.request?.create as { skill_id?: string } | undefined)
        ?.skill_id,
      "literature-explainer",
    );
    assert.equal(workflow.manifest.execution?.skillrunner_mode, "interactive");
  });

  it("builds request from selected markdown attachment", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Literature Explainer Parent Markdown" },
    });
    const sourceDir = await mkTempDir("zotero-skills-literature-explainer");
    const mdPath = joinPath(sourceDir, "paper.md");
    await writeUtf8(mdPath, "# Source");

    const attachment = await handlers.attachment.createFromPath({
      parent,
      path: mdPath,
      title: "paper.md",
      mimeType: "text/markdown",
    });
    const context = await buildSelectionContext([attachment]);
    const workflow = await getWorkflow();

    const requests = (await executeBuildRequests({
      workflow,
      selectionContext: context,
      executionOptions: {
        providerOptions: {
          engine: "gemini",
        },
      },
    })) as Array<{
      kind: string;
      skill_id: string;
      runtime_options?: { execution_mode?: string };
      input?: { source_path?: string };
      upload_files?: Array<{ key: string; path: string }>;
    }>;

    assert.lengthOf(requests, 1);
    assert.equal(requests[0].kind, "skillrunner.job.v1");
    assert.equal(requests[0].skill_id, "literature-explainer");
    assert.equal(requests[0].runtime_options?.execution_mode, "interactive");
    assert.equal(requests[0].upload_files?.[0]?.key, "source_path");
    assert.equal(requests[0].upload_files?.[0]?.path, mdPath);
    assert.match(String(requests[0].input?.source_path || ""), /^inputs\/source_path\//);
  });

  it("builds request from selected pdf when markdown is unavailable", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Literature Explainer Parent PDF" },
    });
    const sourceDir = await mkTempDir("zotero-skills-literature-explainer");
    const pdfPath = joinPath(sourceDir, "paper.pdf");
    await writeUtf8(pdfPath, "pdf");

    const attachment = await handlers.attachment.createFromPath({
      parent,
      path: pdfPath,
      title: "paper.pdf",
      mimeType: "application/pdf",
    });
    const context = await buildSelectionContext([attachment]);
    const workflow = await getWorkflow();

    const requests = (await executeBuildRequests({
      workflow,
      selectionContext: context,
    })) as Array<{
      upload_files?: Array<{ key: string; path: string }>;
      input?: { source_path?: string };
    }>;

    assert.lengthOf(requests, 1);
    assert.equal(requests[0].upload_files?.[0]?.key, "source_path");
    assert.equal(requests[0].upload_files?.[0]?.path, pdfPath);
    assert.match(String(requests[0].input?.source_path || ""), /^inputs\/source_path\//);
  });

  it("creates a conversation note when note_path is bundle-relative", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Literature Explainer Apply Parent" },
    });
    const notePath = "result/note.paper.md";
    const markdown = "# Summary\n\n- Point A\n- Point B\n";

    const workflow = await getWorkflow();
    const applied = (await executeApplyResult({
      workflow,
      parent,
      bundleReader: {
        async readText(entryPath: string) {
          if (entryPath === "result/result.json") {
            return JSON.stringify({
              note_path: notePath,
            });
          }
          if (entryPath === notePath) {
            return markdown;
          }
          throw new Error(`missing bundle entry: ${entryPath}`);
        },
      },
    })) as { notes?: Zotero.Item[] };

    assert.lengthOf(applied.notes || [], 1);
    const note = Zotero.Items.get((applied.notes || [])[0].id)!;
    const noteContent = note.getNote();
    assert.match(noteContent, /data-zs-note-kind="conversation-note"/);
    assert.match(noteContent, /<h1>Conversation Note \d{10}<\/h1>/);
    assert.match(noteContent, /data-zs-payload="conversation-note-markdown"/);
    assert.match(noteContent, /<div data-zs-view="conversation-note-html">/);

    const payload = parsePayloadData(noteContent);
    assert.isOk(payload);
    assert.equal(payload?.path, notePath);
    assert.equal(payload?.format, "markdown");
    assert.equal(payload?.version, 1);
    assert.equal(payload?.content, markdown);
  });

  it("maps absolute note_path to bundle entry suffix and creates note", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Literature Explainer Absolute note_path Parent" },
    });
    const absolutePath = "C:/tmp/run-1/result/note.abs.md";
    const markdown = "# From Absolute\n\nResolved by bundle suffix.\n";

    const workflow = await getWorkflow();
    const applied = (await executeApplyResult({
      workflow,
      parent,
      bundleReader: {
        async readText(entryPath: string) {
          if (entryPath === "result/result.json") {
            return JSON.stringify({
              note_path: absolutePath,
            });
          }
          if (entryPath === "result/note.abs.md") {
            return markdown;
          }
          throw new Error(`missing bundle entry: ${entryPath}`);
        },
      },
    })) as { notes?: Zotero.Item[] };

    assert.lengthOf(applied.notes || [], 1);
    const note = Zotero.Items.get((applied.notes || [])[0].id)!;
    const payload = parsePayloadData(note.getNote());
    assert.equal(payload?.path, "result/note.abs.md");
    assert.equal(payload?.content, markdown);
  });

  it("prefers uploads-prefixed note_path without forcing artifacts/result rewrite", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Literature Explainer Uploads note_path Parent" },
    });
    const uploadsPath = "uploads/inputs/source_path/artifacts/conversation-note.md";
    const markdown = "# Uploads Path\n\nResolved from bundle-relative uploads path.\n";

    const workflow = await getWorkflow();
    const applied = (await executeApplyResult({
      workflow,
      parent,
      bundleReader: {
        async readText(entryPath: string) {
          if (entryPath === "result/result.json") {
            return JSON.stringify({
              note_path: uploadsPath,
            });
          }
          if (entryPath === uploadsPath) {
            return markdown;
          }
          throw new Error(`missing bundle entry: ${entryPath}`);
        },
      },
    })) as { notes?: Zotero.Item[] };

    assert.lengthOf(applied.notes || [], 1);
    const note = Zotero.Items.get((applied.notes || [])[0].id)!;
    const payload = parsePayloadData(note.getNote());
    assert.equal(payload?.path, uploadsPath);
    assert.equal(payload?.content, markdown);
  });

  it("skips note creation when note_path is empty", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Literature Explainer Empty note_path Parent" },
    });
    const workflow = await getWorkflow();

    const applied = (await executeApplyResult({
      workflow,
      parent,
      bundleReader: {
        async readText(entryPath: string) {
          if (entryPath === "result/result.json") {
            return JSON.stringify({
              note_path: "",
            });
          }
          throw new Error(`unexpected bundle entry: ${entryPath}`);
        },
      },
    })) as { notes?: Zotero.Item[]; skipped?: boolean };

    assert.lengthOf(applied.notes || [], 0);
    assert.equal(applied.skipped, true);
    assert.lengthOf(parent.getNotes() || [], 0);
  });

  it("skips note creation when note_path cannot be resolved in bundle", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Literature Explainer Missing note_path Parent" },
    });
    const workflow = await getWorkflow();

    const applied = (await executeApplyResult({
      workflow,
      parent,
      bundleReader: {
        async readText(entryPath: string) {
          if (entryPath === "result/result.json") {
            return JSON.stringify({
              note_path: "D:/__missing__/note.paper.md",
            });
          }
          throw new Error(`missing bundle entry: ${entryPath}`);
        },
      },
    })) as { notes?: Zotero.Item[]; skipped?: boolean; reason?: string };

    assert.lengthOf(applied.notes || [], 0);
    assert.equal(applied.skipped, true);
    assert.equal(applied.reason, "note_path not found in bundle");
    assert.lengthOf(parent.getNotes() || [], 0);
  });
});
