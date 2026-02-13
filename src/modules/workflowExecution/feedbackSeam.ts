import {
  buildWorkflowFinishMessage,
  buildWorkflowJobToastMessage,
  buildWorkflowStartToastMessage,
  type WorkflowMessageFormatter,
} from "../workflowExecuteMessage";
import type { WorkflowJobOutcome, WorkflowToastPayload } from "./contracts";

type ProgressWindowInstance = {
  createLine: (args: {
    text: string;
    type?: string;
    progress?: number;
  }) => ProgressWindowInstance;
  show: () => ProgressWindowInstance;
  startCloseTimer?: (delayMs: number) => unknown;
};

type ProgressWindowCtor = new (
  title: string,
  options?: Record<string, unknown>,
) => ProgressWindowInstance;

function resolveProgressWindowCtor() {
  const runtime = globalThis as unknown as {
    ztoolkit?: { ProgressWindow?: ProgressWindowCtor };
  };
  const fromGlobalVar =
    typeof ztoolkit !== "undefined" ? ztoolkit?.ProgressWindow : undefined;
  const fromAddon =
    typeof addon !== "undefined"
      ? addon?.data?.ztoolkit?.ProgressWindow
      : undefined;
  const fromGlobalThis = runtime.ztoolkit?.ProgressWindow;
  return fromGlobalVar || fromAddon || fromGlobalThis;
}

export function showWorkflowToast(payload: WorkflowToastPayload) {
  const ProgressWindow = resolveProgressWindowCtor();
  if (!ProgressWindow) {
    return;
  }
  const addonName =
    (typeof addon !== "undefined" && addon?.data?.config?.addonName) ||
    "Zotero Skills";
  try {
    const win = new ProgressWindow(addonName, {
      closeOnClick: true,
      closeTime: 3500,
    });
    const shown = win
      .createLine({
        text: payload.text,
        type: payload.type,
        progress: 100,
      })
      .show();
    if (typeof shown.startCloseTimer === "function") {
      shown.startCloseTimer(3500);
    }
  } catch {
    // ignore toast failures
  }
}

export function alertWindow(win: _ZoteroTypes.MainWindow, message: string) {
  if (typeof win.alert === "function") {
    win.alert(message);
    return;
  }
  showWorkflowToast({
    text: message,
    type: "default",
  });
}

type FeedbackDeps = {
  showToast: (payload: WorkflowToastPayload) => void;
  alertWindow: (win: _ZoteroTypes.MainWindow, message: string) => void;
};

const defaultFeedbackDeps: FeedbackDeps = {
  showToast: showWorkflowToast,
  alertWindow,
};

export function emitWorkflowStartToast(args: {
  workflowLabel: string;
  totalJobs: number;
  messageFormatter: WorkflowMessageFormatter;
}, deps: Partial<FeedbackDeps> = {}) {
  const resolved = {
    ...defaultFeedbackDeps,
    ...deps,
  };
  resolved.showToast({
    text: buildWorkflowStartToastMessage(
      {
        workflowLabel: args.workflowLabel,
        totalJobs: args.totalJobs,
      },
      args.messageFormatter,
    ),
    type: "default",
  });
}

export function emitWorkflowJobToasts(args: {
  workflowLabel: string;
  totalJobs: number;
  outcomes: WorkflowJobOutcome[];
  messageFormatter: WorkflowMessageFormatter;
}, deps: Partial<FeedbackDeps> = {}) {
  const resolved = {
    ...defaultFeedbackDeps,
    ...deps,
  };
  for (const outcome of args.outcomes) {
    resolved.showToast({
      text: buildWorkflowJobToastMessage(
        {
          workflowLabel: args.workflowLabel,
          taskLabel: outcome.taskLabel,
          index: outcome.index + 1,
          total: args.totalJobs,
          succeeded: outcome.succeeded,
          reason: outcome.reason,
        },
        args.messageFormatter,
      ),
      type: outcome.succeeded ? "success" : "error",
    });
  }
}

export function emitWorkflowFinishSummary(args: {
  win: _ZoteroTypes.MainWindow;
  workflowLabel: string;
  succeeded: number;
  failed: number;
  skipped: number;
  failureReasons: string[];
  messageFormatter: WorkflowMessageFormatter;
}, deps: Partial<FeedbackDeps> = {}) {
  const resolved = {
    ...defaultFeedbackDeps,
    ...deps,
  };
  resolved.alertWindow(
    args.win,
    buildWorkflowFinishMessage(
      {
        workflowLabel: args.workflowLabel,
        succeeded: args.succeeded,
        failed: args.failed,
        skipped: args.skipped,
        failureReasons: args.failureReasons,
      },
      args.messageFormatter,
    ),
  );
}
