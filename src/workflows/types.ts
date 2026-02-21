export type WorkflowParameterType = "string" | "number" | "boolean";

export type WorkflowParameterSchema = {
  type: WorkflowParameterType;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  allowCustom?: boolean;
  min?: number;
  max?: number;
};

export type WorkflowHooksSpec = {
  filterInputs?: string;
  buildRequest?: string;
  normalizeSettings?: string;
  applyResult: string;
};

export type WorkflowInputsSpec = {
  unit: "attachment" | "parent" | "note";
  accepts?: {
    mime?: string[];
  };
  per_parent?: {
    min?: number;
    max?: number;
  };
};

export type WorkflowExecutionSpec = {
  mode?: "auto" | "sync" | "async";
  poll_interval_ms?: number;
  timeout_ms?: number;
  feedback?: {
    showNotifications?: boolean;
  };
};

export type WorkflowResultSpec = {
  fetch?: {
    type?: "bundle" | "result";
  };
  expects?: {
    result_json?: string;
    artifacts?: string[];
  };
};

export type WorkflowRequestSpec = {
  kind: string;
  create?: {
    skill_id?: string;
  };
  input?: {
    upload?: {
      files?: Array<{
        key: string;
        from: "selected.markdown" | "selected.pdf";
      }>;
    };
    [key: string]: unknown;
  };
  poll?: {
    interval_ms?: number;
    timeout_ms?: number;
  };
  [key: string]: unknown;
};

export type WorkflowManifest = {
  id: string;
  label: string;
  provider?: string;
  version?: string;
  parameters?: Record<string, WorkflowParameterSchema>;
  inputs?: WorkflowInputsSpec;
  execution?: WorkflowExecutionSpec;
  result?: WorkflowResultSpec;
  request?: WorkflowRequestSpec;
  hooks: WorkflowHooksSpec;
};

export type HookHelpers = {
  getAttachmentParentId: (entry: unknown) => number | null;
  getAttachmentFilePath: (entry: unknown) => string;
  getAttachmentFileName: (entry: unknown) => string;
  getAttachmentFileStem: (entry: unknown) => string;
  getAttachmentDateAdded: (entry: unknown) => number;
  isMarkdownAttachment: (entry: unknown) => boolean;
  isPdfAttachment: (entry: unknown) => boolean;
  pickEarliestPdfAttachment: (entries: unknown[]) => unknown | null;
  cloneSelectionContext: <T>(selectionContext: T) => T;
  withFilteredAttachments: <T>(
    selectionContext: T,
    attachments: unknown[],
  ) => T;
  resolveItemRef: (ref: Zotero.Item | number | string) => Zotero.Item;
  basenameOrFallback: (targetPath: string | undefined, fallback: string) => string;
  toHtmlNote: (title: string, body: string) => string;
  normalizeReferenceAuthors: (value: unknown) => string[];
  normalizeReferenceEntry: (
    entry: unknown,
    index: number,
  ) => Record<string, unknown>;
  normalizeReferencesArray: (value: unknown) => Record<string, unknown>[];
  normalizeReferencesPayload: (payload: unknown) => Record<string, unknown>[];
  replacePayloadReferences: (
    payload: unknown,
    references: Record<string, unknown>[],
  ) => unknown;
  resolveReferenceSource: (entry: unknown) => string;
  renderReferenceLocator: (entry: unknown) => string;
  renderReferencesTable: (references: unknown) => string;
};

export type WorkflowRuntimeContext = {
  handlers: typeof import("../handlers").handlers;
  zotero: typeof Zotero;
  helpers: HookHelpers;
};

export type BuildRequestHook = (args: {
  selectionContext: unknown;
  manifest: WorkflowManifest;
  executionOptions?: {
    workflowParams?: Record<string, unknown>;
    providerOptions?: Record<string, unknown>;
  };
  runtime: WorkflowRuntimeContext;
}) => unknown | Promise<unknown>;

export type ApplyResultHook = (args: {
  parent: Zotero.Item | number | string;
  bundleReader: {
    readText: (entryPath: string) => Promise<string>;
    getExtractedDir?: () => Promise<string>;
  };
  request?: unknown;
  runResult?: unknown;
  manifest: WorkflowManifest;
  runtime: WorkflowRuntimeContext;
}) => unknown | Promise<unknown>;

export type FilterInputsHook = (args: {
  selectionContext: unknown;
  manifest: WorkflowManifest;
  runtime: WorkflowRuntimeContext;
}) => unknown | Promise<unknown>;

export type NormalizeWorkflowSettingsHook = (args:
  | {
      phase: "persisted";
      workflowId: string;
      manifest: WorkflowManifest;
      previous: {
        backendId?: string;
        workflowParams?: Record<string, unknown>;
        providerOptions?: Record<string, unknown>;
      };
      incoming: {
        backendId?: string;
        workflowParams?: Record<string, unknown>;
        providerOptions?: Record<string, unknown>;
      };
      merged: {
        backendId?: string;
        workflowParams?: Record<string, unknown>;
        providerOptions?: Record<string, unknown>;
      };
    }
  | {
      phase: "execution";
      workflowId: string;
      manifest: WorkflowManifest;
      rawWorkflowParams: Record<string, unknown>;
      normalizedWorkflowParams: Record<string, unknown>;
    }) => unknown;

export type WorkflowHooksModule = {
  filterInputs?: FilterInputsHook;
  buildRequest?: BuildRequestHook;
  normalizeSettings?: NormalizeWorkflowSettingsHook;
  applyResult: ApplyResultHook;
};

export type ResolvedBuildStrategy = "hook" | "declarative";

export type LoadedWorkflow = {
  manifest: WorkflowManifest;
  rootDir: string;
  hooks: WorkflowHooksModule;
  buildStrategy: ResolvedBuildStrategy;
};

export type LoadedWorkflows = {
  workflows: LoadedWorkflow[];
  manifests: WorkflowManifest[];
  warnings: string[];
  errors: string[];
  diagnostics?: Array<{
    level: "warning" | "error";
    category:
      | "manifest_parse_error"
      | "manifest_validation_error"
      | "hook_missing_error"
      | "hook_import_error"
      | "scan_path_error"
      | "scan_runtime_warning";
    message: string;
    entry?: string;
    workflowId?: string;
    path?: string;
    reason?: string;
  }>;
};
