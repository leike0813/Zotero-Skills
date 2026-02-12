import { assert } from "chai";
import { handlers } from "../../src/handlers";
import { buildSelectionContext } from "../../src/modules/selectionContext";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import {
  executeApplyResult,
  executeBuildRequests,
} from "../../src/workflows/runtime";
import { executeWorkflowFromCurrentSelection } from "../../src/modules/workflowExecute";
import { ZipBundleReader } from "../../src/workflows/zipBundleReader";
import { fixturePath, workflowsPath } from "./workflow-test-utils";

function parseNoteKind(noteContent: string) {
  const match = String(noteContent || "").match(
    /data-zs-note-kind=(["'])([^"']+)\1/i,
  );
  return match ? match[2] : "";
}

function parseSourceMarkdownItemKey(noteContent: string) {
  const match = String(noteContent || "").match(
    /data-zs-source_markdown_item_key=(["'])([^"']+)\1/i,
  );
  return match ? match[2] : "";
}

describe("workflow: literature-digest", function () {
  it("loads literature-digest workflow manifest from workflows directory", async function () {
    const loaded = await loadWorkflowManifests(workflowsPath());

    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "expected literature-digest workflow");
    assert.equal(workflow?.manifest.request?.kind, "skillrunner.job.v1");
    assert.equal(
      (workflow?.manifest.request?.create as { skill_id?: string } | undefined)
        ?.skill_id,
      "literature-digest",
    );
    assert.equal(
      workflow?.manifest.parameters?.language?.default,
      "zh-CN",
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
      executionOptions: {
        providerOptions: {
          engine: "gemini",
        },
      },
    })) as Array<{
      kind: string;
      targetParentID: number;
      skill_id: string;
      parameter?: { language?: string };
      upload_files: Array<{ key: string; path: string }>;
    }>;
    assert.lengthOf(requests, 1);
    const request = requests[0];
    assert.equal(request.kind, "skillrunner.job.v1");
    assert.equal(request.targetParentID, parent.id);
    assert.equal(request.skill_id, "literature-digest");
    assert.equal(request.parameter?.language, "zh-CN");
    assert.equal(request.upload_files?.[0].key, "md_path");
    assert.equal(request.upload_files?.[0].path, mdFile);
  });

  it("skips build when parent already has digest and references notes", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Skip Parent" },
    });

    const mdFile = fixturePath("literature-digest", "example.md");
    const attachment = await handlers.attachment.createFromPath({
      parent,
      path: mdFile,
      title: "example.md",
      mimeType: "text/markdown",
    });

    await handlers.parent.addNote(parent, {
      content:
        '<div data-zs-note-kind="digest"><h1>Digest</h1></div>',
    });
    await handlers.parent.addNote(parent, {
      content:
        '<div data-zs-note-kind="references"><h1>References</h1></div>',
    });

    const context = await buildSelectionContext([attachment]);
    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "missing literature-digest workflow");

    let thrown: unknown = null;
    try {
      await executeBuildRequests({
        workflow: workflow!,
        selectionContext: context,
      });
    } catch (error) {
      thrown = error;
    }

    assert.isOk(thrown, "expected build request to skip and throw");
    assert.match(
      String(thrown),
      /has no valid input units after filtering/,
    );
  });

  it("skips build when existing notes are recognized by payload markers", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Payload Skip Parent" },
    });

    const mdFile = fixturePath("literature-digest", "example.md");
    const attachment = await handlers.attachment.createFromPath({
      parent,
      path: mdFile,
      title: "example.md",
      mimeType: "text/markdown",
    });

    await handlers.parent.addNote(parent, {
      content:
        '<div><h1>Literature Digest</h1><span data-zs-block="payload" data-zs-payload="digest-markdown" data-zs-value="e30="></span></div>',
    });
    await handlers.parent.addNote(parent, {
      content:
        '<div><h1>References</h1><span data-zs-block="payload" data-zs-payload="references-json" data-zs-value="e30="></span></div>',
    });

    const context = await buildSelectionContext([attachment]);
    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "missing literature-digest workflow");

    let thrown: unknown = null;
    try {
      await executeBuildRequests({
        workflow: workflow!,
        selectionContext: context,
      });
    } catch (error) {
      thrown = error;
    }

    assert.isOk(thrown, "expected build request to skip and throw");
    assert.match(
      String(thrown),
      /has no valid input units after filtering/,
    );
  });

  it("skips build when existing notes are legacy heading-only format", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Legacy Skip Parent" },
    });

    const mdFile = fixturePath("literature-digest", "example.md");
    const attachment = await handlers.attachment.createFromPath({
      parent,
      path: mdFile,
      title: "example.md",
      mimeType: "text/markdown",
    });

    await handlers.parent.addNote(parent, {
      content: "<div><h1>Literature Digest</h1><p>legacy content</p></div>",
    });
    await handlers.parent.addNote(parent, {
      content: "<div><h1>References JSON</h1><pre>[]</pre></div>",
    });

    const context = await buildSelectionContext([attachment]);
    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "missing literature-digest workflow");

    let thrown: unknown = null;
    try {
      await executeBuildRequests({
        workflow: workflow!,
        selectionContext: context,
      });
    } catch (error) {
      thrown = error;
    }

    assert.isOk(thrown, "expected build request to skip and throw");
    assert.match(
      String(thrown),
      /has no valid input units after filtering/,
    );
  });

  it("skips build when legacy notes use paragraph-strong headings", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Legacy Paragraph Skip Parent" },
    });

    const mdFile = fixturePath("literature-digest", "example.md");
    const attachment = await handlers.attachment.createFromPath({
      parent,
      path: mdFile,
      title: "example.md",
      mimeType: "text/markdown",
    });

    await handlers.parent.addNote(parent, {
      content:
        "<div><p><strong>Literature Digest</strong></p><p>legacy paragraph</p></div>",
    });
    await handlers.parent.addNote(parent, {
      content:
        "<div><p><strong>References JSON</strong></p><pre>[]</pre></div>",
    });

    const context = await buildSelectionContext([attachment]);
    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "missing literature-digest workflow");

    let thrown: unknown = null;
    try {
      await executeBuildRequests({
        workflow: workflow!,
        selectionContext: context,
      });
    } catch (error) {
      thrown = error;
    }

    assert.isOk(thrown, "expected build request to skip and throw");
    assert.match(
      String(thrown),
      /has no valid input units after filtering/,
    );
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
    assert.match(firstNote.getNote(), /<h1>Digest<\/h1>/);
    assert.match(firstNote.getNote(), /data-zs-payload="digest-markdown"/);
    assert.match(firstNote.getNote(), /data-zs-value="/);
    assert.match(secondNote.getNote(), /<h1>References<\/h1>/);
    assert.match(secondNote.getNote(), /<table data-zs-view="references-table">/);
    assert.match(secondNote.getNote(), /data-zs-payload="references-json"/);
    assert.match(secondNote.getNote(), /data-zs-value="/);

    const parentNotes = parent.getNotes();
    assert.include(parentNotes, firstNote.id);
    assert.include(parentNotes, secondNote.id);
  });

  it("writes hidden source metadata with markdown attachment itemKey when request is provided", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Source Metadata Parent" },
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
      sourceAttachmentPaths?: string[];
      upload_files?: Array<{ key: string; path: string }>;
    }>;
    assert.lengthOf(requests, 1);

    const bundle = new ZipBundleReader(
      fixturePath("literature-digest", "run_bundle.zip"),
    );
    const applied = (await executeApplyResult({
      workflow: workflow!,
      parent,
      bundleReader: bundle,
      request: requests[0],
    })) as { notes: Zotero.Item[] };

    assert.lengthOf(applied.notes, 2);
    const digestNote = Zotero.Items.get(applied.notes[0].id)!;
    const referencesNote = Zotero.Items.get(applied.notes[1].id)!;
    assert.match(digestNote.getNote(), /data-zs-block="meta"/);
    assert.match(digestNote.getNote(), /data-zs-meta="source-markdown"/);
    assert.equal(
      parseSourceMarkdownItemKey(digestNote.getNote()),
      attachment.key,
    );
    assert.match(digestNote.getNote(), /data-zs-payload="digest-markdown"/);
    assert.match(referencesNote.getNote(), /data-zs-payload="references-json"/);
  });

  it("continues apply when source markdown itemKey cannot be resolved", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Source Metadata Fallback Parent" },
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
      request: {
        targetParentID: parent.id,
        sourceAttachmentPaths: ["D:/not-found/example.md"],
        upload_files: [{ key: "md_path", path: "D:/not-found/example.md" }],
      },
    })) as { notes: Zotero.Item[] };

    assert.lengthOf(applied.notes, 2);
    const digestNote = Zotero.Items.get(applied.notes[0].id)!;
    const referencesNote = Zotero.Items.get(applied.notes[1].id)!;
    assert.notMatch(digestNote.getNote(), /data-zs-source_markdown_item_key=/);
    assert.match(digestNote.getNote(), /data-zs-payload="digest-markdown"/);
    assert.match(referencesNote.getNote(), /data-zs-payload="references-json"/);
  });

  it("upserts existing generated notes and keeps each kind unique", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Upsert Parent" },
    });

    await handlers.parent.addNote(parent, {
      content:
        '<div data-zs-note-kind="digest"><h1>Digest</h1><p>old-a</p></div>',
    });
    await handlers.parent.addNote(parent, {
      content:
        '<div data-zs-note-kind="digest"><h1>Digest</h1><p>old-b</p></div>',
    });

    const bundle = new ZipBundleReader(
      fixturePath("literature-digest", "run_bundle.zip"),
    );
    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "missing literature-digest workflow");

    await executeApplyResult({
      workflow: workflow!,
      parent,
      bundleReader: bundle,
    });

    const noteItems = (parent.getNotes() || [])
      .map((id) => Zotero.Items.get(id))
      .filter(Boolean) as Zotero.Item[];
    const generated = noteItems.filter((note) =>
      /data-zs-note-kind=/.test(note.getNote()),
    );
    const digestNotes = generated.filter(
      (note) => parseNoteKind(note.getNote()) === "digest",
    );
    const referencesNotes = generated.filter(
      (note) => parseNoteKind(note.getNote()) === "references",
    );

    assert.lengthOf(digestNotes, 1);
    assert.lengthOf(referencesNotes, 1);
    assert.match(
      digestNotes[0].getNote(),
      /data-zs-payload="digest-markdown"/,
    );
    assert.match(
      referencesNotes[0].getNote(),
      /data-zs-payload="references-json"/,
    );
  });

  it("skips workflow execution before backend call when idempotent notes exist", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Execute Skip Parent" },
    });

    const mdFile = fixturePath("literature-digest", "example.md");
    const attachment = await handlers.attachment.createFromPath({
      parent,
      path: mdFile,
      title: "example.md",
      mimeType: "text/markdown",
    });

    await handlers.parent.addNote(parent, {
      content:
        '<div data-zs-note-kind="digest"><h1>Digest</h1></div>',
    });
    await handlers.parent.addNote(parent, {
      content:
        '<div data-zs-note-kind="references"><h1>References</h1></div>',
    });

    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "missing literature-digest workflow");

    const runtime = globalThis as { fetch?: typeof fetch };
    const originalFetch = runtime.fetch;
    let fetchCalls = 0;
    runtime.fetch = (async () => {
      fetchCalls += 1;
      throw new Error("fetch should not be called when skipped");
    }) as typeof fetch;

    const alerts: string[] = [];
    const fakeWindow = {
      ZoteroPane: {
        getSelectedItems: () => [attachment],
      },
      alert: (message: string) => {
        alerts.push(message);
      },
    } as unknown as _ZoteroTypes.MainWindow;

    try {
      await executeWorkflowFromCurrentSelection({
        win: fakeWindow,
        workflow: workflow!,
      });
    } finally {
      runtime.fetch = originalFetch;
    }

    assert.equal(fetchCalls, 0, "backend fetch should be skipped");
    assert.lengthOf(alerts, 1);
    assert.include(alerts[0], "succeeded=0");
    assert.include(alerts[0], "failed=0");
    assert.include(alerts[0], "skipped=1");
  });

  it("reports real skipped count when all selected inputs are filtered out", async function () {
    const parentA = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Execute Skip Parent A" },
    });
    const parentB = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Execute Skip Parent B" },
    });

    const mdFile = fixturePath("literature-digest", "example.md");
    await handlers.attachment.createFromPath({
      parent: parentA,
      path: mdFile,
      title: "a.md",
      mimeType: "text/markdown",
    });
    await handlers.attachment.createFromPath({
      parent: parentB,
      path: mdFile,
      title: "b.md",
      mimeType: "text/markdown",
    });

    for (const parent of [parentA, parentB]) {
      await handlers.parent.addNote(parent, {
        content:
          '<div data-zs-note-kind="digest"><h1>Digest</h1></div>',
      });
      await handlers.parent.addNote(parent, {
        content:
          '<div data-zs-note-kind="references"><h1>References</h1></div>',
      });
    }

    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "missing literature-digest workflow");

    const runtime = globalThis as { fetch?: typeof fetch };
    const originalFetch = runtime.fetch;
    let fetchCalls = 0;
    runtime.fetch = (async () => {
      fetchCalls += 1;
      throw new Error("fetch should not be called when skipped");
    }) as typeof fetch;

    const alerts: string[] = [];
    const fakeWindow = {
      ZoteroPane: {
        getSelectedItems: () => [parentA, parentB],
      },
      alert: (message: string) => {
        alerts.push(message);
      },
    } as unknown as _ZoteroTypes.MainWindow;

    try {
      await executeWorkflowFromCurrentSelection({
        win: fakeWindow,
        workflow: workflow!,
      });
    } finally {
      runtime.fetch = originalFetch;
    }

    assert.equal(fetchCalls, 0, "backend fetch should be skipped");
    assert.lengthOf(alerts, 1);
    assert.include(alerts[0], "succeeded=0");
    assert.include(alerts[0], "failed=0");
    assert.include(alerts[0], "skipped=2");
  });

  it("skips build for selected parent item when idempotent notes already exist", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Parent Selection Skip" },
    });

    const mdFile = fixturePath("literature-digest", "example.md");
    await handlers.attachment.createFromPath({
      parent,
      path: mdFile,
      title: "example.md",
      mimeType: "text/markdown",
    });

    await handlers.parent.addNote(parent, {
      content:
        '<div data-zs-note-kind="digest"><h1>Digest</h1></div>',
    });
    await handlers.parent.addNote(parent, {
      content:
        '<div data-zs-note-kind="references"><h1>References</h1></div>',
    });

    const context = await buildSelectionContext([parent]);
    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "missing literature-digest workflow");

    let thrown: unknown = null;
    try {
      await executeBuildRequests({
        workflow: workflow!,
        selectionContext: context,
      });
    } catch (error) {
      thrown = error;
    }

    assert.isOk(thrown, "expected parent-selection build request to skip");
    assert.match(
      String(thrown),
      /has no valid input units after filtering/,
    );
  });

  it("reports skipped count for mixed parent selection", async function () {
    const parentSkipped = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Mixed Skip Parent A" },
    });
    const parentRun = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Workflow Mixed Skip Parent B" },
    });

    const mdFile = fixturePath("literature-digest", "example.md");
    await handlers.attachment.createFromPath({
      parent: parentSkipped,
      path: mdFile,
      title: "a.md",
      mimeType: "text/markdown",
    });
    await handlers.attachment.createFromPath({
      parent: parentRun,
      path: mdFile,
      title: "b.md",
      mimeType: "text/markdown",
    });

    await handlers.parent.addNote(parentSkipped, {
      content:
        '<div data-zs-note-kind="digest"><h1>Digest</h1></div>',
    });
    await handlers.parent.addNote(parentSkipped, {
      content:
        '<div data-zs-note-kind="references"><h1>References</h1></div>',
    });

    const context = await buildSelectionContext([parentSkipped, parentRun]);
    const loaded = await loadWorkflowManifests(workflowsPath());
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(workflow, "missing literature-digest workflow");

    const requests = (await executeBuildRequests({
      workflow: workflow!,
      selectionContext: context,
    })) as unknown as Array<unknown> & {
      __stats?: { skippedUnits?: number; totalUnits?: number };
    };

    assert.lengthOf(requests, 1);
    assert.equal(requests.__stats?.totalUnits, 2);
    assert.equal(requests.__stats?.skippedUnits, 1);
  });
});
