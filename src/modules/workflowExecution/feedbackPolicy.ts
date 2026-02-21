import type { WorkflowManifest } from "../../workflows/types";

export function shouldShowWorkflowNotifications(manifest: WorkflowManifest) {
  return manifest.execution?.feedback?.showNotifications !== false;
}
