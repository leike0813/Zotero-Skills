import { assert } from "chai";
import {
  buildWorkflowSettingsDialogDraft,
  buildWorkflowSettingsDialogRenderModel,
  collectSchemaValues,
} from "../../src/modules/workflowSettingsDialogModel";

type FakeControl = {
  getAttribute: (name: string) => string | null;
  value?: string;
  type?: string;
  checked?: boolean;
};

function makeControl(
  attrs: Record<string, string>,
  extras?: Partial<Pick<FakeControl, "value" | "type" | "checked">>,
): FakeControl {
  return {
    getAttribute: (name: string) => attrs[name] ?? null,
    value: extras?.value,
    type: extras?.type,
    checked: extras?.checked,
  };
}

function makeContainer(controls: FakeControl[]): HTMLElement {
  return {
    querySelectorAll: () => controls as unknown as NodeListOf<Element>,
  } as unknown as HTMLElement;
}

describe("workflow settings dialog model", function () {
  it("builds deterministic render model without mutating initial state", function () {
    const initialState = {
      selectedProfile: "skillrunner-default",
      persistedWorkflowParams: { bbtPort: 23124, mode: "strict" },
      persistedProviderOptions: { engine: "openai", model: "gpt-4.1" },
      runOnceWorkflowParams: { bbtPort: 23124, mode: "strict" },
      runOnceProviderOptions: { engine: "openai", model: "gpt-4.1" },
    };
    const profileItems = [
      { id: "skillrunner-default", label: "skillrunner-default (http://127.0.0.1:8030)" },
      { id: "skillrunner-alt", label: "skillrunner-alt (http://127.0.0.1:8031)" },
    ];
    const parameters = {
      bbtPort: {
        type: "number" as const,
        title: "BBT HTTP Port",
        default: 23124,
      },
      mode: {
        type: "string" as const,
        title: "Matching Mode",
        enum: ["strict", "fuzzy"],
        default: "strict",
      },
    };

    const a = buildWorkflowSettingsDialogRenderModel({
      providerId: "skillrunner",
      profileItems,
      initialState,
      workflowParameters: parameters,
    });
    const b = buildWorkflowSettingsDialogRenderModel({
      providerId: "skillrunner",
      profileItems,
      initialState,
      workflowParameters: parameters,
    });

    assert.deepEqual(a, b);

    (a.persistedWorkflowParams as Record<string, unknown>).bbtPort = 99999;
    assert.equal(
      (initialState.persistedWorkflowParams as Record<string, unknown>).bbtPort,
      23124,
    );

    const c = buildWorkflowSettingsDialogRenderModel({
      providerId: "skillrunner",
      profileItems,
      initialState,
      workflowParameters: parameters,
    });
    assert.equal(
      (c.persistedWorkflowParams as Record<string, unknown>).bbtPort,
      23124,
    );
  });

  it("collects schema values with correct coercion", function () {
    const controls: FakeControl[] = [
      makeControl(
        {
          "data-zs-option-key": "template",
          "data-zs-option-type": "string",
        },
        { value: "auth.lower + '_' + year" },
      ),
      makeControl(
        {
          "data-zs-option-key": "port",
          "data-zs-option-type": "number",
        },
        { value: "23124" },
      ),
      makeControl(
        {
          "data-zs-option-key": "enabled",
          "data-zs-option-type": "boolean",
        },
        { type: "checkbox", checked: true },
      ),
      makeControl(
        {
          "data-zs-option-key": "engine",
          "data-zs-option-type": "string",
          "data-zs-choice-control": "1",
          "data-zs-choice-value": "openai",
        },
        {},
      ),
      makeControl(
        {
          "data-zs-option-key": "emptyValue",
          "data-zs-option-type": "string",
        },
        { value: "" },
      ),
    ];

    const result = collectSchemaValues(makeContainer(controls));
    assert.deepEqual(result, {
      template: "auth.lower + '_' + year",
      port: 23124,
      enabled: true,
      engine: "openai",
    });
  });

  it("builds centralized drafts for persistent and run-once payloads", function () {
    const persistedWorkflow = makeContainer([
      makeControl(
        {
          "data-zs-option-key": "bbtPort",
          "data-zs-option-type": "number",
        },
        { value: "23124" },
      ),
    ]);
    const persistedProvider = makeContainer([
      makeControl(
        {
          "data-zs-option-key": "engine",
          "data-zs-option-type": "string",
          "data-zs-choice-control": "1",
          "data-zs-choice-value": "openai",
        },
        {},
      ),
    ]);
    const onceWorkflow = makeContainer([
      makeControl(
        {
          "data-zs-option-key": "bbtPort",
          "data-zs-option-type": "number",
        },
        { value: "25000" },
      ),
    ]);
    const onceProvider = makeContainer([
      makeControl(
        {
          "data-zs-option-key": "model",
          "data-zs-option-type": "string",
        },
        { value: "gpt-4.1-mini" },
      ),
    ]);

    const draft = buildWorkflowSettingsDialogDraft({
      persistedProfile: "skillrunner-default",
      onceProfile: "",
      persistedWorkflowFields: persistedWorkflow,
      persistedProviderFields: persistedProvider,
      onceWorkflowFields: onceWorkflow,
      onceProviderFields: onceProvider,
    });

    assert.deepEqual(draft, {
      persistent: {
        backendId: "skillrunner-default",
        workflowParams: { bbtPort: 23124 },
        providerOptions: { engine: "openai" },
      },
      runOnce: {
        backendId: undefined,
        workflowParams: { bbtPort: 25000 },
        providerOptions: { model: "gpt-4.1-mini" },
      },
    });
  });
});

