import { assert } from "chai";
import { handlers } from "../../src/handlers";
import { createHookHelpers } from "../../src/workflows/helpers";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import { executeBuildRequests } from "../../src/workflows/runtime";
import type { LoadedWorkflow } from "../../src/workflows/types";
import {
  LITERATURE_DIGEST_FIXTURE_CASES,
} from "./literature-digest-fixture-cases";
import { workflowsPath } from "./workflow-test-utils";

type FilteredSelection = {
  items?: { attachments?: Array<{ filePath?: string }> };
};

type BuiltRequest = {
  kind: string;
  targetParentID: number;
  steps: Array<{
    id: string;
    request: {
      json?: {
        skill_id?: string;
        engine?: string;
        parameter?: { language?: string };
      };
    };
    files?: Array<{ key: string; path: string }>;
  }>;
};

describe("workflow: literature-digest fixture matrix", function () {
  let workflow: LoadedWorkflow;

  const hookRuntime = {
    handlers,
    zotero: Zotero,
    helpers: createHookHelpers(Zotero),
  };

  before(async function () {
    const loaded = await loadWorkflowManifests(workflowsPath());
    const found = loaded.workflows.find(
      (entry) => entry.manifest.id === "literature-digest",
    );
    assert.isOk(found, "workflow literature-digest not found");
    workflow = found!;
    assert.isFunction(workflow.hooks.filterInputs, "filterInputs hook missing");
  });

  for (const fixtureCase of LITERATURE_DIGEST_FIXTURE_CASES) {
    it(`keeps filterInputs output stable for ${fixtureCase.name}`, async function () {
      const filtered = (await workflow.hooks.filterInputs!({
        selectionContext: fixtureCase.context,
        manifest: workflow.manifest,
        runtime: hookRuntime,
      })) as FilteredSelection;

      const actualPaths = (filtered.items?.attachments || [])
        .map((entry) => entry.filePath || "")
        .filter(Boolean);
      assert.deepEqual(actualPaths, fixtureCase.expectedFilteredPaths);
    });

    it(`keeps request generation stable for ${fixtureCase.name}`, async function () {
      const requests = (await executeBuildRequests({
        workflow,
        selectionContext: fixtureCase.context,
        runtime: hookRuntime,
      })) as BuiltRequest[];
      assert.lengthOf(requests, fixtureCase.expectedRequests.length);

      for (let i = 0; i < requests.length; i++) {
        const request = requests[i];
        const expected = fixtureCase.expectedRequests[i];
        const createStep = request.steps.find((step) => step.id === "create");
        const uploadStep = request.steps.find((step) => step.id === "upload");

        assert.equal(request.kind, "http.steps");
        assert.equal(request.targetParentID, expected.targetParentID);
        assert.equal(createStep?.request.json?.skill_id, "literature-digest");
        assert.equal(createStep?.request.json?.engine, "gemini");
        assert.equal(createStep?.request.json?.parameter?.language, "en-US");
        assert.equal(uploadStep?.files?.[0].key, "md_path");
        assert.equal(uploadStep?.files?.[0].path, expected.uploadPath);
      }
    });
  }
});
