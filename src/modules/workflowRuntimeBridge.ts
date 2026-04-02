import { appendRuntimeLog, type RuntimeLogInput } from "./runtimeLogManager";
import { showWorkflowToast } from "./workflowExecution/feedbackSeam";

const GLOBAL_WORKFLOW_RUNTIME_BRIDGE_KEY = "__zsWorkflowRuntimeBridge";

type WorkflowRuntimeBridge = {
  appendRuntimeLog: (input: RuntimeLogInput) => ReturnType<typeof appendRuntimeLog>;
  showToast: (args: { text: string; type?: "default" | "success" | "error" }) => void;
};

export function installWorkflowRuntimeBridge() {
  const runtime = globalThis as typeof globalThis & {
    [GLOBAL_WORKFLOW_RUNTIME_BRIDGE_KEY]?: WorkflowRuntimeBridge;
  };

  const bridge: WorkflowRuntimeBridge = {
    appendRuntimeLog,
    showToast: ({ text, type }) => {
      showWorkflowToast({
        text: String(text || "").trim(),
        type: type || "default",
      });
    },
  };

  runtime[GLOBAL_WORKFLOW_RUNTIME_BRIDGE_KEY] = bridge;
  (
    addon.data as typeof addon.data & {
      workflowRuntimeBridge?: WorkflowRuntimeBridge;
    }
  ).workflowRuntimeBridge = bridge;
}

export function clearWorkflowRuntimeBridgeForTests() {
  const runtime = globalThis as typeof globalThis & {
    [GLOBAL_WORKFLOW_RUNTIME_BRIDGE_KEY]?: WorkflowRuntimeBridge;
  };
  delete runtime[GLOBAL_WORKFLOW_RUNTIME_BRIDGE_KEY];
  delete (
    addon.data as typeof addon.data & {
      workflowRuntimeBridge?: WorkflowRuntimeBridge;
    }
  ).workflowRuntimeBridge;
}
