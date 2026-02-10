import { assert } from "chai";
import {
  buildWorkflowFinishMessage,
  normalizeErrorMessage,
} from "../../src/modules/workflowExecuteMessage";

describe("workflow execute message", function () {
  it("builds compact success summary without failure section", function () {
    const message = buildWorkflowFinishMessage({
      workflowLabel: "Literature Digest",
      succeeded: 2,
      failed: 0,
      failureReasons: [],
    });
    assert.equal(
      message,
      "Workflow Literature Digest finished. succeeded=2, failed=0",
    );
  });

  it("includes failure reasons and truncates overflow", function () {
    const message = buildWorkflowFinishMessage({
      workflowLabel: "Literature Digest",
      succeeded: 1,
      failed: 4,
      failureReasons: [
        "job-0: upstream timeout",
        "job-1: parent missing",
        "job-2: bundle missing",
        "job-3: applyResult failed",
      ],
    });
    assert.include(
      message,
      "Workflow Literature Digest finished. succeeded=1, failed=4",
    );
    assert.include(message, "Failure reasons:");
    assert.include(message, "1. job-0: upstream timeout");
    assert.include(message, "2. job-1: parent missing");
    assert.include(message, "3. job-2: bundle missing");
    assert.include(message, "...and 1 more");
    assert.notInclude(message, "job-3: applyResult failed");
  });

  it("normalizes unknown errors into stable strings", function () {
    assert.equal(normalizeErrorMessage(new Error("boom")), "boom");
    assert.equal(normalizeErrorMessage("failed"), "failed");
    assert.equal(normalizeErrorMessage({ code: 500 }), '{"code":500}');
  });

  it("includes skipped count when provided", function () {
    const message = buildWorkflowFinishMessage({
      workflowLabel: "Literature Digest",
      succeeded: 0,
      failed: 0,
      skipped: 1,
      failureReasons: [],
    });
    assert.equal(
      message,
      "Workflow Literature Digest finished. succeeded=0, failed=0, skipped=1",
    );
  });
});
