export const DEFAULT_SKILLRUNNER_ENDPOINT = "http://127.0.0.1:8030";

export const DEFAULT_BACKEND_ID = "skillrunner-local";

export const DEFAULT_BACKEND_TYPE = "skillrunner";

export const DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE: Record<string, string> = {
  [DEFAULT_BACKEND_TYPE]: "skillrunner.job.v1",
  "generic-http": "generic-http.request.v1",
};
