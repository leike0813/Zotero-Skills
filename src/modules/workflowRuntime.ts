import { getPref, setPref } from "../utils/prefs";
import { joinPath } from "../utils/path";
import { loadWorkflowManifests } from "../workflows/loader";
import type { LoadedWorkflow, LoadedWorkflows } from "../workflows/types";

function getDefaultWorkflowDir() {
  const runtime = globalThis as {
    Zotero?: { DataDirectory?: { dir?: string } };
    process?: { cwd?: () => string };
  };
  const dataDir = runtime.Zotero?.DataDirectory?.dir;
  if (typeof dataDir === "string" && dataDir.length > 0) {
    return joinPath(dataDir, "zotero-skills", "workflows");
  }
  const cwd = runtime.process?.cwd?.();
  if (cwd) {
    return joinPath(cwd, "workflows");
  }
  return "workflows";
}

function readTestWorkflowDirOverride() {
  const runtime = globalThis as {
    __zoteroSkillsDisableWorkflowDirOverride?: boolean;
    process?: { env?: Record<string, string | undefined> };
    Services?: { env?: { get?: (key: string) => string } };
  };

  if (runtime.__zoteroSkillsDisableWorkflowDirOverride) {
    return "";
  }

  const fromProcess = runtime.process?.env?.ZOTERO_TEST_WORKFLOW_DIR;
  if (typeof fromProcess === "string" && fromProcess.trim().length > 0) {
    return fromProcess.trim();
  }

  if (typeof runtime.Services?.env?.get === "function") {
    try {
      const fromServices = runtime.Services.env.get("ZOTERO_TEST_WORKFLOW_DIR");
      if (typeof fromServices === "string" && fromServices.trim().length > 0) {
        return fromServices.trim();
      }
    } catch {
      // ignore env read failures
    }
  }

  return "";
}

function emptyLoadedWorkflows(): LoadedWorkflows {
  return {
    workflows: [],
    manifests: [],
    warnings: [],
    errors: [],
    diagnostics: [],
  };
}

let fallbackWorkflowState:
  | {
      workflowsDir: string;
      loaded: LoadedWorkflows;
    }
  | undefined;

function getState() {
  if (
    typeof addon !== "undefined" &&
    addon &&
    typeof addon === "object" &&
    addon.data
  ) {
    if (!addon.data.workflow) {
      addon.data.workflow = {
        workflowsDir: "",
        loaded: emptyLoadedWorkflows(),
      };
    }
    return addon.data.workflow;
  }
  if (!fallbackWorkflowState) {
    fallbackWorkflowState = {
      workflowsDir: "",
      loaded: emptyLoadedWorkflows(),
    };
  }
  return fallbackWorkflowState;
}

export function getEffectiveWorkflowDir() {
  const current = String(getPref("workflowDir") || "").trim();
  if (current) {
    return current;
  }

  const testOverride = readTestWorkflowDirOverride();
  if (testOverride) {
    setPref("workflowDir", testOverride);
    return testOverride;
  }

  const fallback = getDefaultWorkflowDir();
  setPref("workflowDir", fallback);
  return fallback;
}

export async function rescanWorkflowRegistry(args?: { workflowsDir?: string }) {
  const workflowsDir = String(args?.workflowsDir || getEffectiveWorkflowDir()).trim();
  const loaded = await loadWorkflowManifests(workflowsDir);

  const state = getState();
  state.workflowsDir = workflowsDir;
  state.loaded = loaded;
  return state;
}

export function getWorkflowRegistryState() {
  return getState();
}

export function getLoadedWorkflowEntries(): LoadedWorkflow[] {
  return getState().loaded.workflows;
}
