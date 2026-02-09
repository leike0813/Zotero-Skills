export type HttpStepDefinition = {
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

export type HttpStepsRequest = {
  kind: "http.steps";
  targetParentID?: number;
  steps: HttpStepDefinition[];
  poll?: {
    interval_ms?: number;
    timeout_ms?: number;
  };
};

export type SkillRunnerExecutionResult = {
  status: "succeeded";
  requestId: string;
  bundleBytes: Uint8Array;
  responseJson?: unknown;
};

