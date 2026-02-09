import { assert } from "chai";
import { handlers } from "../../src/handlers";
import { buildSelectionContext } from "../../src/modules/selectionContext";
import { SkillRunnerProvider } from "../../src/providers/skillrunnerProvider";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import { executeBuildRequests } from "../../src/workflows/runtime";
import { fixturePath, getProjectRoot, workflowsPath } from "./workflow-test-utils";
import {
  literatureDigestBundlePath,
  startMockSkillRunnerServer,
} from "../mock-skillrunner/server";

describe("transport: skillrunner mock", function () {
  this.timeout(15000);

  it("executes literature-digest request against mock skill-runner", async function () {
    const server = await startMockSkillRunnerServer({
      bundlePath: literatureDigestBundlePath(getProjectRoot()),
      pollDelayMs: 80,
    });
    try {
      const parent = await handlers.item.create({
        itemType: "journalArticle",
        fields: { title: "Transport Parent" },
      });
      const mdFile = fixturePath("literature-digest", "example.md");
      const attachment = await handlers.attachment.createFromPath({
        parent,
        path: mdFile,
        title: "example.md",
        mimeType: "text/markdown",
      });
      const selectionContext = await buildSelectionContext([attachment]);

      const loaded = await loadWorkflowManifests(workflowsPath());
      const workflow = loaded.workflows.find(
        (entry) => entry.manifest.id === "literature-digest",
      );
      assert.isOk(workflow, "workflow literature-digest not found");
      const requests = (await executeBuildRequests({
        workflow: workflow!,
        selectionContext,
      })) as unknown[];
      assert.lengthOf(requests, 1);

      const request = requests[0] as {
        poll?: { interval_ms?: number; timeout_ms?: number };
      };
      request.poll = {
        interval_ms: 40,
        timeout_ms: 5000,
      };

      const provider = new SkillRunnerProvider({
        baseUrl: server.baseUrl,
      });
      const result = await provider.execute({
        requestKind: workflow!.manifest.request!.kind,
        request,
      });

      assert.equal(result.status, "succeeded");
      assert.instanceOf(result.bundleBytes, Uint8Array);
      assert.isAbove(result.bundleBytes.length, 0);
      assert.isString(result.requestId);

      const jobs = server.getJobs();
      assert.lengthOf(jobs, 1);
      const payload = jobs[0].createPayload as {
        skill_id?: string;
        engine?: string;
      };
      assert.equal(payload.skill_id, "literature-digest");
      assert.equal(payload.engine, "gemini");
      assert.isTrue(jobs[0].uploadReceived);
      assert.isAtLeast(jobs[0].pollCount, 2);
    } finally {
      await server.close();
    }
  });
});
