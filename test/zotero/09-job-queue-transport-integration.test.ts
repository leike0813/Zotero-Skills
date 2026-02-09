import { assert } from "chai";
import { handlers } from "../../src/handlers";
import { JobQueueManager } from "../../src/jobQueue/manager";
import { buildSelectionContext } from "../../src/modules/selectionContext";
import { SkillRunnerProvider } from "../../src/providers/skillrunnerProvider";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import { executeBuildRequests } from "../../src/workflows/runtime";
import { fixturePath, getProjectRoot, workflowsPath } from "./workflow-test-utils";
import {
  literatureDigestBundlePath,
  startMockSkillRunnerServer,
} from "../mock-skillrunner/server";

describe("job-queue: transport integration", function () {
  this.timeout(20000);

  it("runs one job per valid input request using FIFO + fixed concurrency", async function () {
    const server = await startMockSkillRunnerServer({
      bundlePath: literatureDigestBundlePath(getProjectRoot()),
      pollDelayMs: 60,
    });
    try {
      const parentA = await handlers.item.create({
        itemType: "journalArticle",
        fields: { title: "Queue Parent A" },
      });
      const parentB = await handlers.item.create({
        itemType: "journalArticle",
        fields: { title: "Queue Parent B" },
      });
      const mdFile = fixturePath("literature-digest", "example.md");
      const attachmentA = await handlers.attachment.createFromPath({
        parent: parentA,
        path: mdFile,
        title: "a.md",
        mimeType: "text/markdown",
      });
      const attachmentB = await handlers.attachment.createFromPath({
        parent: parentB,
        path: mdFile,
        title: "b.md",
        mimeType: "text/markdown",
      });

      const selectionContext = await buildSelectionContext([attachmentA, attachmentB]);
      const loaded = await loadWorkflowManifests(workflowsPath());
      const workflow = loaded.workflows.find(
        (entry) => entry.manifest.id === "literature-digest",
      );
      assert.isOk(workflow, "workflow literature-digest not found");
      const requests = (await executeBuildRequests({
        workflow: workflow!,
        selectionContext,
      })) as unknown[];
      assert.lengthOf(requests, 2);

      const adjustedRequests = requests.map((request) => {
        const typed = request as {
          poll?: { interval_ms?: number; timeout_ms?: number };
        };
        typed.poll = {
          interval_ms: 40,
          timeout_ms: 5000,
        };
        return typed;
      });

      const provider = new SkillRunnerProvider({
        baseUrl: server.baseUrl,
      });
      const queue = new JobQueueManager({
        concurrency: 1,
        executeJob: async (job) =>
          provider.execute({
            requestKind: workflow!.manifest.request!.kind,
            request: job.request,
          }),
      });

      const jobIds = adjustedRequests.map((request) =>
        queue.enqueue({
          workflowId: workflow!.manifest.id,
          request,
          meta: {},
        }),
      );

      await queue.waitForIdle();
      for (const jobId of jobIds) {
        const job = queue.getJob(jobId);
        assert.isOk(job);
        assert.equal(job!.state, "succeeded");
        assert.equal(job!.workflowId, "literature-digest");
      }

      const allJobs = queue.listJobs();
      assert.lengthOf(allJobs, 2);
      assert.deepEqual(
        allJobs.map((job) => job.state),
        ["succeeded", "succeeded"],
      );
      assert.lengthOf(server.getJobs(), 2);
    } finally {
      await server.close();
    }
  });
});
