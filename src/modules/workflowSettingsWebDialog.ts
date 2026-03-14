import type { DialogHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { resolveAddonRef } from "../utils/runtimeBridge";
import type { LoadedWorkflow } from "../workflows/types";
import type { WorkflowExecutionOptions } from "./workflowSettingsDomain";
import { buildWorkflowSettingsUiDescriptor } from "./workflowSettings";
import type { BackendInstance } from "../backends/types";

type WorkflowSettingsDialogSnapshot = {
  title: string;
  labels: {
    workflowLabel: string;
    providerLabel: string;
    profileLabel: string;
    workflowParamsTitle: string;
    providerOptionsTitle: string;
    persistLabel: string;
    confirmLabel: string;
    cancelLabel: string;
    noWorkflowParams: string;
    noProviderOptions: string;
    noProfiles: string;
    blockedNoProfile: string;
    workflowSettingsNumberInvalid: string;
    workflowSettingsPositiveIntegerRequired: string;
  };
  workflow: {
    id: string;
    label: string;
    providerId: string;
  };
  form: {
    requiresBackendProfile: boolean;
    profileEditable: boolean;
    profileMissing: boolean;
    profiles: Array<{ id: string; label: string }>;
    selectedProfile: string;
    workflowSchemaEntries: Array<{
      key: string;
      type: "string" | "number" | "boolean";
      title?: string;
      description?: string;
      enumValues?: string[];
      allowCustom?: boolean;
      defaultValue?: unknown;
    }>;
    providerSchemaEntries: Array<{
      key: string;
      type: "string" | "number" | "boolean";
      title?: string;
      description?: string;
      enumValues?: string[];
      allowCustom?: boolean;
      defaultValue?: unknown;
    }>;
    workflowParams: Record<string, unknown>;
    providerOptions: Record<string, unknown>;
    hasConfigurableSettings: boolean;
  };
  persistChecked: boolean;
};

type WorkflowSettingsDialogActionEnvelope = {
  type: "workflow-settings-dialog:action";
  action: string;
  payload?: Record<string, unknown>;
};

type WorkflowSettingsDialogResult =
  | {
      status: "confirmed";
      executionOptions: WorkflowExecutionOptions;
      persist: boolean;
    }
  | {
      status: "canceled";
    };

function localize(
  key: string,
  fallback: string,
  options?: { args?: Record<string, unknown> },
) {
  try {
    const value = String(
      options ? getString(key as any, options) : getString(key as any),
    ).trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

function resolveDialogPageUrl() {
  const addonRef = String(config.addonRef || "").trim() || resolveAddonRef("");
  if (!addonRef) {
    return "about:blank";
  }
  return `chrome://${addonRef}/content/dashboard/workflow-settings-dialog.html`;
}

function createDialogFrame(doc: Document, pageUrl: string) {
  const frame = doc.createElement("iframe");
  frame.setAttribute("type", "content");
  frame.setAttribute("data-zs-role", "workflow-settings-dialog-frame");
  frame.src = pageUrl;
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.style.minHeight = "420px";
  frame.style.border = "none";
  return frame;
}

function resolveFrameWindow(frame: Element | null) {
  if (!frame) {
    return null;
  }
  const candidate = frame as Element & { contentWindow?: Window | null };
  return candidate.contentWindow || null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeExecutionOptions(raw: unknown): WorkflowExecutionOptions {
  if (!isObject(raw)) {
    return {};
  }
  return {
    backendId:
      typeof raw.backendId === "string" ? raw.backendId.trim() || undefined : undefined,
    workflowParams: isObject(raw.workflowParams) ? { ...raw.workflowParams } : {},
    providerOptions: isObject(raw.providerOptions) ? { ...raw.providerOptions } : {},
  };
}

function normalizeDraftChangedSection(raw: unknown) {
  const section = String(raw || "").trim();
  if (
    section === "backend" ||
    section === "workflowParams" ||
    section === "providerOptions"
  ) {
    return section;
  }
  return "";
}

function normalizeDraftChangedKey(raw: unknown) {
  return String(raw || "").trim();
}

function isStructuralDraftChange(args: { changedSection: string; changedKey: string }) {
  if (args.changedSection === "backend" && args.changedKey === "backendId") {
    return true;
  }
  if (
    args.changedSection === "providerOptions" &&
    (args.changedKey === "engine" || args.changedKey === "model_provider")
  ) {
    return true;
  }
  return false;
}

export async function openWorkflowSettingsWebDialog(args: {
  workflow: LoadedWorkflow;
  ownerWindow?: _ZoteroTypes.MainWindow;
  initialDraft?: WorkflowExecutionOptions;
  candidateBackends?: BackendInstance[];
}): Promise<WorkflowSettingsDialogResult> {
  let descriptor = await buildWorkflowSettingsUiDescriptor({
    workflow: args.workflow,
    draft: args.initialDraft,
    candidateBackends: args.candidateBackends,
  });
  let draft: WorkflowExecutionOptions = {
    backendId: descriptor.selectedProfile || undefined,
    workflowParams: { ...descriptor.workflowParams },
    providerOptions: { ...descriptor.providerOptions },
  };
  let persistChecked = true;
  let result: WorkflowSettingsDialogResult = { status: "canceled" };
  let dialog: DialogHelper | undefined;
  let frameWindow: Window | null = null;
  let removeMessageListener: (() => void) | undefined;

  const pushSnapshot = (messageType: "workflow-settings-dialog:init" | "workflow-settings-dialog:snapshot") => {
    if (!frameWindow) {
      return;
    }
    const snapshot: WorkflowSettingsDialogSnapshot = {
      title: localize("workflow-settings-submit-title", "Workflow Settings"),
      labels: {
        workflowLabel: localize("workflow-settings-workflow-label", "Workflow"),
        providerLabel: localize("workflow-settings-provider-label", "Provider"),
        profileLabel: localize("workflow-settings-profile-label", "Profile"),
        workflowParamsTitle: localize(
          "workflow-settings-persisted-workflow-params-title",
          "Workflow Parameters",
        ),
        providerOptionsTitle: localize(
          "workflow-settings-persisted-provider-options-title",
          "Provider Runtime Options",
        ),
        persistLabel: localize(
          "workflow-settings-submit-persist-checkbox",
          "Save as default settings",
        ),
        confirmLabel: localize("workflow-settings-submit-confirm", "Confirm & Submit"),
        cancelLabel: localize("workflow-settings-cancel", "Cancel"),
        noWorkflowParams: localize(
          "workflow-settings-no-workflow-params",
          "This workflow has no configurable parameters.",
        ),
        noProviderOptions: localize(
          "workflow-settings-no-provider-options",
          "This provider has no configurable runtime options.",
        ),
        noProfiles: localize(
          "workflow-settings-no-profiles",
          "No backend profile available.",
        ),
        blockedNoProfile: localize(
          "workflow-settings-submit-blocked-no-profile",
          "No backend profile available. Please configure one first.",
        ),
        workflowSettingsNumberInvalid: localize(
          "workflow-settings-number-invalid",
          "Please enter a valid number.",
        ),
        workflowSettingsPositiveIntegerRequired: localize(
          "workflow-settings-positive-integer-required",
          "Please enter a positive integer.",
        ),
      },
      workflow: {
        id: descriptor.workflowId,
        label: descriptor.workflowLabel,
        providerId: descriptor.providerId,
      },
      form: {
        requiresBackendProfile: descriptor.requiresBackendProfile,
        profileEditable: descriptor.profileEditable,
        profileMissing: descriptor.profileMissing,
        profiles: descriptor.profiles,
        selectedProfile:
          String(draft.backendId || "").trim() || descriptor.selectedProfile,
        workflowSchemaEntries: descriptor.workflowSchemaEntries,
        providerSchemaEntries: descriptor.providerSchemaEntries,
        workflowParams: { ...(draft.workflowParams || {}) },
        providerOptions: { ...(draft.providerOptions || {}) },
        hasConfigurableSettings: descriptor.hasConfigurableSettings,
      },
      persistChecked,
    };
    frameWindow.postMessage(
      {
        type: messageType,
        payload: snapshot,
      },
      "*",
    );
  };

  const refreshDescriptor = async () => {
    descriptor = await buildWorkflowSettingsUiDescriptor({
      workflow: args.workflow,
      draft,
      candidateBackends: args.candidateBackends,
    });
  };

  const closeDialog = () => {
    dialog?.window?.close();
  };

  const handleAction = async (envelope: WorkflowSettingsDialogActionEnvelope) => {
    const action = String(envelope.action || "").trim();
    if (!action) {
      return;
    }
    if (action === "ready") {
      pushSnapshot("workflow-settings-dialog:init");
      return;
    }
    if (action === "update-draft") {
      const payload = envelope.payload || {};
      draft = normalizeExecutionOptions(payload.executionOptions);
      const changedSection = normalizeDraftChangedSection(payload.changedSection);
      const changedKey = normalizeDraftChangedKey(payload.changedKey);
      if (
        isStructuralDraftChange({
          changedSection,
          changedKey,
        })
      ) {
        await refreshDescriptor();
        pushSnapshot("workflow-settings-dialog:snapshot");
      }
      return;
    }
    if (action === "toggle-persist") {
      persistChecked = envelope.payload?.checked !== false;
      pushSnapshot("workflow-settings-dialog:snapshot");
      return;
    }
    if (action === "confirm") {
      if (descriptor.profileMissing) {
        pushSnapshot("workflow-settings-dialog:snapshot");
        return;
      }
      result = {
        status: "confirmed",
        executionOptions: normalizeExecutionOptions(draft),
        persist: persistChecked,
      };
      closeDialog();
      return;
    }
    if (action === "cancel") {
      result = { status: "canceled" };
      closeDialog();
    }
  };

  const dialogData: Record<string, unknown> = {
    loadCallback: () => {
      const doc = dialog?.window?.document;
      const dialogWindow = dialog?.window;
      if (!doc || !dialogWindow) {
        return;
      }
      try {
        dialogWindow.resizeTo(760, 620);
      } catch {
        // ignore
      }
      const root = doc.getElementById("zs-workflow-settings-dialog-root") as
        | HTMLElement
        | null;
      if (!root) {
        return;
      }
      root.innerHTML = "";
      const frame = createDialogFrame(doc, resolveDialogPageUrl());
      root.appendChild(frame);
      frameWindow = resolveFrameWindow(frame);
      frame.addEventListener("load", () => {
        frameWindow = resolveFrameWindow(frame);
        if (!frameWindow) {
          return;
        }
        pushSnapshot("workflow-settings-dialog:init");
      });
      const onMessage = (event: MessageEvent) => {
        const data = event.data as { type?: unknown };
        if (!data || data.type !== "workflow-settings-dialog:action") {
          return;
        }
        void handleAction(data as WorkflowSettingsDialogActionEnvelope);
      };
      dialogWindow.addEventListener("message", onMessage);
      removeMessageListener = () => {
        dialogWindow.removeEventListener("message", onMessage);
      };
      pushSnapshot("workflow-settings-dialog:snapshot");
    },
    unloadCallback: () => {
      if (removeMessageListener) {
        removeMessageListener();
        removeMessageListener = undefined;
      }
      frameWindow = null;
    },
  };

  dialog = new ztoolkit.Dialog(1, 1)
    .addCell(0, 0, {
      tag: "div",
      namespace: "html",
      id: "zs-workflow-settings-dialog-root",
      styles: {
        width: "100%",
        height: "100%",
        minWidth: "640px",
        minHeight: "420px",
        padding: "0",
        margin: "0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      },
    })
    .setDialogData(dialogData)
    .open(localize("workflow-settings-submit-title", "Workflow Settings"));

  await (dialogData as { unloadLock?: { promise?: Promise<void> } }).unloadLock
    ?.promise;

  return result;
}
