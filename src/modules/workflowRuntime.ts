import { getPref, setPref } from "../utils/prefs";
import { joinPath } from "../utils/path";
import { resolveRuntimeAddon } from "../utils/runtimeBridge";
import { loadWorkflowManifests } from "../workflows/loader";
import type { LoadedWorkflow, LoadedWorkflows } from "../workflows/types";
import { getBuiltinWorkflowTargetDir } from "./builtinWorkflowSync";

type WorkflowSourceKind = "builtin" | "user";

type WorkflowRuntimeState = {
  workflowsDir: string;
  builtinWorkflowsDir: string;
  workflowSourceById: Record<string, WorkflowSourceKind>;
  loaded: LoadedWorkflows;
  loadedFromBuiltin: LoadedWorkflows;
  loadedFromUser: LoadedWorkflows;
};

export function getDefaultWorkflowDir() {
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

function emptyWorkflowRuntimeState(): WorkflowRuntimeState {
  return {
    workflowsDir: "",
    builtinWorkflowsDir: "",
    workflowSourceById: {},
    loaded: emptyLoadedWorkflows(),
    loadedFromBuiltin: emptyLoadedWorkflows(),
    loadedFromUser: emptyLoadedWorkflows(),
  };
}

let fallbackWorkflowState:
  | WorkflowRuntimeState
  | undefined;

function ensureRuntimeStateShape(value: unknown): WorkflowRuntimeState {
  const state = (value || {}) as Partial<WorkflowRuntimeState>;
  return {
    workflowsDir: String(state.workflowsDir || ""),
    builtinWorkflowsDir: String(state.builtinWorkflowsDir || ""),
    workflowSourceById: {
      ...((state.workflowSourceById || {}) as Record<string, WorkflowSourceKind>),
    },
    loaded: state.loaded || emptyLoadedWorkflows(),
    loadedFromBuiltin: state.loadedFromBuiltin || emptyLoadedWorkflows(),
    loadedFromUser: state.loadedFromUser || emptyLoadedWorkflows(),
  };
}

function getState() {
  const runtimeAddon = resolveRuntimeAddon();
  if (runtimeAddon?.data) {
    const current = ensureRuntimeStateShape(
      (runtimeAddon.data as { workflow?: unknown }).workflow,
    );
    (runtimeAddon.data as { workflow?: unknown }).workflow = current;
    return current;
  }
  if (!fallbackWorkflowState) {
    fallbackWorkflowState = emptyWorkflowRuntimeState();
  }
  return fallbackWorkflowState;
}

export function getBuiltinWorkflowDir() {
  return getBuiltinWorkflowTargetDir();
}

function sortWorkflows(workflows: LoadedWorkflow[]) {
  return [...workflows].sort((left, right) =>
    left.manifest.id.localeCompare(right.manifest.id),
  );
}

async function loadMergedWorkflowManifests(args: {
  workflowsDir: string;
  builtinWorkflowsDir: string;
}) {
  const [loadedFromBuiltin, loadedFromUser] = await Promise.all([
    loadWorkflowManifests(args.builtinWorkflowsDir),
    loadWorkflowManifests(args.workflowsDir),
  ]);

  const byWorkflowId = new Map<string, LoadedWorkflow>();
  const workflowSourceById: Record<string, WorkflowSourceKind> = {};
  const duplicateWarnings: string[] = [];

  for (const entry of loadedFromBuiltin.workflows) {
    const workflowId = String(entry.manifest.id || "").trim();
    if (!workflowId) {
      continue;
    }
    byWorkflowId.set(workflowId, entry);
    workflowSourceById[workflowId] = "builtin";
  }

  for (const entry of loadedFromUser.workflows) {
    const workflowId = String(entry.manifest.id || "").trim();
    if (!workflowId) {
      continue;
    }
    if (workflowSourceById[workflowId] === "builtin") {
      duplicateWarnings.push(
        `Workflow "${workflowId}" exists in builtin and user directories; using user workflow`,
      );
    }
    byWorkflowId.set(workflowId, entry);
    workflowSourceById[workflowId] = "user";
  }

  const workflows = sortWorkflows(Array.from(byWorkflowId.values()));
  const merged: LoadedWorkflows = {
    workflows,
    manifests: workflows.map((entry) => entry.manifest),
    warnings: [
      ...loadedFromBuiltin.warnings,
      ...loadedFromUser.warnings,
      ...duplicateWarnings,
    ],
    errors: [...loadedFromBuiltin.errors, ...loadedFromUser.errors],
    diagnostics: [
      ...(loadedFromBuiltin.diagnostics || []),
      ...(loadedFromUser.diagnostics || []),
    ],
  };

  return {
    merged,
    loadedFromBuiltin,
    loadedFromUser,
    workflowSourceById,
  };
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

export async function ensureDefaultWorkflowDirExistsOnStartup() {
  const targetDir = String(getDefaultWorkflowDir() || "").trim();
  if (!targetDir) {
    return false;
  }
  const runtime = globalThis as {
    IOUtils?: {
      makeDirectory?: (
        path: string,
        options?: { createAncestors?: boolean },
      ) => Promise<void>;
    };
  };
  if (typeof runtime.IOUtils?.makeDirectory !== "function") {
    const zoteroRuntime = globalThis as {
      Zotero?: {
        File?: {
          pathToFile?: (path: string) => unknown;
          createDirectoryIfMissingAsync?: (dir: unknown) => Promise<void>;
        };
      };
    };
    if (
      typeof zoteroRuntime.Zotero?.File?.pathToFile === "function" &&
      typeof zoteroRuntime.Zotero?.File?.createDirectoryIfMissingAsync ===
        "function"
    ) {
      try {
        const targetDirFile = zoteroRuntime.Zotero.File.pathToFile(targetDir);
        await zoteroRuntime.Zotero.File.createDirectoryIfMissingAsync(
          targetDirFile,
        );
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
  try {
    await runtime.IOUtils.makeDirectory(targetDir, {
      createAncestors: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function rescanWorkflowRegistry(args?: { workflowsDir?: string }) {
  const workflowsDir = String(args?.workflowsDir || getEffectiveWorkflowDir()).trim();
  const builtinWorkflowsDir = getBuiltinWorkflowDir();
  const {
    merged,
    loadedFromBuiltin,
    loadedFromUser,
    workflowSourceById,
  } = await loadMergedWorkflowManifests({
    workflowsDir,
    builtinWorkflowsDir,
  });

  const state = getState();
  state.workflowsDir = workflowsDir;
  state.builtinWorkflowsDir = builtinWorkflowsDir;
  state.loaded = merged;
  state.loadedFromBuiltin = loadedFromBuiltin;
  state.loadedFromUser = loadedFromUser;
  state.workflowSourceById = workflowSourceById;
  return state;
}

export function getWorkflowRegistryState() {
  return getState();
}

export function getLoadedWorkflowEntries(): LoadedWorkflow[] {
  return getState().loaded.workflows;
}

export function getLoadedWorkflowSourceById(
  workflowId: string,
): WorkflowSourceKind | "" {
  const normalizedId = String(workflowId || "").trim();
  if (!normalizedId) {
    return "";
  }
  return getState().workflowSourceById[normalizedId] || "";
}
