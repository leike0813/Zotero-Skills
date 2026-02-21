import { assert } from "chai";
import { config } from "../../package.json";
import { handlers } from "../../src/handlers";
import { executeWorkflowFromCurrentSelection } from "../../src/modules/workflowExecute";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import {
  expectWorkflowSummaryCounter,
  workflowsPath,
} from "../zotero/workflow-test-utils";

type PersistedTagEntry = {
  tag: string;
  facet: string;
  source: string;
  note: string;
  deprecated: boolean;
};

const TAG_VOCAB_PREF_KEY = `${config.prefsPrefix}.tagVocabularyJson`;
const MOCK_SKILLRUNNER_BASE_URL =
  (typeof process !== "undefined" &&
    process.env?.ZOTERO_TEST_SKILLRUNNER_ENDPOINT) ||
  "http://127.0.0.1:8030";

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

describe("integration: tag-regulator with mock skill-runner", function () {
  this.timeout(20000);

  beforeEach(function () {
    clearTagVocabularyState();
  });

  afterEach(function () {
    clearTagVocabularyState();
  });

  it("updates parent tags through full workflow execution chain when backend result is valid", async function () {
    if (!(await isMockSkillRunnerReachable(MOCK_SKILLRUNNER_BASE_URL))) {
      this.skip();
    }

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
      fields: { title: "Tag Regulator E2E Parent" },
    });
    await handlers.tag.add(parent, ["topic:legacy", "status:2-to-read"]);
    const beforeTags = listTags(parent);
    assert.deepEqual(beforeTags, ["status:2-to-read", "topic:legacy"]);

    const workflow = await getTagRegulatorWorkflow();
    const alerts: string[] = [];
    const win = {
      ZoteroPane: {
        getSelectedItems: () => [parent],
      },
      alert: (message: string) => alerts.push(message),
    } as unknown as _ZoteroTypes.MainWindow;

    await executeWorkflowFromCurrentSelection({
      win,
      workflow,
    });

    assert.lengthOf(alerts, 1);
    expectWorkflowSummaryCounter(alerts[0], "succeeded", 1);
    expectWorkflowSummaryCounter(alerts[0], "failed", 0);

    const afterTags = listTags(parent);
    assert.deepEqual(afterTags, ["status:2-to-read", "topic:tunnel"]);
  });
});
