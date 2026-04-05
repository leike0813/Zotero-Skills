import { assert } from "chai";
import {
  hasRunDialogWaitingAuthExited,
  isRunDialogWaitingAuthActivePhase,
} from "../../src/modules/skillRunnerRunDialog";

describe("skillrunner run dialog waiting auth observer", function () {
  it("treats only active auth phases as waiting-auth-active", function () {
    assert.equal(isRunDialogWaitingAuthActivePhase("method_selection"), true);
    assert.equal(isRunDialogWaitingAuthActivePhase("challenge_active"), true);
    assert.equal(isRunDialogWaitingAuthActivePhase("completed"), false);
    assert.equal(isRunDialogWaitingAuthActivePhase(""), false);
    assert.equal(isRunDialogWaitingAuthActivePhase(undefined), false);
  });

  it("detects waiting_auth exit when pending payload leaves waiting_auth", function () {
    assert.equal(
      hasRunDialogWaitingAuthExited({
        pending: {
          request_id: "req-1",
          status: "queued",
          pending_owner: "waiting_auth.challenge_active",
        },
      }),
      true,
    );
    assert.equal(
      hasRunDialogWaitingAuthExited({
        pending: {
          request_id: "req-1",
          status: "waiting_auth",
          pending_owner: "running",
        },
      }),
      true,
    );
  });

  it("detects waiting_auth exit from auth session phase/status but stays conservative otherwise", function () {
    assert.equal(
      hasRunDialogWaitingAuthExited({
        authSession: {
          request_id: "req-1",
          status: "running",
          phase: "challenge_active",
        },
      }),
      true,
    );
    assert.equal(
      hasRunDialogWaitingAuthExited({
        authSession: {
          request_id: "req-1",
          status: "waiting_auth",
          phase: "completed",
        },
      }),
      true,
    );
    assert.equal(
      hasRunDialogWaitingAuthExited({
        pending: {
          request_id: "req-1",
          status: "waiting_auth",
          pending_owner: "waiting_auth.challenge_active",
        },
        authSession: {
          request_id: "req-1",
          status: "waiting_auth",
          phase: "challenge_active",
        },
      }),
      false,
    );
    assert.equal(hasRunDialogWaitingAuthExited({}), false);
  });
});
