export type WorkflowBackend = {
  skillId?: string;
  engine?: string;
  backendId?: string;
};

export type WorkflowDefaults = Record<string, unknown>;

export type WorkflowHooksSpec = {
  filterInputs?: string;
  buildRequest?: string;
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
    engine?: string;
    parameter?: Record<string, unknown>;
    model?: string;
    runtime_options?: Record<string, unknown>;
  };
  input?: {
    upload?: {
      files?: Array<{
        key: string;
        from: "selected.markdown" | "selected.pdf";
      }>;
    };
  };
  poll?: {
    interval_ms?: number;
    timeout_ms?: number;
  };
  result?: {
    fetch?: "bundle" | "result";
  };
  [key: string]: unknown;
};

export type WorkflowManifest = {
  id: string;
  label: string;
  version?: string;
  backend?: WorkflowBackend;
  defaults?: WorkflowDefaults;
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
};

export type WorkflowRuntimeContext = {
  handlers: typeof import("../handlers").handlers;
  zotero: typeof Zotero;
  helpers: HookHelpers;
};

export type BuildRequestHook = (args: {
  selectionContext: unknown;
  manifest: WorkflowManifest;
  runtime: WorkflowRuntimeContext;
}) => unknown | Promise<unknown>;

export type ApplyResultHook = (args: {
  parent: Zotero.Item | number | string;
  bundleReader: { readText: (entryPath: string) => Promise<string> };
  runResult?: unknown;
  manifest: WorkflowManifest;
  runtime: WorkflowRuntimeContext;
}) => unknown | Promise<unknown>;

export type FilterInputsHook = (args: {
  selectionContext: unknown;
  manifest: WorkflowManifest;
  runtime: WorkflowRuntimeContext;
}) => unknown | Promise<unknown>;

export type WorkflowHooksModule = {
  filterInputs?: FilterInputsHook;
  buildRequest?: BuildRequestHook;
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
};
