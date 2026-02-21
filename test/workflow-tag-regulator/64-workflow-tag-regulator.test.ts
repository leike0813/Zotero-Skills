import { assert } from "chai";
import { config } from "../../package.json";
import { handlers } from "../../src/handlers";
import { buildSelectionContext } from "../../src/modules/selectionContext";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import {
  executeApplyResult,
  executeBuildRequests,
} from "../../src/workflows/runtime";
import {
  existsPath,
  readUtf8,
  workflowsPath,
} from "../zotero/workflow-test-utils";

type PersistedTagEntry = {
  tag: string;
  facet: string;
  source: string;
  note: string;
  deprecated: boolean;
};

type TagRegulatorRequest = {
  kind: string;
  skill_id: string;
  targetParentID?: number;
  input?: {
    metadata?: {
      id?: number;
      key?: string;
      title?: string;
      itemType?: string;
      libraryID?: number;
    };
    input_tags?: string[];
  };
  parameter?: {
    infer_tag?: boolean;
    valid_tags_format?: string;
    tag_note_language?: string;
  };
  upload_files?: Array<{
    key: string;
    path: string;
  }>;
};

type SuggestTagEntry = {
  tag: string;
  note: string;
};

type SuggestTagsDialogOpenArgs = {
  rendererId?: string;
  title?: string;
  initialState?: {
    suggestTagEntries?: SuggestTagEntry[];
    selectedTags?: string[];
  };
  labels?: {
    save?: string;
    cancel?: string;
  };
};

type SuggestTagsDialogOpenResult = {
  saved: boolean;
  result?: unknown;
  reason?: string;
};

type RuntimeWithEditorBridge = typeof globalThis & {
  __zsWorkflowEditorHostOpen?: (
    args: SuggestTagsDialogOpenArgs,
  ) => Promise<SuggestTagsDialogOpenResult> | SuggestTagsDialogOpenResult;
  addon?: {
    data?: {
      workflowEditorHost?: {
        open?: (
          args: SuggestTagsDialogOpenArgs,
        ) => Promise<SuggestTagsDialogOpenResult> | SuggestTagsDialogOpenResult;
      };
    };
  };
};

const TAG_VOCAB_PREF_KEY = `${config.prefsPrefix}.tagVocabularyJson`;

function clearTagVocabularyState() {
  Zotero.Prefs.clear(TAG_VOCAB_PREF_KEY, true);
}

function saveTagVocabularyState(entries: PersistedTagEntry[]) {
  Zotero.Prefs.set(
    TAG_VOCAB_PREF_KEY,
    JSON.stringify({
      version: 1,
      entries,
    }),
    true,
  );
}

function loadTagVocabularyState() {
  const raw = Zotero.Prefs.get(TAG_VOCAB_PREF_KEY, true);
  if (typeof raw !== "string" || !raw.trim()) {
    return {
      corrupted: false,
      entries: [] as PersistedTagEntry[],
    };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      corrupted: false,
      entries: Array.isArray(parsed?.entries)
        ? (parsed.entries as PersistedTagEntry[])
        : ([] as PersistedTagEntry[]),
    };
  } catch {
    return {
      corrupted: true,
      entries: [] as PersistedTagEntry[],
    };
  }
}

function installSuggestTagsDialogMock(
  mockOpen: (
    args: SuggestTagsDialogOpenArgs,
  ) => Promise<SuggestTagsDialogOpenResult> | SuggestTagsDialogOpenResult,
) {
  const runtime = globalThis as RuntimeWithEditorBridge;
  const prevGlobal = runtime.__zsWorkflowEditorHostOpen;
  const addonObj = (runtime.addon || {}) as NonNullable<
    RuntimeWithEditorBridge["addon"]
  >;
  if (!addonObj.data) {
    addonObj.data = {};
  }
  if (!addonObj.data.workflowEditorHost) {
    addonObj.data.workflowEditorHost = {};
  }
  const prevAddonOpen = addonObj.data.workflowEditorHost.open;
  addonObj.data.workflowEditorHost.open = mockOpen;
  runtime.__zsWorkflowEditorHostOpen = mockOpen;
  runtime.addon = addonObj;
  return () => {
    runtime.__zsWorkflowEditorHostOpen = prevGlobal;
    addonObj.data!.workflowEditorHost!.open = prevAddonOpen;
  };
}

function listTags(item: Zotero.Item) {
  return item
    .getTags()
    .map((entry) => String(entry.tag || "").trim())
    .filter(Boolean)
    .sort((left, right) =>
      left.localeCompare(right, "en", {
        sensitivity: "base",
      }),
    );
}

async function getTagRegulatorWorkflow() {
  const loaded = await loadWorkflowManifests(workflowsPath());
  const workflow = loaded.workflows.find(
    (entry) => entry.manifest.id === "tag-regulator",
  );
  assert.isOk(
    workflow,
    `workflow tag-regulator not found; loaded=${loaded.workflows.map((entry) => entry.manifest.id).join(",")} warnings=${JSON.stringify(loaded.warnings)} errors=${JSON.stringify(loaded.errors)}`,
  );
  return workflow!;
}

describe("workflow: tag-regulator", function () {
  beforeEach(function () {
    clearTagVocabularyState();
  });

  afterEach(function () {
    clearTagVocabularyState();
  });

  it("loads tag-regulator workflow manifest with buildRequest/applyResult hooks", async function () {
    const workflow = await getTagRegulatorWorkflow();
    assert.equal(workflow.manifest.provider, "skillrunner");
    assert.equal(workflow.manifest.inputs?.unit, "parent");
    assert.equal(workflow.manifest.request?.kind, "skillrunner.job.v1");
    assert.isFunction(workflow.hooks.buildRequest);
    assert.isFunction(workflow.hooks.applyResult);
  });

  it("builds one mixed-input request per selected parent with valid_tags upload", async function () {
    saveTagVocabularyState([
      {
        tag: "topic:tunnel",
        facet: "topic",
        source: "manual",
        note: "",
        deprecated: false,
      },
      {
        tag: "topic:legacy",
        facet: "topic",
        source: "manual",
        note: "",
        deprecated: true,
      },
      {
        tag: "field:CE/UG/Tunnel",
        facet: "field",
        source: "manual",
        note: "",
        deprecated: false,
      },
    ]);

    const parentA = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Parent A" },
    });
    const parentB = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Parent B" },
    });
    await handlers.tag.add(parentA, ["topic:legacy", "status:2-to-read"]);
    await handlers.tag.add(parentB, ["topic:tunnel"]);

    const workflow = await getTagRegulatorWorkflow();
    const selectionContext = await buildSelectionContext([parentA, parentB]);
    const requests = (await executeBuildRequests({
      workflow,
      selectionContext,
      executionOptions: {
        workflowParams: {
          infer_tag: false,
          valid_tags_format: "yaml",
          tag_note_language: "fr-FR",
        },
      },
    })) as TagRegulatorRequest[];

    assert.lengthOf(requests, 2);
    for (const request of requests) {
      assert.equal(request.kind, "skillrunner.job.v1");
      assert.equal(request.skill_id, "tag-regulator");
      assert.equal(request.parameter?.infer_tag, false);
      assert.equal(request.parameter?.valid_tags_format, "yaml");
      assert.equal(request.parameter?.tag_note_language, "fr-FR");
      assert.equal(request.upload_files?.length, 1);
      assert.equal(request.upload_files?.[0].key, "valid_tags");
      assert.isTrue(await existsPath(String(request.upload_files?.[0].path || "")));
      const yamlText = await readUtf8(String(request.upload_files?.[0].path || ""));
      assert.include(yamlText, "- topic:tunnel");
      assert.include(yamlText, "- field:CE/UG/Tunnel");
      assert.notInclude(yamlText, "topic:legacy");
      assert.isArray(request.input?.input_tags);
      assert.isString(request.input?.metadata?.key);
    }
  });

  it("fails with deterministic diagnostics when controlled vocabulary is missing", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Missing Vocabulary Parent" },
    });
    await handlers.tag.add(parent, ["topic:legacy"]);

    const workflow = await getTagRegulatorWorkflow();
    const selectionContext = await buildSelectionContext([parent]);

    let thrown: unknown = null;
    try {
      await executeBuildRequests({
        workflow,
        selectionContext,
      });
    } catch (error) {
      thrown = error;
    }

    assert.isOk(thrown, "expected build request to fail");
    assert.match(String(thrown), /tag-regulator vocabulary missing/i);
  });

  it("uses default tag_note_language zh-CN when workflow param is not provided", async function () {
    saveTagVocabularyState([
      {
        tag: "topic:tunnel",
        facet: "topic",
        source: "manual",
        note: "",
        deprecated: false,
      },
    ]);

    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Language Default Parent" },
    });
    await handlers.tag.add(parent, ["topic:legacy"]);

    const workflow = await getTagRegulatorWorkflow();
    const selectionContext = await buildSelectionContext([parent]);
    const requests = (await executeBuildRequests({
      workflow,
      selectionContext,
    })) as TagRegulatorRequest[];

    assert.lengthOf(requests, 1);
    assert.equal(requests[0].parameter?.tag_note_language, "zh-CN");
  });

  it("runs parent pipeline from buildRequest to applyResult and mutates tags conservatively", async function () {
    saveTagVocabularyState([
      {
        tag: "topic:tunnel",
        facet: "topic",
        source: "manual",
        note: "",
        deprecated: false,
      },
    ]);

    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Apply Parent" },
    });
    await handlers.tag.add(parent, ["topic:legacy", "status:2-to-read"]);

    const workflow = await getTagRegulatorWorkflow();
    const selectionContext = await buildSelectionContext([parent]);
    const requests = (await executeBuildRequests({
      workflow,
      selectionContext,
    })) as TagRegulatorRequest[];
    assert.lengthOf(requests, 1);

    const applied = (await executeApplyResult({
      workflow,
      parent,
      bundleReader: {
        readText: async () => "",
      },
      request: requests[0],
      runResult: {
        resultJson: {
          result: {
            status: "success",
            data: {
              metadata: requests[0].input?.metadata || {},
              input_tags: requests[0].input?.input_tags || [],
              remove_tags: ["topic:legacy"],
              add_tags: ["topic:tunnel"],
              suggest_tags: [
                { tag: "topic:suggested", note: "suggested note" },
              ],
              warnings: ["heuristic"],
              error: null,
            },
            artifacts: [],
            validation_warnings: [],
            error: null,
          },
        },
      },
    })) as {
      applied: boolean;
      removed: string[];
      added: string[];
      suggest_tags: SuggestTagEntry[];
      warnings: string[];
    };

    assert.isTrue(applied.applied);
    assert.deepEqual(applied.removed, ["topic:legacy"]);
    assert.deepEqual(applied.added, ["topic:tunnel"]);
    assert.deepEqual(applied.suggest_tags, [
      { tag: "topic:suggested", note: "suggested note" },
    ]);
    assert.deepEqual(applied.warnings, ["heuristic"]);
    assert.deepEqual(listTags(parent), ["status:2-to-read", "topic:tunnel"]);
  });

  it("does not open suggest-tags dialog or write vocabulary when suggest_tags is empty", async function () {
    saveTagVocabularyState([
      {
        tag: "topic:stable",
        facet: "topic",
        source: "manual",
        note: "",
        deprecated: false,
      },
    ]);
    const before = loadTagVocabularyState().entries;
    let dialogCalls = 0;
    const restoreOpen = installSuggestTagsDialogMock(async () => {
      dialogCalls += 1;
      return {
        saved: true,
        result: {
          selectedTags: ["topic:unexpected"],
        },
      };
    });
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Suggest Empty Parent" },
    });
    await handlers.tag.add(parent, ["topic:legacy"]);
    const workflow = await getTagRegulatorWorkflow();

    try {
      const applied = (await executeApplyResult({
        workflow,
        parent,
        bundleReader: {
          readText: async () => "",
        },
        runResult: {
          resultJson: {
            result: {
              status: "success",
              data: {
                remove_tags: ["topic:legacy"],
                add_tags: ["topic:tunnel"],
                suggest_tags: [],
                warnings: [],
                error: null,
              },
              artifacts: [],
              validation_warnings: [],
              error: null,
            },
          },
        },
      })) as {
        suggest_intake?: {
          opened?: boolean;
          added?: string[];
        };
      };
      assert.isFalse(Boolean(applied.suggest_intake?.opened));
      assert.deepEqual(applied.suggest_intake?.added || [], []);
    } finally {
      restoreOpen();
    }

    assert.equal(dialogCalls, 0);
    assert.deepEqual(loadTagVocabularyState().entries, before);
  });

  it("opens suggest-tags dialog and writes only selected tags with source agent-suggest", async function () {
    saveTagVocabularyState([
      {
        tag: "topic:existing",
        facet: "topic",
        source: "manual",
        note: "",
        deprecated: false,
      },
    ]);
    const openCalls: SuggestTagsDialogOpenArgs[] = [];
    const restoreOpen = installSuggestTagsDialogMock(async (args) => {
      openCalls.push(args);
      return {
        saved: true,
        result: {
          selectedTags: ["topic:new-alpha"],
        },
      };
    });
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Suggest Intake Parent" },
    });
    await handlers.tag.add(parent, ["topic:legacy"]);
    const workflow = await getTagRegulatorWorkflow();

    try {
      const applied = (await executeApplyResult({
        workflow,
        parent,
        bundleReader: {
          readText: async () => "",
        },
        runResult: {
          resultJson: {
            result: {
              status: "success",
              data: {
                remove_tags: ["topic:legacy"],
                add_tags: ["topic:tunnel"],
                suggest_tags: [
                  { tag: "topic:new-alpha", note: "alpha note" },
                  { tag: "topic:new-beta", note: "beta note" },
                  { tag: "topic:existing", note: "existing note" },
                ],
                warnings: ["heuristic"],
                error: null,
              },
              artifacts: [],
              validation_warnings: [],
              error: null,
            },
          },
        },
      })) as {
        suggest_intake?: {
          opened?: boolean;
          added?: string[];
          skipped?: string[];
        };
      };
      assert.isTrue(Boolean(applied.suggest_intake?.opened));
      assert.deepEqual(applied.suggest_intake?.added || [], ["topic:new-alpha"]);
      assert.deepEqual(applied.suggest_intake?.skipped || [], []);
    } finally {
      restoreOpen();
    }

    assert.lengthOf(openCalls, 1);
    assert.deepEqual(openCalls[0].initialState?.suggestTagEntries || [], [
      { tag: "topic:new-alpha", note: "alpha note" },
      { tag: "topic:new-beta", note: "beta note" },
      { tag: "topic:existing", note: "existing note" },
    ]);

    const afterEntries = loadTagVocabularyState().entries;
    const newEntry = afterEntries.find((entry) => entry.tag === "topic:new-alpha");
    assert.isOk(newEntry, "expected selected suggest tag to be persisted");
    assert.equal(newEntry?.source, "agent-suggest");
    assert.equal(newEntry?.note, "alpha note");
    assert.isUndefined(
      afterEntries.find((entry) => entry.tag === "topic:new-beta"),
      "unselected suggest tag should not be persisted",
    );
  });

  it("skips duplicates during suggest-tags intake and keeps operation idempotent", async function () {
    saveTagVocabularyState([
      {
        tag: "topic:existing",
        facet: "topic",
        source: "manual",
        note: "",
        deprecated: false,
      },
    ]);
    const restoreOpen = installSuggestTagsDialogMock(async () => ({
      saved: true,
      result: {
        selectedTags: ["topic:existing", "topic:existing", "topic:new-idempotent"],
      },
    }));
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Suggest Duplicate Parent" },
    });
    await handlers.tag.add(parent, ["topic:legacy"]);
    const workflow = await getTagRegulatorWorkflow();

    try {
      const applied = (await executeApplyResult({
        workflow,
        parent,
        bundleReader: {
          readText: async () => "",
        },
        runResult: {
          resultJson: {
            result: {
              status: "success",
              data: {
                remove_tags: ["topic:legacy"],
                add_tags: ["topic:tunnel"],
                suggest_tags: [
                  { tag: "topic:existing", note: "existing note" },
                  { tag: "topic:new-idempotent", note: "idempotent note" },
                ],
                warnings: [],
                error: null,
              },
              artifacts: [],
              validation_warnings: [],
              error: null,
            },
          },
        },
      })) as {
        suggest_intake?: {
          added?: string[];
          skipped?: string[];
        };
      };
      assert.deepEqual(applied.suggest_intake?.added || [], ["topic:new-idempotent"]);
      assert.deepEqual(applied.suggest_intake?.skipped || [], ["topic:existing"]);
    } finally {
      restoreOpen();
    }

    const afterEntries = loadTagVocabularyState().entries;
    assert.lengthOf(
      afterEntries.filter((entry) => entry.tag === "topic:existing"),
      1,
      "duplicate existing tag should not be inserted twice",
    );
    assert.lengthOf(
      afterEntries.filter((entry) => entry.tag === "topic:new-idempotent"),
      1,
      "new suggest tag should be inserted exactly once",
    );
  });

  it("keeps vocabulary unchanged when suggest-tags dialog is canceled", async function () {
    saveTagVocabularyState([
      {
        tag: "topic:stable",
        facet: "topic",
        source: "manual",
        note: "",
        deprecated: false,
      },
    ]);
    const before = loadTagVocabularyState().entries;
    const restoreOpen = installSuggestTagsDialogMock(async () => ({
      saved: false,
      reason: "user-canceled",
    }));
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Suggest Cancel Parent" },
    });
    await handlers.tag.add(parent, ["topic:legacy"]);
    const workflow = await getTagRegulatorWorkflow();

    try {
      const applied = (await executeApplyResult({
        workflow,
        parent,
        bundleReader: {
          readText: async () => "",
        },
        runResult: {
          resultJson: {
            result: {
              status: "success",
              data: {
                remove_tags: ["topic:legacy"],
                add_tags: ["topic:tunnel"],
                suggest_tags: [
                  { tag: "topic:new-after-cancel", note: "cancel note" },
                ],
                warnings: [],
                error: null,
              },
              artifacts: [],
              validation_warnings: [],
              error: null,
            },
          },
        },
      })) as {
        suggest_intake?: {
          canceled?: boolean;
          added?: string[];
        };
      };
      assert.isTrue(Boolean(applied.suggest_intake?.canceled));
      assert.deepEqual(applied.suggest_intake?.added || [], []);
    } finally {
      restoreOpen();
    }

    assert.deepEqual(loadTagVocabularyState().entries, before);
  });

  it("rejects invalid suggest tags with diagnostics while accepting valid selected tags", async function () {
    const restoreOpen = installSuggestTagsDialogMock(async () => ({
      saved: true,
      result: {
        selectedTags: ["bad-format", "topic:valid-suggest"],
      },
    }));
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Suggest Invalid Parent" },
    });
    await handlers.tag.add(parent, ["topic:legacy"]);
    const workflow = await getTagRegulatorWorkflow();

    try {
      const applied = (await executeApplyResult({
        workflow,
        parent,
        bundleReader: {
          readText: async () => "",
        },
        runResult: {
          resultJson: {
            result: {
              status: "success",
              data: {
                remove_tags: ["topic:legacy"],
                add_tags: ["topic:tunnel"],
                suggest_tags: [
                  { tag: "bad-format", note: "invalid note" },
                  { tag: "topic:valid-suggest", note: "valid note" },
                ],
                warnings: [],
                error: null,
              },
              artifacts: [],
              validation_warnings: [],
              error: null,
            },
          },
        },
      })) as {
        suggest_intake?: {
          added?: string[];
          invalid?: Array<{ tag: string; reason?: string }>;
        };
      };
      assert.deepEqual(applied.suggest_intake?.added || [], ["topic:valid-suggest"]);
      assert.lengthOf(applied.suggest_intake?.invalid || [], 1);
      assert.equal(applied.suggest_intake?.invalid?.[0]?.tag, "bad-format");
      assert.match(
        String(applied.suggest_intake?.invalid?.[0]?.reason || ""),
        /invalid/i,
      );
    } finally {
      restoreOpen();
    }

    const entries = loadTagVocabularyState().entries;
    assert.isUndefined(entries.find((entry) => entry.tag === "bad-format"));
    assert.isOk(entries.find((entry) => entry.tag === "topic:valid-suggest"));
  });

  it("skips mutation when skill output has non-null error", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Error Parent" },
    });
    await handlers.tag.add(parent, ["topic:legacy"]);
    const before = listTags(parent);

    const workflow = await getTagRegulatorWorkflow();
    const applied = (await executeApplyResult({
      workflow,
      parent,
      bundleReader: {
        readText: async () => "",
      },
      runResult: {
        resultJson: {
          result: {
            status: "failed",
            data: {
              remove_tags: ["topic:legacy"],
              add_tags: ["topic:tunnel"],
              suggest_tags: [],
              warnings: ["backend failed"],
              error: {
                type: "invalid_input",
                message: "missing valid_tags",
              },
            },
            artifacts: [],
            validation_warnings: [],
            error: null,
          },
        },
      },
    })) as {
      applied: boolean;
      skipped: boolean;
      reason?: string;
    };

    assert.isFalse(applied.applied);
    assert.isTrue(applied.skipped);
    assert.match(String(applied.reason || ""), /skill error/i);
    assert.deepEqual(listTags(parent), before);
  });

  it("skips mutation when skill output is malformed", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Malformed Parent" },
    });
    await handlers.tag.add(parent, ["topic:legacy"]);
    const before = listTags(parent);

    const workflow = await getTagRegulatorWorkflow();
    const applied = (await executeApplyResult({
      workflow,
      parent,
      bundleReader: {
        readText: async () => "",
      },
      runResult: {
        resultJson: {
          result: {
            status: "success",
            data: {
              remove_tags: ["topic:legacy"],
              add_tags: "topic:tunnel",
              suggest_tags: [],
              warnings: [],
              error: null,
            },
            artifacts: [],
            validation_warnings: [],
            error: null,
          },
        },
      },
    })) as {
      applied: boolean;
      skipped: boolean;
      reason?: string;
    };

    assert.isFalse(applied.applied);
    assert.isTrue(applied.skipped);
    assert.match(String(applied.reason || ""), /malformed/i);
    assert.deepEqual(listTags(parent), before);
  });

  it("treats legacy string-array suggest_tags as malformed and skips mutation", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Legacy Suggest Tags Parent" },
    });
    await handlers.tag.add(parent, ["topic:legacy"]);
    const before = listTags(parent);

    const workflow = await getTagRegulatorWorkflow();
    const applied = (await executeApplyResult({
      workflow,
      parent,
      bundleReader: {
        readText: async () => "",
      },
      runResult: {
        resultJson: {
          result: {
            status: "success",
            data: {
              remove_tags: ["topic:legacy"],
              add_tags: ["topic:tunnel"],
              suggest_tags: ["topic:legacy-shape"],
              warnings: [],
              error: null,
            },
            artifacts: [],
            validation_warnings: [],
            error: null,
          },
        },
      },
    })) as {
      applied: boolean;
      skipped: boolean;
      reason?: string;
    };

    assert.isFalse(applied.applied);
    assert.isTrue(applied.skipped);
    assert.match(String(applied.reason || ""), /suggest_tags/i);
    assert.deepEqual(listTags(parent), before);
  });

  it("uses resultJson.result.data and ignores poll responseJson envelope", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator ResponseJson Parent" },
    });
    await handlers.tag.add(parent, [
      "/unread",
      "End-to-End",
      "Multiple-object tracking",
      "Transformer",
    ]);
    const before = listTags(parent);
    assert.deepEqual(before, [
      "/unread",
      "End-to-End",
      "Multiple-object tracking",
      "Transformer",
    ]);

    const workflow = await getTagRegulatorWorkflow();
    const applied = (await executeApplyResult({
      workflow,
      parent,
      bundleReader: {
        readText: async () => "",
      },
      runResult: {
        resultJson: {
          request_id: "req-live-shape",
          result: {
            status: "success",
            data: {
              metadata: {
                key: "KSM65VAD",
                title: "MOTR: end-to-end multiple-object tracking with transformer",
              },
              input_tags: [
                "/unread",
                "End-to-End",
                "Multiple-object tracking",
                "Transformer",
              ],
              remove_tags: [
                "/unread",
                "End-to-End",
                "Multiple-object tracking",
                "Transformer",
              ],
              add_tags: [
                "ai_task:tracking",
                "data:video",
                "field:CS/AI/CV",
                "model:DL/transformer",
              ],
              suggest_tags: [
                {
                  tag: "topic:end-to-end",
                  note: "end-to-end topic",
                },
                {
                  tag: "topic:multiple-object-tracking",
                  note: "multiple-object-tracking topic",
                },
              ],
              warnings: [
                "Inferred tags based on title and abstract.",
                "Mapped 'Multiple-object tracking' to 'ai_task:tracking'.",
              ],
              error: null,
            },
            artifacts: [],
            validation_warnings: ["OUTPUT_REPAIRED_GENERIC"],
            error: null,
          },
        },
        responseJson: {
          status: "succeeded",
          warnings: ["OUTPUT_REPAIRED_GENERIC"],
          error: null,
        },
      },
    })) as {
      applied: boolean;
      skipped: boolean;
      removed: string[];
      added: string[];
    };

    assert.isTrue(applied.applied);
    assert.isFalse(applied.skipped);
    assert.deepEqual(applied.removed, [
      "/unread",
      "End-to-End",
      "Multiple-object tracking",
      "Transformer",
    ]);
    assert.deepEqual(applied.added, [
      "ai_task:tracking",
      "data:video",
      "field:CS/AI/CV",
      "model:DL/transformer",
    ]);
    assert.deepEqual(listTags(parent), [
      "ai_task:tracking",
      "data:video",
      "field:CS/AI/CV",
      "model:DL/transformer",
    ]);
  });

  it("reads latest exported vocabulary on each execution", async function () {
    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Tag Regulator Vocabulary Refresh Parent" },
    });
    await handlers.tag.add(parent, ["topic:legacy"]);
    const workflow = await getTagRegulatorWorkflow();
    const selectionContext = await buildSelectionContext([parent]);

    saveTagVocabularyState([
      {
        tag: "topic:version-a",
        facet: "topic",
        source: "manual",
        note: "",
        deprecated: false,
      },
    ]);
    const requestsA = (await executeBuildRequests({
      workflow,
      selectionContext,
    })) as TagRegulatorRequest[];
    const yamlA = await readUtf8(String(requestsA[0].upload_files?.[0].path || ""));
    assert.include(yamlA, "topic:version-a");
    assert.notInclude(yamlA, "topic:version-b");

    saveTagVocabularyState([
      {
        tag: "topic:version-b",
        facet: "topic",
        source: "manual",
        note: "",
        deprecated: false,
      },
    ]);
    const requestsB = (await executeBuildRequests({
      workflow,
      selectionContext,
    })) as TagRegulatorRequest[];
    const yamlB = await readUtf8(String(requestsB[0].upload_files?.[0].path || ""));
    assert.include(yamlB, "topic:version-b");
    assert.notInclude(yamlB, "topic:version-a");
  });

  it("keeps language option declarations aligned with literature-digest workflow", async function () {
    const loaded = await loadWorkflowManifests(workflowsPath());
    const tagRegulator = loaded.workflows.find(
      (entry) => entry.manifest.id === "tag-regulator",
    );
    const literatureDigest = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(tagRegulator);
    assert.isOk(literatureDigest);

    const tagNoteLanguage = tagRegulator?.manifest.parameters?.tag_note_language;
    const literatureLanguage = literatureDigest?.manifest.parameters?.language;
    assert.deepEqual(tagNoteLanguage?.enum || [], literatureLanguage?.enum || []);
    assert.equal(tagNoteLanguage?.default, "zh-CN");
    assert.equal(literatureLanguage?.default, "zh-CN");
  });
});
