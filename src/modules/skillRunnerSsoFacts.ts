import {
  SKILLRUNNER_PROVIDER_STATES,
  SKILLRUNNER_TERMINAL_STATES,
} from "./skillRunnerProviderStateMachine";
import {
  SKILLRUNNER_BACKEND_PROBE_BACKOFF_STEPS_MS,
  SKILLRUNNER_BACKEND_PROBE_FAILURE_THRESHOLD_FOR_GATE,
  SKILLRUNNER_BACKEND_PROBE_SUCCESS_THRESHOLD_FOR_RECOVERY,
} from "./skillRunnerBackendHealthRegistry";
import {
  SKILLRUNNER_EVENT_STREAM_CONNECT_SNAPSHOT,
  SKILLRUNNER_EVENT_STREAM_DISCONNECT_STATES,
} from "./skillRunnerSessionSyncManager";
import { MANAGED_LOCAL_BACKEND_ID } from "./skillRunnerLocalRuntimeConstants";

export const SKILLRUNNER_SSOT_FACTS = {
  states: [...SKILLRUNNER_PROVIDER_STATES],
  terminalStates: [...SKILLRUNNER_TERMINAL_STATES],
  legacyManagedBackendIds: [] as string[],
  managedLocalBackendId: MANAGED_LOCAL_BACKEND_ID,
  nonTerminalWriteSource: "events",
  terminalWriteSource: "jobs-terminal",
  backendHealth: {
    probeBackoffMs: [...SKILLRUNNER_BACKEND_PROBE_BACKOFF_STEPS_MS],
    failureThresholdForGate:
      SKILLRUNNER_BACKEND_PROBE_FAILURE_THRESHOLD_FOR_GATE,
    successThresholdForRecovery:
      SKILLRUNNER_BACKEND_PROBE_SUCCESS_THRESHOLD_FOR_RECOVERY,
  },
  streamLifecycle: {
    eventConnectOnlySnapshot: SKILLRUNNER_EVENT_STREAM_CONNECT_SNAPSHOT,
    eventDisconnectStates: [...SKILLRUNNER_EVENT_STREAM_DISCONNECT_STATES],
    chatOwnership: "singleton-selected-session",
  },
  startup: {
    autoReconnectSnapshot: "running",
  },
  managedLocal: {
    profileCreatePolicy: "deploy-only",
    probePolicy: "probe-only-if-registry-present",
  },
  applyOwnership: {
    autoApplyOwner: "reconciler",
    interactiveApplyOwner: "reconciler",
    foregroundAutoApply: "skip-and-defer-to-reconciler",
  },
  uiGating: {
    flaggedBackendBlocksRunDialog: true,
    flaggedBackendHiddenInHome: true,
    flaggedBackendTabDisabled: true,
    flaggedBackendWorkspaceDisabled: true,
  },
  workspace: {
    singletonRunWorkspace: true,
    stateRenderSource: "ledger-snapshot",
    flaggedGroupRules: {
      flaggedGroupDisabled: true,
      flaggedGroupNoBubbles: true,
    },
    firstFrameRules: {
      firstFrameUsesLedgerSnapshot: true,
      refreshFailureNoForcedRunning: true,
    },
    pendingRules: {
      waitingEdgeFetchPending: true,
      leaveWaitingClearsPending: true,
      pendingFailureRetainsLastGood: true,
    },
  },
} as const;
