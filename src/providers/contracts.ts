export type ProviderExecutionRequestMeta = {
  targetParentID?: number;
  taskName?: string;
  sourceAttachmentPaths?: string[];
};

export type SkillRunnerHttpStepDefinition = {
  id: string;
  request: {
    method: string;
    path: string;
    json?: Record<string, unknown>;
    multipart?: boolean;
  };
  extract?: {
    request_id?: string;
  };
  repeat_until?: string;
  files?: Array<{ key: string; path: string }>;
};

export type SkillRunnerHttpStepsRequest = ProviderExecutionRequestMeta & {
  kind: "http.steps";
  steps: SkillRunnerHttpStepDefinition[];
  poll?: {
    interval_ms?: number;
    timeout_ms?: number;
  };
};

export type SkillRunnerJobRequestV1 = ProviderExecutionRequestMeta & {
  kind: "skillrunner.job.v1";
  skill_id: string;
  upload_files: Array<{ key: string; path: string }>;
  parameter?: Record<string, unknown>;
  poll?: {
    interval_ms?: number;
    timeout_ms?: number;
  };
  fetch_type?: "bundle" | "result";
};

export type GenericHttpRequestV1 = ProviderExecutionRequestMeta & {
  kind: "generic-http.request.v1";
  request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    json?: unknown;
  };
  timeout_ms?: number;
};

export type ProviderExecutionResult = {
  status: "succeeded";
  requestId: string;
  fetchType: "bundle" | "result";
  bundleBytes?: Uint8Array;
  resultJson?: unknown;
  responseJson?: unknown;
};
