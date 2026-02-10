import {
  DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE,
} from "../config/defaults";
import type { LoadedWorkflow } from "../workflows/types";

export function resolveWorkflowRequestKind(
  workflow: LoadedWorkflow,
  backendType: string,
) {
  const declared = String(workflow.manifest.request?.kind || "").trim();
  if (declared) {
    return declared;
  }
  const fallback = DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE[backendType];
  if (fallback) {
    return fallback;
  }
  throw new Error(
    `Workflow ${workflow.manifest.id} cannot resolve request kind for backend type "${backendType}"`,
  );
}
