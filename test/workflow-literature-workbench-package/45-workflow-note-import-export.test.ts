import { assert } from "chai";
import { getSelectedImportCandidateForKind } from "../../workflows_builtin/literature-workbench-package/import-notes/hooks/applyResult.mjs";
import { handlers } from "../../src/handlers";
import { buildSelectionContext } from "../../src/modules/selectionContext";
import { installWorkflowEditorSessionOverrideForTests } from "../../src/modules/workflowEditorHost";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import {
  executeApplyResult,
  executeBuildRequests,
} from "../../src/workflows/runtime";
import {
  decodeBase64Utf8,
  encodeBase64Utf8,
  isZoteroRuntime,
  joinPath,
  mkTempDir,
  listDirNames,
  readUtf8,
  workflowsPath,
  writeUtf8,
} from "../zotero/workflow-test-utils";

type LoadedWorkflow = Awaited<ReturnType<typeof loadWorkflowManifests>>["workflows"][number];

function renderPayloadBlock(payloadType: string, payload: unknown) {
  return `<span data-zs-block="payload" data-zs-payload="${payloadType}" data-zs-version="1" data-zs-encoding="base64" data-zs-value="${encodeBase64Utf8(JSON.stringify(payload))}"></span>`;
}

function renderPlainMarkdownPayloadBlock(payloadType: string, markdown: string) {
  return `<span data-zs-block="payload" data-zs-payload="${payloadType}" data-zs-version="1" data-zs-encoding="base64" data-zs-value="${encodeBase64Utf8(markdown)}"></span>`;
}

function buildDigestNoteContent(markdown: string) {
  return [
    '<div data-zs-note-kind="digest">',
    "<h1>Digest</h1>",
    '<div data-zs-view="digest-html"><p>Digest HTML</p></div>',
    renderPayloadBlock("digest-markdown", {
      version: 1,
      entry: "artifacts/digest.md",
      format: "markdown",
      content: markdown,
    }),
    "</div>",
  ].join("\n");
}

function buildNativeReferencesArtifact() {
  return [
    {
      author: ["Alice Zhang"],
      title: "Structured Reference",
      year: 2024,
      raw: "Alice Zhang. Structured Reference. 2024.",
      confidence: 0.92,
    },
  ];
}

function buildSchemaWrappedReferencesArtifact() {
  return {
    items: buildNativeReferencesArtifact(),
  };
}

function buildReferencesPayloadWrapper() {
  return {
    version: 1,
    entry: "artifacts/references.json",
    format: "json",
    references: buildNativeReferencesArtifact(),
  };
}

function buildReferencesNoteContent() {
  return [
    '<div data-zs-note-kind="references">',
    "<h1>References</h1>",
    '<table data-zs-view="references-table"><tbody><tr><td>1</td></tr></tbody></table>',
    renderPayloadBlock("references-json", buildReferencesPayloadWrapper()),
    "</div>",
  ].join("\n");
}

function buildNativeCitationArtifact() {
  return {
    meta: {
      language: "en",
      scope: {
        section_title: "Results",
        line_start: 1,
        line_end: 12,
      },
    },
    items: [],
    unmapped_mentions: [],
    summary: "Summary text",
    timeline: {
      early: {},
      mid: {},
      recent: {},
    },
    report_md: "# Citation Analysis\n\nStructured report",
  };
}

function buildCitationPayloadWrapper() {
  return {
    version: 1,
    entry: "artifacts/citation_analysis.json",
    format: "json",
    citation_analysis: buildNativeCitationArtifact(),
  };
}

function buildCitationNoteContent() {
  return [
    '<div data-zs-note-kind="citation-analysis">',
    "<h1>Citation Analysis</h1>",
    '<div data-zs-view="citation-analysis-html"><p>Structured report</p></div>',
    renderPayloadBlock("citation-analysis-json", buildCitationPayloadWrapper()),
    "</div>",
  ].join("\n");
}

function buildConversationNoteContent(
  markdown: string,
  entry = "artifacts/conversation-note.md",
  title = "Conversation Note 2604052113",
) {
  return [
    '<div data-zs-note-kind="conversation-note">',
    `<h1>${title}</h1>`,
    '<div data-zs-view="conversation-note-html"><p>Conversation HTML</p></div>',
    renderPayloadBlock("conversation-note-markdown", {
      version: 1,
      path: entry,
      format: "markdown",
      content: markdown,
    }),
    "</div>",
  ].join("\n");
}

async function getWorkflow(workflowId: string): Promise<LoadedWorkflow> {
  const loaded = await loadWorkflowManifests(workflowsPath());
  const workflow = loaded.workflows.find((entry) => entry.manifest.id === workflowId);
  assert.isOk(
    workflow,
    `workflow ${workflowId} not found; loaded=${loaded.workflows.map((entry) => entry.manifest.id).join(",")} warnings=${JSON.stringify(loaded.warnings)} errors=${JSON.stringify(loaded.errors)}`,
  );
  return workflow!;
}

function parsePayload(noteContent: string, payloadType: string) {
  const match = String(noteContent || "").match(
    new RegExp(
      `data-zs-payload=(["'])${payloadType}\\1[^>]*data-zs-value=(["'])([^"']+)\\2`,
      "i",
    ),
  );
  assert.isOk(match, `payload ${payloadType} should exist`);
  return JSON.parse(decodeBase64Utf8(match![3]));
}

const describeImportEditorSuite = isZoteroRuntime() ? describe.skip : describe;

describe("workflow: literature-workbench import/export notes", function () {
  this.timeout(30000);

  afterEach(function () {
    installWorkflowEditorSessionOverrideForTests(null);
  });

  it("maps citation-analysis UI state to citationAnalysis selection slot", function () {
    const digest = { sourcePath: "D:/imports/digest.md" };
    const references = { sourcePath: "D:/imports/references.json" };
    const citationAnalysis = { sourcePath: "D:/imports/citation_analysis.json" };
    assert.equal(
      getSelectedImportCandidateForKind(
        { digest, references, citationAnalysis },
        "digest",
      ),
      digest,
    );
    assert.equal(
      getSelectedImportCandidateForKind(
        { digest, references, citationAnalysis },
        "references",
      ),
      references,
    );
    assert.equal(
      getSelectedImportCandidateForKind(
        { digest, references, citationAnalysis },
        "citation-analysis",
      ),
      citationAnalysis,
    );
  });

  it("loads export-notes and import-notes from literature-workbench-package", async function () {
    const loaded = await loadWorkflowManifests(workflowsPath());
    assert.isOk(loaded.workflows.find((entry) => entry.manifest.id === "export-notes"));
    assert.isOk(loaded.workflows.find((entry) => entry.manifest.id === "import-notes"));
  });

  it("builds a single aggregated export request across multiple selected units", async function () {
    const workflow = await getWorkflow("export-notes");
    const parentA = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Export Parent A" },
    });
    const parentB = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Export Parent B" },
    });
    const parentInvalid = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Export Parent Invalid" },
    });

    await handlers.parent.addNote(parentA, {
      content: buildDigestNoteContent("# Digest A"),
    });
    const referencesNote = await handlers.parent.addNote(parentB, {
      content: buildReferencesNoteContent(),
    });

    const selection = await buildSelectionContext([parentA, parentB, parentInvalid, referencesNote]);
    const requests = (await executeBuildRequests({
      workflow,
      selectionContext: selection,
    })) as Array<{
      kind: string;
      exportCandidates?: Array<{ kind?: string; parentItemID?: number }>;
    }>;

    assert.lengthOf(requests, 1);
    assert.equal(requests[0].kind, "pass-through.run.v1");
    assert.deepEqual(
      (requests[0].exportCandidates || []).map((entry) => ({
        kind: entry.kind,
        parentItemID: entry.parentItemID,
      })),
      [
        { kind: "digest", parentItemID: parentA.id },
        { kind: "references", parentItemID: parentB.id },
      ],
    );
  });

  it("exports decoded note artifacts into parent title + itemKey folders", async function () {
    const workflow = await getWorkflow("export-notes");
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Export Bundle Parent" },
    });
    await handlers.parent.addNote(parent, {
      content: buildDigestNoteContent("# Digest Export"),
    });
    await handlers.parent.addNote(parent, {
      content: buildReferencesNoteContent(),
    });
    await handlers.parent.addNote(parent, {
      content: buildCitationNoteContent(),
    });

    const selection = await buildSelectionContext([parent]);
    const requests = (await executeBuildRequests({
      workflow,
      selectionContext: selection,
    })) as Array<Record<string, unknown>>;
    assert.lengthOf(requests, 1);

    const exportRoot = await mkTempDir("reference-workbench-export");
    const baseHostApi = (await import("../../src/workflows/hostApi")).createWorkflowHostApi();
    const hostApi = {
      ...baseHostApi,
      file: {
        ...baseHostApi.file,
        async pickDirectory() {
          return exportRoot;
        },
      },
    };

    await executeApplyResult({
      workflow,
      parent,
      request: requests[0],
      bundleReader: { readText: async () => "" },
      runtime: {
        hostApi: hostApi as any,
      },
    });

    const targetDir = joinPath(exportRoot, `${parent.getField("title")} [${parent.key}]`);
    assert.equal(await readUtf8(joinPath(targetDir, "digest.md")), "# Digest Export");
    const referencesJson = JSON.parse(await readUtf8(joinPath(targetDir, "references.json")));
    assert.deepEqual(referencesJson, buildNativeReferencesArtifact());
    const citationJson = JSON.parse(
      await readUtf8(joinPath(targetDir, "citation_analysis.json")),
    );
    assert.deepEqual(citationJson, buildNativeCitationArtifact());
    assert.equal(
      await readUtf8(joinPath(targetDir, "citation_analysis.md")),
      "# Citation Analysis\n\nStructured report",
    );
  });

  it("exports conversation notes through the unified markdown-backed note codec", async function () {
    const workflow = await getWorkflow("export-notes");
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Conversation Export Parent" },
    });
    const conversationMarkdown = "# Conversation Export\n\n- one\n- two\n";
    const conversationNote = await handlers.parent.addNote(parent, {
      title: "Conversation Note 2604052113",
      content: buildConversationNoteContent(conversationMarkdown),
    });

    const selection = await buildSelectionContext([conversationNote]);
    const requests = (await executeBuildRequests({
      workflow,
      selectionContext: selection,
    })) as Array<Record<string, unknown>>;
    assert.lengthOf(requests, 1);

    const exportRoot = await mkTempDir("literature-workbench-export-conversation");
    const baseHostApi = (await import("../../src/workflows/hostApi")).createWorkflowHostApi();
    const hostApi = {
      ...baseHostApi,
      file: {
        ...baseHostApi.file,
        async pickDirectory() {
          return exportRoot;
        },
      },
    };

    await executeApplyResult({
      workflow,
      parent,
      request: requests[0],
      bundleReader: { readText: async () => "" },
      runtime: {
        hostApi: hostApi as any,
      },
    });

    const targetDir = joinPath(exportRoot, `${parent.getField("title")} [${parent.key}]`);
    const exportedFiles = await listDirNames(targetDir);
    const markdownFile = exportedFiles.find((entry) => /\.md$/i.test(entry));
    assert.isOk(markdownFile, `expected markdown export in ${targetDir}; files=${exportedFiles.join(",")}`);
    assert.equal(
      await readUtf8(joinPath(targetDir, markdownFile!)),
      conversationMarkdown,
    );
  });

  it("sanitizes title-derived export file names for conversation and custom notes", async function () {
    const workflow = await getWorkflow("export-notes");
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Unsafe Export Parent" },
    });
    const conversationMarkdown = "# Unsafe Title\n\ncontent\n";
    const customMarkdown = "# Custom Export\n\nbody\n";
    const conversationNote = await handlers.parent.addNote(parent, {
      title: 'Conversation: Note? 260405/2113*',
      content: buildConversationNoteContent(
        conversationMarkdown,
        "artifacts/conversation-note.md",
        'Conversation: Note? 260405/2113*',
      ),
    });
    const customNote = await handlers.parent.addNote(parent, {
      title: 'Custom <Draft> "v1"|final',
      content: [
        '<div data-zs-note-kind="custom">',
        '<h1>Custom &lt;Draft&gt; "v1"|final</h1>',
        '<div data-zs-view="custom-html"><p>Custom Export</p></div>',
        renderPlainMarkdownPayloadBlock("custom-markdown", customMarkdown),
        "</div>",
      ].join("\n"),
    });

    const selection = await buildSelectionContext([conversationNote, customNote]);
    const requests = (await executeBuildRequests({
      workflow,
      selectionContext: selection,
    })) as Array<Record<string, unknown>>;
    assert.lengthOf(requests, 1);

    const exportRoot = await mkTempDir("literature-workbench-export-sanitized");
    const baseHostApi = (await import("../../src/workflows/hostApi")).createWorkflowHostApi();
    const hostApi = {
      ...baseHostApi,
      file: {
        ...baseHostApi.file,
        async pickDirectory() {
          return exportRoot;
        },
      },
    };

    await executeApplyResult({
      workflow,
      parent,
      request: requests[0],
      bundleReader: { readText: async () => "" },
      runtime: {
        hostApi: hostApi as any,
      },
    });

    const targetDir = joinPath(exportRoot, `${parent.getField("title")} [${parent.key}]`);
    const exportedFiles = await listDirNames(targetDir);
    assert.include(exportedFiles, "Conversation_ Note_ 260405_2113_.md");
    assert.include(exportedFiles, "Custom _Draft_ _v1__final.md");
    assert.equal(
      await readUtf8(joinPath(targetDir, "Conversation_ Note_ 260405_2113_.md")),
      conversationMarkdown,
    );
    assert.equal(
      await readUtf8(joinPath(targetDir, "Custom _Draft_ _v1__final.md")),
      customMarkdown,
    );
  });

  it("requires exactly one parent item for import-notes", async function () {
    const workflow = await getWorkflow("import-notes");
    const parentA = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Import Parent A" },
    });
    const parentB = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Import Parent B" },
    });

    let thrown: unknown = null;
    try {
      await executeBuildRequests({
        workflow,
        selectionContext: await buildSelectionContext([parentA, parentB]),
      });
    } catch (error) {
      thrown = error;
    }
    assert.isOk(thrown, "multiple parent selection should be rejected");

    const note = await handlers.parent.addNote(parentA, {
      content: buildDigestNoteContent("# Digest"),
    });
    thrown = null;
    try {
      await executeBuildRequests({
        workflow,
        selectionContext: await buildSelectionContext([note]),
      });
    } catch (error) {
      thrown = error;
    }
    assert.isOk(thrown, "note selection should be rejected");
  });

  describeImportEditorSuite("import-notes editor-driven flows", function () {
    it("imports selected digest/references/citation files and upserts generated notes", async function () {
      const workflow = await getWorkflow("import-notes");
      const parent = await handlers.item.create({
        itemType: "journalArticle",
        fields: { title: "Import Apply Parent" },
      });

      installWorkflowEditorSessionOverrideForTests(async () => ({
        saved: true,
        result: {
          digest: {
            sourcePath: "D:/imports/digest.md",
            markdown: "# Imported Digest\n\nBody",
          },
          references: {
            sourcePath: "D:/imports/references.json",
            payload: {
              version: 1,
              entry: "D:/imports/references.json",
              format: "json",
              references: buildNativeReferencesArtifact(),
            },
          },
          citationAnalysis: {
            sourcePath: "D:/imports/citation_analysis.json",
            payload: {
              version: 1,
              entry: "D:/imports/citation_analysis.json",
              format: "json",
              citation_analysis: buildNativeCitationArtifact(),
            },
          },
        },
      }));

      await executeApplyResult({
        workflow,
        parent,
        bundleReader: { readText: async () => "" },
      });

      const noteIds = parent.getNotes();
      assert.lengthOf(noteIds, 3);
      const notes = noteIds.map((id) => Zotero.Items.get(id)!);
      const digest = notes.find((entry) => /data-zs-payload="digest-markdown"/.test(entry.getNote()));
      const references = notes.find((entry) =>
        /data-zs-payload="references-json"/.test(entry.getNote()),
      );
      const citation = notes.find((entry) =>
        /data-zs-payload="citation-analysis-json"/.test(entry.getNote()),
      );
      assert.isOk(digest);
      assert.isOk(references);
      assert.isOk(citation);
      assert.equal(parsePayload(digest!.getNote(), "digest-markdown").content, "# Imported Digest\n\nBody");
      const importedReferencesPayload = parsePayload(references!.getNote(), "references-json");
      assert.deepEqual(importedReferencesPayload, {
        ...buildReferencesPayloadWrapper(),
        entry: "D:/imports/references.json",
      });
      const importedCitationPayload = parsePayload(
        citation!.getNote(),
        "citation-analysis-json",
      );
      assert.deepEqual(importedCitationPayload, {
        ...buildCitationPayloadWrapper(),
        entry: "D:/imports/citation_analysis.json",
      });
    });

    it("imports a native citation analysis artifact and rejects wrapper-shaped citation imports", async function () {
      const workflow = await getWorkflow("import-notes");
      const parent = await handlers.item.create({
        itemType: "journalArticle",
        fields: { title: "Import Native Citation Parent" },
      });

      installWorkflowEditorSessionOverrideForTests(async () => ({
        saved: true,
        result: {
          citationAnalysis: {
            sourcePath: "Y:/Code/Python/Skill-Runner/data/runs/sample/citation_analysis.json",
            payload: {
              version: 1,
              entry: "Y:/Code/Python/Skill-Runner/data/runs/sample/citation_analysis.json",
              format: "json",
              citation_analysis: buildNativeCitationArtifact(),
            },
          },
        },
      }));

      await executeApplyResult({
        workflow,
        parent,
        bundleReader: { readText: async () => "" },
      });

      const citation = parent
        .getNotes()
        .map((id) => Zotero.Items.get(id)!)
        .find((entry) => /data-zs-payload="citation-analysis-json"/.test(entry.getNote()));
      assert.isOk(citation);
      assert.deepEqual(
        parsePayload(citation!.getNote(), "citation-analysis-json"),
        {
          ...buildCitationPayloadWrapper(),
          entry: "Y:/Code/Python/Skill-Runner/data/runs/sample/citation_analysis.json",
        },
      );
    });

    it("accepts schema-style native references artifact object with top-level items", async function () {
      const workflow = await getWorkflow("import-notes");
      const parent = await handlers.item.create({
        itemType: "journalArticle",
        fields: { title: "Import Object References Parent" },
      });

      installWorkflowEditorSessionOverrideForTests(async () => ({
        saved: true,
        result: {
          references: {
            sourcePath: "Y:/Code/Python/Skill-Runner/data/runs/sample/references.json",
            payload: {
              version: 1,
              entry: "Y:/Code/Python/Skill-Runner/data/runs/sample/references.json",
              format: "json",
              references: buildNativeReferencesArtifact(),
            },
          },
        },
      }));

      await executeApplyResult({
        workflow,
        parent,
        bundleReader: { readText: async () => "" },
      });

      const references = parent
        .getNotes()
        .map((id) => Zotero.Items.get(id)!)
        .find((entry) => /data-zs-payload="references-json"/.test(entry.getNote()));
      assert.isOk(references);
      assert.deepEqual(
        parsePayload(references!.getNote(), "references-json"),
        {
          ...buildReferencesPayloadWrapper(),
          entry: "Y:/Code/Python/Skill-Runner/data/runs/sample/references.json",
        },
      );
    });

    it("aborts the whole import when overwrite is declined for any selected note", async function () {
      const workflow = await getWorkflow("import-notes");
      const parent = await handlers.item.create({
        itemType: "journalArticle",
        fields: { title: "Import Conflict Parent" },
      });
      const existingDigest = await handlers.parent.addNote(parent, {
        content: buildDigestNoteContent("# Existing Digest"),
      });
      const beforeDigestContent = existingDigest.getNote();

      let callIndex = 0;
      installWorkflowEditorSessionOverrideForTests(async () => {
        callIndex += 1;
        if (callIndex === 1) {
          return {
            saved: true,
            result: {
              digest: {
                sourcePath: "D:/imports/digest.md",
                markdown: "# Incoming Digest",
              },
              references: {
                sourcePath: "D:/imports/references.json",
                payload: buildReferencesPayloadWrapper(),
              },
            },
          };
        }
        return {
          saved: false,
          actionId: "skip",
          reason: "action",
        };
      });

      const result = (await executeApplyResult({
        workflow,
        parent,
        bundleReader: { readText: async () => "" },
      })) as { imported?: number; skipped?: number };

      assert.deepEqual(result, { imported: 0, skipped: 2 });
      assert.equal(parent.getNotes().length, 1);
      assert.equal(Zotero.Items.get(existingDigest.id)!.getNote(), beforeDigestContent);
    });

    it("reopens the import selection window after conflict dialog cancel and can continue with overwrite", async function () {
      const workflow = await getWorkflow("import-notes");
      const parent = await handlers.item.create({
        itemType: "journalArticle",
        fields: { title: "Import Conflict Retry Parent" },
      });
      const existingDigest = await handlers.parent.addNote(parent, {
        content: buildDigestNoteContent("# Old Digest"),
      });

      const importedDigest = {
        sourcePath: "D:/imports/digest.md",
        markdown: "# Reopened Digest",
      };

      let callIndex = 0;
      installWorkflowEditorSessionOverrideForTests(async (args) => {
        callIndex += 1;
        if (callIndex === 1) {
          return {
            saved: true,
            result: {
              digest: importedDigest,
            },
          };
        }
        if (callIndex === 2) {
          return {
            saved: false,
            actionId: "cancel",
            reason: "action",
          };
        }
        if (callIndex === 3) {
          assert.deepEqual((args.initialState as any)?.digest, importedDigest);
          return {
            saved: true,
            result: {
              digest: importedDigest,
            },
          };
        }
        return {
          saved: false,
          actionId: "overwrite",
          reason: "action",
        };
      });

      await executeApplyResult({
        workflow,
        parent,
        bundleReader: { readText: async () => "" },
      });

      const digest = Zotero.Items.get(existingDigest.id)!;
      assert.equal(
        parsePayload(digest.getNote(), "digest-markdown").content,
        "# Reopened Digest",
      );
      assert.equal(callIndex, 4);
    });
  });
});
