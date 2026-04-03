import {
  clearRuntimeLogs,
  resetRuntimeLogAllowedLevels,
  subscribeRuntimeLogs,
  type RuntimeLogEntry,
} from "../../src/modules/runtimeLogManager";
import {
  createWorkflowHostApi,
  resetWorkflowHostApiForTests,
  WORKFLOW_HOST_API_VERSION,
} from "../../src/workflows/hostApi";

const HOST_API_KEY = "__zsHostApi";
const HOST_API_VERSION_KEY = "__zsHostApiVersion";

type ToastCaptureEntry = {
  text?: string;
  type?: string;
};

export function installTagVocabularyHostApiGlobals(args: {
  hostApi?: Record<string, unknown>;
  hostApiVersion?: number;
} = {}) {
  const runtime = globalThis as typeof globalThis & Record<string, unknown>;
  const previousHostApi = runtime[HOST_API_KEY];
  const previousHostApiVersion = runtime[HOST_API_VERSION_KEY];
  resetWorkflowHostApiForTests();
  runtime[HOST_API_KEY] = args.hostApi || createWorkflowHostApi();
  runtime[HOST_API_VERSION_KEY] =
    args.hostApiVersion || WORKFLOW_HOST_API_VERSION;
  return () => {
    if (typeof previousHostApi === "undefined") {
      delete runtime[HOST_API_KEY];
    } else {
      runtime[HOST_API_KEY] = previousHostApi;
    }
    if (typeof previousHostApiVersion === "undefined") {
      delete runtime[HOST_API_VERSION_KEY];
    } else {
      runtime[HOST_API_VERSION_KEY] = previousHostApiVersion;
    }
    resetWorkflowHostApiForTests();
  };
}

export function installWorkflowToastCapture(toasts: ToastCaptureEntry[]) {
  const runtime = globalThis as typeof globalThis & {
    ztoolkit?: {
      ProgressWindow?: new (
        title: string,
        options?: Record<string, unknown>,
      ) => {
        createLine: (args: {
          text?: string;
          type?: string;
          progress?: number;
        }) => {
          show: () => { startCloseTimer?: (delayMs: number) => unknown };
        };
      };
    };
  };
  const hadToolkit = Boolean(runtime.ztoolkit);
  const previousProgressWindow = runtime.ztoolkit?.ProgressWindow;
  runtime.ztoolkit = runtime.ztoolkit || {};
  runtime.ztoolkit.ProgressWindow = class MockProgressWindow {
    createLine(args: { text?: string; type?: string }) {
      toasts.push({
        text: String(args?.text || ""),
        type: String(args?.type || "default"),
      });
      return {
        show() {
          return {
            startCloseTimer() {
              return undefined;
            },
          };
        },
      };
    }
  };
  return () => {
    if (hadToolkit) {
      runtime.ztoolkit!.ProgressWindow = previousProgressWindow;
    } else {
      delete runtime.ztoolkit;
    }
  };
}

export function installRuntimeLogCapture(logs: RuntimeLogEntry[]) {
  clearRuntimeLogs();
  resetRuntimeLogAllowedLevels();
  const unsubscribe = subscribeRuntimeLogs((snapshot) => {
    logs.splice(0, logs.length, ...snapshot.entries);
  });
  return () => {
    unsubscribe();
    clearRuntimeLogs();
    resetRuntimeLogAllowedLevels();
  };
}

export function installTagVocabularySyncCapture(args: {
  logs?: RuntimeLogEntry[];
  toasts?: ToastCaptureEntry[];
}) {
  const restoreLogs = args.logs ? installRuntimeLogCapture(args.logs) : () => undefined;
  const restoreToasts = args.toasts
    ? installWorkflowToastCapture(args.toasts)
    : () => undefined;
  return () => {
    restoreToasts();
    restoreLogs();
  };
}
