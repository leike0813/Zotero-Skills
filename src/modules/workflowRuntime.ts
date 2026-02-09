import { getPref, setPref } from "../utils/prefs";
import { loadWorkflowManifests } from "../workflows/loader";
import type { LoadedWorkflow, LoadedWorkflows } from "../workflows/types";

function getPathSeparator() {
  const runtime = globalThis as { Zotero?: { isWin?: boolean } };
  if (typeof runtime.Zotero?.isWin === "boolean") {
    return runtime.Zotero.isWin ? "\\" : "/";
  }
  const processObj = (globalThis as { process?: { platform?: string } }).process;
  return processObj?.platform === "win32" ? "\\" : "/";
}

function joinPath(...segments: string[]) {
  const runtime = globalThis as { PathUtils?: { join?: (...parts: string[]) => string } };
  if (typeof runtime.PathUtils?.join === "function") {
    return runtime.PathUtils.join(...segments.filter(Boolean));
  }
  const separator = getPathSeparator();
  const firstNonEmpty = segments.find((segment) => String(segment || "").length > 0) || "";
  const isPosixAbsolute = firstNonEmpty.startsWith("/");
  const driveMatch = firstNonEmpty.match(/^([A-Za-z]:)[\\/]?/);
  const drivePrefix = driveMatch?.[1] || "";
  const normalized = segments
    .flatMap((segment) => String(segment || "").split(/[\\/]+/))
    .filter(Boolean);
  if (normalized.length === 0) {
    if (drivePrefix) {
      return `${drivePrefix}${separator}`;
    }
    return isPosixAbsolute ? separator : "";
  }
  if (
    drivePrefix &&
    normalized[0].toLowerCase() === drivePrefix.toLowerCase()
  ) {
    normalized.shift();
  }
  const joined = normalized.join(separator);
  if (drivePrefix) {
    return `${drivePrefix}${separator}${joined}`;
  }
  if (isPosixAbsolute) {
    return `${separator}${joined}`;
  }
  return joined;
}

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

function emptyLoadedWorkflows(): LoadedWorkflows {
  return {
    workflows: [],
    manifests: [],
    warnings: [],
    errors: [],
  };
}

function getState() {
  if (!addon.data.workflow) {
    addon.data.workflow = {
      workflowsDir: "",
      loaded: emptyLoadedWorkflows(),
    };
  }
  return addon.data.workflow;
}

export function getEffectiveWorkflowDir() {
  const current = String(getPref("workflowDir") || "").trim();
  if (current) {
    return current;
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
