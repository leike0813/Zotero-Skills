import { assert } from "chai";
import { handlers } from "../../src/handlers";
import { executeWorkflowFromCurrentSelection } from "../../src/modules/workflowExecute";
import {
  emitWorkflowFinishSummary,
  emitWorkflowJobToasts,
  emitWorkflowStartToast,
} from "../../src/modules/workflowExecution/feedbackSeam";
import { createLocalizedMessageFormatter } from "../../src/modules/workflowExecution/messageFormatter";
import { runWorkflowPreparationSeam } from "../../src/modules/workflowExecution/preparationSeam";
import { loadWorkflowManifests } from "../../src/workflows/loader";
import { joinPath, mkTempDir, writeUtf8 } from "./workflow-test-utils";

async function createWorkflowRoot(args: {
  id: string;
  buildRequestBody?: string;
  applyResultBody?: string;
  filterInputsBody?: string;
}) {
  const root = await mkTempDir(`zotero-skills-seam-${args.id}`);
  const workflowRoot = joinPath(root, args.id);
  await writeUtf8(
    joinPath(workflowRoot, "workflow.json"),
    JSON.stringify(
      {
        id: args.id,
        label: `Seam ${args.id}`,
        provider: "pass-through",
        hooks: {
          ...(args.filterInputsBody ? { filterInputs: "hooks/filterInputs.js" } : {}),
          ...(args.buildRequestBody ? { buildRequest: "hooks/buildRequest.js" } : {}),
          applyResult: "hooks/applyResult.js",
        },
      },
      null,
      2,
    ),
  );
  if (args.filterInputsBody) {
    await writeUtf8(
      joinPath(workflowRoot, "hooks", "filterInputs.js"),
      args.filterInputsBody,
    );
  }
  if (args.buildRequestBody) {
    await writeUtf8(
      joinPath(workflowRoot, "hooks", "buildRequest.js"),
      args.buildRequestBody,
    );
  }
  await writeUtf8(
    joinPath(workflowRoot, "hooks", "applyResult.js"),
    args.applyResultBody ||
      [
        "export async function applyResult() {",
        "  return { ok: true };",
        "}",
        "",
      ].join("\n"),
  );
  return root;
}

describe("workflow execution seams", function () {
  it("supports deterministic preparation testing via injected seam dependencies", async function () {
    const alerts: string[] = [];
    const logs: string[] = [];
    const fakeWorkflow = {
      manifest: {
        id: "seam-prepare-no-valid",
        label: "Seam Prepare No Valid",
        hooks: {
          applyResult: "hooks/applyResult.js",
        },
      },
    } as any;
    const fakeExecutionContext = {
      backend: {
        id: "pass-through-local",
        type: "pass-through",
        baseUrl: "local://pass-through",
        auth: { kind: "none" },
      },
      requestKind: "pass-through.run.v1",
      workflowParams: {},
      providerOptions: {},
      providerId: "pass-through",
    };

    const result = await runWorkflowPreparationSeam(
      {
        win: {
          ZoteroPane: {
            getSelectedItems: () => [{ id: 1 }],
          },
          alert: (message: string) => {
            alerts.push(message);
          },
        } as unknown as _ZoteroTypes.MainWindow,
        workflow: fakeWorkflow,
        messageFormatter: createLocalizedMessageFormatter(),
      },
      {
        appendRuntimeLog: (entry) => {
          logs.push(entry.stage);
        },
        resolveWorkflowExecutionContext: async () => fakeExecutionContext as any,
        buildSelectionContext: async () => ({}),
        executeBuildRequests: async () => {
          const error = new Error("skip all");
          (error as any).code = "NO_VALID_INPUT_UNITS";
          (error as any).skippedUnits = 2;
          throw error;
        },
        alertWindow: (_win, message) => {
          alerts.push(message);
        },
      },
    );

    assert.equal(result.status, "halted");
    assert.include(alerts[0], "skipped=2");
    assert.include(logs, "trigger-no-valid-input");
  });

  it("keeps request-build failure messaging parity through seam entrypoint", async function () {
    const root = await createWorkflowRoot({
      id: "seam-build-failed",
      buildRequestBody: [
        "export async function buildRequest() {",
        "  throw new Error('build request exploded');",
        "}",
        "",
      ].join("\n"),
    });
    const loaded = await loadWorkflowManifests(root);
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "seam-build-failed",
    );
    assert.isOk(workflow);

    const parent = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Seam Build Failed Parent" },
    });
    const alerts: string[] = [];
    const win = {
      ZoteroPane: {
        getSelectedItems: () => [parent],
      },
      alert: (message: string) => alerts.push(message),
    } as unknown as _ZoteroTypes.MainWindow;

    await executeWorkflowFromCurrentSelection({
      win,
      workflow: workflow!,
    });

    assert.lengthOf(alerts, 1);
    assert.include(alerts[0], "cannot run");
    assert.include(alerts[0], "build request exploded");
  });

  it("keeps mixed success/failure summary parity after seam refactor", async function () {
    const root = await createWorkflowRoot({
      id: "seam-mixed-outcomes",
      applyResultBody: [
        "export async function applyResult({ parent, runtime }) {",
        "  const item = runtime.helpers.resolveItemRef(parent);",
        "  const title = String(item.getField?.('title') || '');",
        "  if (/Fail/.test(title)) {",
        "    throw new Error('forced apply failure');",
        "  }",
        "  await runtime.handlers.parent.addNote(item, {",
        "    content: '<p data-zs-seam-mixed=\"ok\">ok</p>',",
        "  });",
        "  return { ok: true };",
        "}",
        "",
      ].join("\n"),
    });
    const loaded = await loadWorkflowManifests(root);
    const workflow = loaded.workflows.find(
      (entry) => entry.manifest.id === "seam-mixed-outcomes",
    );
    assert.isOk(workflow);

    const parentA = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Seam Mixed Success Parent" },
    });
    const parentB = await handlers.item.create({
      itemType: "journalArticle",
      fields: { title: "Seam Mixed Fail Parent" },
    });
    const alerts: string[] = [];
    const toasts: string[] = [];
    const runtime = globalThis as { ztoolkit?: Record<string, unknown> };
    const createdToolkit = !runtime.ztoolkit;
    runtime.ztoolkit = runtime.ztoolkit || {};
    const originalProgressWindow = runtime.ztoolkit.ProgressWindow;
    runtime.ztoolkit.ProgressWindow = class MockProgressWindow {
      createLine(args: { text?: string }) {
        toasts.push(String(args?.text || ""));
        return this;
      }
      show() {
        return this;
      }
      startCloseTimer() {
        return this;
      }
    };
    const win = {
      ZoteroPane: {
        getSelectedItems: () => [parentA, parentB],
      },
      alert: (message: string) => {
        alerts.push(message);
      },
    } as unknown as _ZoteroTypes.MainWindow;

    try {
      await executeWorkflowFromCurrentSelection({
        win,
        workflow: workflow!,
      });
    } finally {
      if (createdToolkit) {
        delete runtime.ztoolkit;
      } else {
        runtime.ztoolkit!.ProgressWindow = originalProgressWindow;
      }
    }

    assert.lengthOf(alerts, 1);
    assert.include(alerts[0], "succeeded=1");
    assert.include(alerts[0], "failed=1");
    assert.include(alerts[0], "Failure reasons:");
    assert.match(alerts[0], /job-1 .*forced apply failure/);
    assert.isTrue(
      toasts.some((entry) => /started\. jobs=2/i.test(entry)),
      `missing start toast: ${JSON.stringify(toasts)}`,
    );
    assert.isTrue(
      toasts.some((entry) => /job 1\/2 succeeded/i.test(entry)),
      `missing success job toast: ${JSON.stringify(toasts)}`,
    );
    assert.isTrue(
      toasts.some((entry) => /job 2\/2 failed/i.test(entry)),
      `missing failed job toast: ${JSON.stringify(toasts)}`,
    );
  });

  it("supports feedback seam verification without UI runtime", function () {
    const toasts: string[] = [];
    const alerts: string[] = [];
    const formatter = createLocalizedMessageFormatter();
    emitWorkflowStartToast(
      {
        workflowLabel: "Seam Feedback",
        totalJobs: 2,
        messageFormatter: formatter,
      },
      {
        showToast: (payload) => toasts.push(payload.text),
      },
    );
    emitWorkflowJobToasts(
      {
        workflowLabel: "Seam Feedback",
        totalJobs: 2,
        outcomes: [
          {
            index: 0,
            taskLabel: "task-a",
            succeeded: true,
            jobId: "job-1",
          },
          {
            index: 1,
            taskLabel: "task-b",
            succeeded: false,
            reason: "failed",
            jobId: "job-2",
          },
        ],
        messageFormatter: formatter,
      },
      {
        showToast: (payload) => toasts.push(payload.text),
      },
    );
    emitWorkflowFinishSummary(
      {
        win: {} as _ZoteroTypes.MainWindow,
        workflowLabel: "Seam Feedback",
        succeeded: 1,
        failed: 1,
        skipped: 0,
        failureReasons: ["job-1: failed"],
        messageFormatter: formatter,
      },
      {
        alertWindow: (_win, message) => alerts.push(message),
      },
    );

    assert.lengthOf(toasts, 3);
    assert.isTrue(toasts.some((entry) => /started\. jobs=2/i.test(entry)));
    assert.isTrue(toasts.some((entry) => /job 1\/2 succeeded/i.test(entry)));
    assert.isTrue(toasts.some((entry) => /job 2\/2 failed/i.test(entry)));
    assert.lengthOf(alerts, 1);
    assert.include(alerts[0], "succeeded=1");
    assert.include(alerts[0], "failed=1");
  });
});
