export const DEFAULT_SKILLRUNNER_ENDPOINT = "http://127.0.0.1:8030";

export const DEFAULT_BACKEND_ID = "skillrunner-local";

export const DEFAULT_BACKEND_TYPE = "skillrunner";

export const PASS_THROUGH_BACKEND_TYPE = "pass-through";

export const PASS_THROUGH_REQUEST_KIND = "pass-through.run.v1";

export const DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE: Record<string, string> = {
  [DEFAULT_BACKEND_TYPE]: "skillrunner.job.v1",
  "generic-http": "generic-http.request.v1",
  [PASS_THROUGH_BACKEND_TYPE]: PASS_THROUGH_REQUEST_KIND,
};
