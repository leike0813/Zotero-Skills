import type { WorkflowManifest } from "./types";
import {
  DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE,
  PASS_THROUGH_BACKEND_TYPE,
} from "../config/defaults";

export type LoaderDiagnosticLevel = "warning" | "error";

export type LoaderDiagnosticCategory =
  | "manifest_parse_error"
  | "manifest_validation_error"
  | "hook_missing_error"
  | "hook_import_error"
  | "scan_path_error"
  | "scan_runtime_warning";

export type LoaderDiagnostic = {
  level: LoaderDiagnosticLevel;
  category: LoaderDiagnosticCategory;
  message: string;
  entry?: string;
  workflowId?: string;
  path?: string;
  reason?: string;
};

export class WorkflowLoaderDiagnosticError extends Error {
  readonly category: LoaderDiagnosticCategory;

  readonly entry?: string;

  readonly workflowId?: string;

  readonly path?: string;

  readonly reason?: string;

  constructor(args: {
    category: LoaderDiagnosticCategory;
    message: string;
    entry?: string;
    workflowId?: string;
    path?: string;
    reason?: string;
  }) {
    super(args.message);
    this.name = "WorkflowLoaderDiagnosticError";
    this.category = args.category;
    this.entry = args.entry;
    this.workflowId = args.workflowId;
    this.path = args.path;
    this.reason = args.reason;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidParameterSchema(
  value: unknown,
): value is import("./types").WorkflowParameterSchema {
  if (!isObject(value)) {
    return false;
  }
  const type = value.type;
  if (type !== "string" && type !== "number" && type !== "boolean") {
    return false;
  }
  if (
    typeof value.min !== "undefined" &&
    (typeof value.min !== "number" || !Number.isFinite(value.min))
  ) {
    return false;
  }
  if (
    typeof value.max !== "undefined" &&
    (typeof value.max !== "number" || !Number.isFinite(value.max))
  ) {
    return false;
  }
  if (
    typeof value.min === "number" &&
    typeof value.max === "number" &&
    value.min > value.max
  ) {
    return false;
  }
  if (
    typeof value.enum !== "undefined" &&
    (!Array.isArray(value.enum) || value.enum.length === 0)
  ) {
    return false;
  }
  return true;
}

function hasValidParameters(value: unknown) {
  if (typeof value === "undefined") {
    return true;
  }
  if (!isObject(value)) {
    return false;
  }
  for (const entry of Object.values(value)) {
    if (!isValidParameterSchema(entry)) {
      return false;
    }
  }
  return true;
}

function hasDeprecatedWorkflowFields(value: Record<string, unknown>) {
  if (typeof value.backend !== "undefined") {
    return true;
  }
  if (typeof value.defaults !== "undefined") {
    return true;
  }
  const request = value.request;
  if (!isObject(request)) {
    return false;
  }
  if (typeof request.result !== "undefined") {
    return true;
  }
  const create = request.create;
  if (!isObject(create)) {
    return false;
  }
  return (
    typeof create.engine !== "undefined" ||
    typeof create.parameter !== "undefined" ||
    typeof create.model !== "undefined" ||
    typeof create.runtime_options !== "undefined"
  );
}

export function inferProviderFromRequestKind(kind: string) {
  const normalized = String(kind || "").trim();
  if (!normalized) {
    return "";
  }
  for (const [backendType, requestKind] of Object.entries(
    DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE,
  )) {
    if (requestKind === normalized) {
      return backendType;
    }
  }
  return "";
}

export function normalizeManifestProvider(manifest: WorkflowManifest) {
  const declared = String(manifest.provider || "").trim();
  if (declared) {
    manifest.provider = declared;
    return manifest;
  }
  const inferred = inferProviderFromRequestKind(manifest.request?.kind || "");
  if (inferred) {
    manifest.provider = inferred;
  }
  return manifest;
}

export function resolveBuildStrategy(manifest: WorkflowManifest) {
  if (manifest.hooks.buildRequest) {
    return "hook" as const;
  }
  if (manifest.request) {
    return "declarative" as const;
  }
  if (manifest.provider === PASS_THROUGH_BACKEND_TYPE) {
    return "declarative" as const;
  }
  return null;
}

export function parseWorkflowManifestFromText(args: {
  raw: string;
  manifestPath: string;
}) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(args.raw);
  } catch (error) {
    return {
      manifest: null,
      diagnostic: createLoaderDiagnostic({
        level: "warning",
        category: "manifest_parse_error",
        message: `Invalid workflow manifest: ${args.manifestPath}`,
        path: args.manifestPath,
        reason: String(error),
      }),
    };
  }
  if (!isManifestLike(parsed)) {
    return {
      manifest: null,
      diagnostic: createLoaderDiagnostic({
        level: "warning",
        category: "manifest_validation_error",
        message: `Invalid workflow manifest: ${args.manifestPath}`,
        path: args.manifestPath,
        reason: "manifest schema mismatch",
      }),
    };
  }
  return {
    manifest: normalizeManifestProvider(parsed),
    diagnostic: null,
  };
}

function isManifestLike(value: unknown): value is WorkflowManifest {
  if (!isObject(value)) {
    return false;
  }
  if (hasDeprecatedWorkflowFields(value)) {
    return false;
  }
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.label) &&
    isObject(value.hooks) &&
    isNonEmptyString(value.hooks.applyResult) &&
    hasValidParameters(value.parameters)
  );
}

export function createLoaderDiagnostic(
  args: Omit<LoaderDiagnostic, "entry" | "workflowId" | "path" | "reason"> &
    Partial<Pick<LoaderDiagnostic, "entry" | "workflowId" | "path" | "reason">>,
): LoaderDiagnostic {
  return {
    level: args.level,
    category: args.category,
    message: args.message,
    entry: args.entry,
    workflowId: args.workflowId,
    path: args.path,
    reason: args.reason,
  };
}

function compareByString(a: string | undefined, b: string | undefined) {
  return String(a || "").localeCompare(String(b || ""));
}

export function sortLoaderDiagnostics(input: LoaderDiagnostic[]) {
  return [...input].sort((a, b) => {
    const byLevel = compareByString(a.level, b.level);
    if (byLevel !== 0) {
      return byLevel;
    }
    const byCategory = compareByString(a.category, b.category);
    if (byCategory !== 0) {
      return byCategory;
    }
    const byWorkflowId = compareByString(a.workflowId, b.workflowId);
    if (byWorkflowId !== 0) {
      return byWorkflowId;
    }
    const byEntry = compareByString(a.entry, b.entry);
    if (byEntry !== 0) {
      return byEntry;
    }
    const byPath = compareByString(a.path, b.path);
    if (byPath !== 0) {
      return byPath;
    }
    const byMessage = compareByString(a.message, b.message);
    if (byMessage !== 0) {
      return byMessage;
    }
    return compareByString(a.reason, b.reason);
  });
}

export function normalizeDirectoryEntries(entries: string[]) {
  return [...entries]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function toDiagnosticFromUnknown(args: {
  error: unknown;
  fallback: LoaderDiagnostic;
}) {
  const typed = args.error as Partial<WorkflowLoaderDiagnosticError>;
  if (
    args.error instanceof Error &&
    typed.name === "WorkflowLoaderDiagnosticError" &&
    typeof typed.category === "string"
  ) {
    return createLoaderDiagnostic({
      level: "warning",
      category: typed.category as LoaderDiagnosticCategory,
      message: typed.message || args.fallback.message,
      entry: typed.entry || args.fallback.entry,
      workflowId: typed.workflowId || args.fallback.workflowId,
      path: typed.path || args.fallback.path,
      reason: typed.reason || args.fallback.reason,
    });
  }
  return createLoaderDiagnostic({
    ...args.fallback,
    reason: String(args.error),
  });
}
