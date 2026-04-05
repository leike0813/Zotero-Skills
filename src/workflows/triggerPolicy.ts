import type { WorkflowManifest } from "./types";

export function canWorkflowRunWithoutSelection(manifest: WorkflowManifest) {
  return manifest.trigger?.requiresSelection === false;
}

export function requiresWorkflowSelection(manifest: WorkflowManifest) {
  return !canWorkflowRunWithoutSelection(manifest);
}
