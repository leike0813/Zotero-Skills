import {
  createBackendsPrefsDocument,
  loadBackendsRegistry,
} from "../backends/registry";
import type { BackendInstance } from "../backends/types";
import { getPref, setPref } from "../utils/prefs";
import { SkillRunnerCtlBridge, type SkillRunnerCtlCommandResult } from "./skillRunnerCtlBridge";
import {
  installSkillRunnerRelease,
  type ReleaseInstallResult,
} from "./skillRunnerReleaseInstaller";
import { getPathSeparator, joinPath } from "../utils/path";
import {
  appendSkillRunnerLocalDeployDebugLog,
  resetSkillRunnerLocalDeployDebugSession,
} from "./skillRunnerLocalDeployDebugStore";
import { showWorkflowToast } from "./workflowExecution/feedbackSeam";
import { reconcileSkillRunnerBackendTaskLedgerOnce } from "./skillRunnerTaskReconciler";
import {
  MANAGED_LOCAL_BACKEND_ID,
  normalizeManagedLocalBackendId,
} from "./skillRunnerLocalRuntimeConstants";
import { resolveManagedLocalRuntimeToastText } from "../utils/localizationGovernance";

type DynamicImport = (specifier: string) => Promise<any>;

const dynamicImport: DynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as DynamicImport;

const MANAGED_PROFILE_ID = MANAGED_LOCAL_BACKEND_ID;
const DEFAULT_MANAGED_LOCAL_HOST = "127.0.0.1";
const DEFAULT_MANAGED_LOCAL_PORT = 29813;
const DEFAULT_MANAGED_LOCAL_PORT_FALLBACK_SPAN = 10;
const DEFAULT_LOCAL_RUNTIME_VERSION = "v0.4.4";
const DEFAULT_SKILL_RUNNER_RELEASE_REPO = "leike0813/Skill-Runner";
const STATE_PREF_KEY = "skillRunnerLocalRuntimeStateJson";
const VERSION_PREF_KEY = "skillRunnerLocalRuntimeVersion";
const DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 20;
const LEASE_OWNER_ID = "zotero-plugin";
const BACKENDS_CONFIG_PREF_KEY = "backendsConfigJson";
const RUNTIME_STATUS_POLL_ATTEMPTS = 5;
const RUNTIME_STATUS_POLL_INTERVAL_MS = 2000;
const AUTO_ENSURE_INTERVAL_MS = 15000;
const LOCAL_RUNTIME_TOAST_DEDUP_WINDOW_MS = 5000;
const LOCAL_RUNTIME_TOAST_TYPE = "skillrunner-backend";

type RuntimeState =
  | "unknown"
  | "starting"
  | "running"
  | "stopped"
  | "degraded"
  | "reconciling_after_heartbeat_fail";
type LeaseViewState = "pending" | "acquired" | "conflict" | "failed";
type MonitoringState = "inactive" | "heartbeat" | "reconciling";

type LeaseState = {
  acquired?: boolean;
  stoppedByConflict?: boolean;
  leaseId?: string;
  heartbeatIntervalSeconds?: number;
  lastAcquireAt?: string;
  lastHeartbeatAt?: string;
  lastError?: string;
};

type BootstrapReportSummary = {
  bootstrapReportFile: string;
  bootstrapOutcome: "ok" | "partial_failure";
  bootstrapFailedEngines: string[];
  bootstrapWarning?: string;
};

export type ManagedLocalRuntimeState = {
  managedBackendId?: string;
  versionTag?: string;
  installDir?: string;
  ctlPath?: string;
  baseUrl?: string;
  runtimeHost?: string;
  runtimePort?: number;
  runtimeUrl?: string;
  requestedPort?: number;
  portFallbackSpan?: number;
  portFallbackUsed?: boolean;
  triedPorts?: number[];
  lease?: LeaseState;
  runtimeState?: RuntimeState;
  runtimeFailureCount?: number;
  deployedAt?: string;
  lastRuntimeStatusAt?: string;
  lastDeployError?: string;
  lastRuntimeError?: string;
  // Deprecated: persisted compatibility field only, no longer used as runtime control source.
  autoStartPaused?: boolean;
  updatedAt?: string;
};

export type SkillRunnerLocalRuntimeActionResult = {
  ok: boolean;
  message: string;
  stage: string;
  conflict?: boolean;
  details?: Record<string, unknown>;
};

type LeaseHttpResult = {
  ok: boolean;
  status?: number;
  body?: Record<string, unknown>;
  error?: string;
};

type AutoEnsureTickResult = {
  ok: boolean;
  stage: string;
  message: string;
};

type EnsureManagedLocalRuntimeOptions = {
  ignoreAutoStartPaused?: boolean;
  backgroundInFlightAction?: string;
};

let autoStartEnabledInSession = false;
type ManagedLocalRuntimeStateChangeListener = () => void;
const managedLocalRuntimeStateChangeListeners = new Set<ManagedLocalRuntimeStateChangeListener>();
let pendingAutoEnsureTickTimer: ReturnType<typeof setTimeout> | undefined;
let suppressAutoEnsureTriggerForTests = false;
type LocalRuntimeToastKind =
  | "runtime-up"
  | "runtime-down"
  | "runtime-abnormal-stop";
type LocalRuntimeToastPayload = {
  kind: LocalRuntimeToastKind;
  text: string;
  type: string;
};
const localRuntimeToastDedup = new Map<string, number>();
let localRuntimeToastEmitter: (payload: LocalRuntimeToastPayload) => void = (
  payload,
) => {
  showWorkflowToast({
    text: payload.text,
    type: payload.type as any,
  });
};

type LocalRuntimePostUpTaskReconcileArgs = {
  backendId: string;
  displayName?: string;
  baseUrl: string;
  source: "local-runtime-up";
};

let localRuntimePostUpTaskReconcileRunner: (
  args: LocalRuntimePostUpTaskReconcileArgs,
) => Promise<void> = async (args) => {
  await reconcileSkillRunnerBackendTaskLedgerOnce({
    backend: {
      id: args.backendId,
      displayName: args.displayName,
      type: "skillrunner",
      baseUrl: args.baseUrl,
      auth: {
        kind: "none",
      },
    },
    source: args.source,
    emitFailureToast: true,
  });
};

function notifyManagedLocalRuntimeStateChanged() {
  for (const listener of Array.from(managedLocalRuntimeStateChangeListeners)) {
    try {
      listener();
    } catch {
      // keep notification best-effort and non-blocking
    }
  }
}

export function subscribeManagedLocalRuntimeStateChange(
  listener: ManagedLocalRuntimeStateChangeListener,
) {
  managedLocalRuntimeStateChangeListeners.add(listener);
  return () => {
    managedLocalRuntimeStateChangeListeners.delete(listener);
  };
}

export function emitManagedLocalRuntimeStateChangedForTests() {
  notifyManagedLocalRuntimeStateChanged();
}

export function resetManagedLocalRuntimeStateChangeListenersForTests() {
  managedLocalRuntimeStateChangeListeners.clear();
}

function emitLocalRuntimeToast(kind: LocalRuntimeToastKind) {
  const now = Date.now();
  const last = localRuntimeToastDedup.get(kind) || 0;
  if (now - last < LOCAL_RUNTIME_TOAST_DEDUP_WINDOW_MS) {
    return;
  }
  localRuntimeToastDedup.set(kind, now);
  const text = resolveManagedLocalRuntimeToastText(kind);
  try {
    localRuntimeToastEmitter({
      kind,
      text,
      type: LOCAL_RUNTIME_TOAST_TYPE,
    });
  } catch {
    // ignore toast failures
  }
}

export function setLocalRuntimeToastEmitterForTests(
  emitter?: (payload: LocalRuntimeToastPayload) => void,
) {
  localRuntimeToastEmitter = emitter || ((payload) => {
    showWorkflowToast({
      text: payload.text,
      type: payload.type as any,
    });
  });
}

export function resetLocalRuntimeToastStateForTests() {
  localRuntimeToastDedup.clear();
  setLocalRuntimeToastEmitterForTests();
}

export function setManagedLocalRuntimePostUpTaskReconcileRunnerForTests(
  runner?: (args: LocalRuntimePostUpTaskReconcileArgs) => Promise<void>,
) {
  localRuntimePostUpTaskReconcileRunner =
    runner ||
    (async (args) => {
      await reconcileSkillRunnerBackendTaskLedgerOnce({
        backend: {
          id: args.backendId,
          displayName: args.displayName,
          type: "skillrunner",
          baseUrl: args.baseUrl,
          auth: {
            kind: "none",
          },
        },
        source: args.source,
        emitFailureToast: true,
      });
    });
}

function triggerManagedLocalRuntimePostUpTaskReconcile(state: ManagedLocalRuntimeState) {
  const backendId = normalizeString(state.managedBackendId) || MANAGED_PROFILE_ID;
  const baseUrl = resolveManagedBaseUrl(state);
  void localRuntimePostUpTaskReconcileRunner({
    backendId,
    displayName: undefined,
    baseUrl,
    source: "local-runtime-up",
  });
}

export function resetManagedRuntimeAsyncTriggerForTests() {
  if (!pendingAutoEnsureTickTimer) {
    runtimeActionInFlight = "";
    backgroundInFlightAction = "";
    return;
  }
  clearTimeout(pendingAutoEnsureTickTimer);
  pendingAutoEnsureTickTimer = undefined;
  runtimeActionInFlight = "";
  backgroundInFlightAction = "";
}

export function setSuppressManagedRuntimeAutoEnsureTriggerForTests(
  suppress: boolean,
) {
  suppressAutoEnsureTriggerForTests = suppress === true;
}

export function resetLocalRuntimeAutoStartSessionState() {
  const next = false;
  const changed = autoStartEnabledInSession !== next;
  autoStartEnabledInSession = next;
  if (changed) {
    notifyManagedLocalRuntimeStateChanged();
  }
}

function setAutoStartEnabledInSession(enabled: boolean) {
  const next = enabled === true;
  const changed = autoStartEnabledInSession !== next;
  autoStartEnabledInSession = next;
  if (changed) {
    notifyManagedLocalRuntimeStateChanged();
  }
}

function normalizeString(value: unknown) {
  return String(value || "").trim();
}

function detectWindows() {
  return getPathSeparator() === "\\";
}

function readProcessEnv(name: string) {
  const runtime = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  return normalizeString(runtime.process?.env?.[name]);
}

function readDirectoryServicePath(key: string) {
  const runtime = globalThis as {
    Services?: {
      dirsvc?: {
        get?: (name: string, iface: unknown) => { path?: string };
      };
    };
    Ci?: { nsIFile?: unknown };
  };
  if (!runtime.Services?.dirsvc?.get || !runtime.Ci?.nsIFile) {
    return "";
  }
  try {
    const file = runtime.Services.dirsvc.get(key, runtime.Ci.nsIFile);
    return normalizeString(file?.path);
  } catch {
    return "";
  }
}

function resolveDefaultInstallRoot() {
  if (detectWindows()) {
    const localAppData =
      readProcessEnv("LOCALAPPDATA") ||
      readProcessEnv("LocalAppData") ||
      readDirectoryServicePath("LocalAppData");
    if (localAppData) {
      return joinPath(localAppData, "SkillRunner", "releases");
    }
    const home = readProcessEnv("USERPROFILE") || readDirectoryServicePath("Home");
    if (home) {
      return joinPath(home, "AppData", "Local", "SkillRunner", "releases");
    }
    return "";
  }
  const home = readProcessEnv("HOME") || readDirectoryServicePath("Home");
  if (home) {
    return joinPath(home, ".local", "share", "skill-runner", "releases");
  }
  return "";
}

function nowIso() {
  return new Date().toISOString();
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  const numeric =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number.parseInt(String(value || "").trim(), 10);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric);
  }
  return fallback;
}

function normalizeNonNegativeInteger(value: unknown, fallback: number) {
  const numeric =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number.parseInt(String(value || "").trim(), 10);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.floor(numeric);
  }
  return fallback;
}

function normalizePort(value: unknown, fallback: number) {
  const numeric =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number.parseInt(String(value || "").trim(), 10);
  if (Number.isFinite(numeric)) {
    const port = Math.floor(numeric);
    if (port >= 1 && port <= 65535) {
      return port;
    }
  }
  return fallback;
}

function buildBaseUrl(host: string, port: number) {
  return `http://${host}:${port}`;
}

function normalizeUrl(value: unknown) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return "";
  }
  try {
    const parsed = new URL(normalized);
    return parsed.toString();
  } catch {
    return "";
  }
}

function parseEndpointFromUrl(value: unknown) {
  const normalized = normalizeUrl(value);
  if (!normalized) {
    return null;
  }
  try {
    const parsed = new URL(normalized);
    const host = normalizeString(parsed.hostname) || DEFAULT_MANAGED_LOCAL_HOST;
    const portFromUrl = normalizeString(parsed.port);
    const port = portFromUrl
      ? normalizePort(portFromUrl, DEFAULT_MANAGED_LOCAL_PORT)
      : normalizePort(
          parsed.protocol.toLowerCase() === "https:" ? 443 : 80,
          DEFAULT_MANAGED_LOCAL_PORT,
        );
    return {
      host,
      port,
      url: parsed.toString(),
    };
  } catch {
    return null;
  }
}

function normalizeNumberArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as number[];
  }
  return value
    .map((entry) => normalizePort(entry, -1))
    .filter((entry) => entry >= 1 && entry <= 65535);
}

type RuntimeEndpoint = {
  host: string;
  port: number;
  url: string;
  requestedPort: number;
  portFallbackSpan: number;
};

function resolveRuntimeEndpoint(state: ManagedLocalRuntimeState | undefined): RuntimeEndpoint {
  const normalizedState = state || {};
  const parsedFromRuntimeUrl = parseEndpointFromUrl(normalizedState.runtimeUrl);
  const parsedFromBaseUrl = parseEndpointFromUrl(normalizedState.baseUrl);
  const host =
    normalizeString(normalizedState.runtimeHost) ||
    parsedFromRuntimeUrl?.host ||
    parsedFromBaseUrl?.host ||
    DEFAULT_MANAGED_LOCAL_HOST;
  const port = normalizePort(
    normalizedState.runtimePort,
    parsedFromRuntimeUrl?.port ||
      parsedFromBaseUrl?.port ||
      DEFAULT_MANAGED_LOCAL_PORT,
  );
  const requestedPort = normalizePort(
    normalizedState.requestedPort,
    port,
  );
  const portFallbackSpan = normalizePortFallbackSpan(normalizedState.portFallbackSpan);
  const url = normalizeUrl(normalizedState.runtimeUrl) || `${buildBaseUrl(host, port)}/`;
  return {
    host,
    port,
    url,
    requestedPort,
    portFallbackSpan,
  };
}

function normalizePortFallbackSpan(value: unknown) {
  return normalizeNonNegativeInteger(value, DEFAULT_MANAGED_LOCAL_PORT_FALLBACK_SPAN);
}

function normalizeHeartbeatIntervalSeconds(value: unknown) {
  return normalizePositiveInteger(value, DEFAULT_HEARTBEAT_INTERVAL_SECONDS);
}

function resolveHeartbeatIntervalMs(lease: LeaseState | undefined) {
  return normalizeHeartbeatIntervalSeconds(lease?.heartbeatIntervalSeconds) * 1000;
}

function normalizeRuntimeState(value: unknown): RuntimeState {
  const normalized = normalizeString(value).toLowerCase();
  if (
    normalized === "starting" ||
    normalized === "running" ||
    normalized === "stopped" ||
    normalized === "degraded" ||
    normalized === "reconciling_after_heartbeat_fail"
  ) {
    return normalized;
  }
  return "unknown";
}

function normalizeRuntimeFailureCount(value: unknown) {
  return normalizePositiveInteger(value, 0);
}

function normalizeAutoStartPaused(value: unknown) {
  if (value === true) {
    return true;
  }
  if (value === false) {
    return false;
  }
  return undefined;
}

function isAutoStartPaused() {
  return autoStartEnabledInSession !== true;
}

async function sleepMs(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.floor(ms))));
}

async function readTextFile(filePath: string) {
  const runtime = globalThis as {
    IOUtils?: { readUTF8?: (path: string) => Promise<string> };
  };
  if (typeof runtime.IOUtils?.readUTF8 === "function") {
    return runtime.IOUtils.readUTF8(filePath);
  }
  const fs = await dynamicImport("fs/promises");
  return fs.readFile(filePath, "utf8") as Promise<string>;
}

async function pathExists(pathValue: string) {
  const normalized = normalizeString(pathValue);
  if (!normalized) {
    return false;
  }
  const runtime = globalThis as {
    IOUtils?: { exists?: (path: string) => Promise<boolean> };
  };
  if (typeof runtime.IOUtils?.exists === "function") {
    try {
      const exists = !!(await runtime.IOUtils.exists(normalized));
      if (exists) {
        return true;
      }
    } catch {
      // continue to node fallback
    }
  }
  try {
    const fs = await dynamicImport("fs/promises");
    await fs.access(normalized);
    return true;
  } catch {
    return false;
  }
}

async function removePathRecursive(pathValue: string) {
  const normalized = normalizeString(pathValue);
  if (!normalized) {
    return;
  }
  const runtime = globalThis as {
    IOUtils?: {
      remove?: (
        path: string,
        options?: { ignoreAbsent?: boolean; recursive?: boolean },
      ) => Promise<void>;
    };
  };
  if (typeof runtime.IOUtils?.remove === "function") {
    await runtime.IOUtils.remove(normalized, {
      ignoreAbsent: true,
      recursive: true,
    });
    return;
  }
  const fs = await dynamicImport("fs/promises");
  await fs.rm(normalized, {
    recursive: true,
    force: true,
  });
}

function normalizeBootstrapReport(
  reportFilePath: string,
  raw: unknown,
): BootstrapReportSummary | null {
  if (!isObjectRecord(raw)) {
    return null;
  }
  const summary = isObjectRecord(raw.summary) ? raw.summary : null;
  if (!summary) {
    return null;
  }
  const outcomeRaw = normalizeString(summary.outcome).toLowerCase();
  if (outcomeRaw !== "ok" && outcomeRaw !== "partial_failure") {
    return null;
  }
  const failedEnginesRaw = Array.isArray(summary.failed_engines)
    ? summary.failed_engines
    : [];
  const failedEngines = failedEnginesRaw
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const bootstrapWarning =
    outcomeRaw === "partial_failure"
      ? `bootstrap reported partial_failure (failed_engines=${failedEngines.join(", ") || "unknown"})`
      : undefined;
  return {
    bootstrapReportFile: reportFilePath,
    bootstrapOutcome: outcomeRaw,
    bootstrapFailedEngines: failedEngines,
    ...(bootstrapWarning ? { bootstrapWarning } : {}),
  };
}

async function readBootstrapReport(args: {
  installDir: string;
  reportFilePath?: string;
}) {
  const explicitReportFilePath = normalizeString(args.reportFilePath);
  if (!explicitReportFilePath) {
    return {
      ok: false as const,
      stage: "deploy-bootstrap-report",
      message: "bootstrap report path missing in ctl bootstrap response (details.bootstrap_report_file)",
      details: {
        bootstrapReportFile: "",
        installDir: args.installDir,
      },
    };
  }
  let source = "";
  try {
    source = await readTextFile(explicitReportFilePath);
  } catch (error) {
    const message = normalizeString(
      error && typeof error === "object" && "message" in error
        ? (error as { message?: unknown }).message
        : error,
    );
    return {
      ok: false as const,
      stage: "deploy-bootstrap-report",
      message: `failed to read bootstrap report: ${message || "unknown error"}`,
      details: {
        bootstrapReportFile: explicitReportFilePath,
      },
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return {
      ok: false as const,
      stage: "deploy-bootstrap-report",
      message: "bootstrap report is not valid JSON",
      details: {
        bootstrapReportFile: explicitReportFilePath,
      },
    };
  }
  const normalized = normalizeBootstrapReport(explicitReportFilePath, parsed);
  if (!normalized) {
    return {
      ok: false as const,
      stage: "deploy-bootstrap-report",
      message: "bootstrap report is missing required summary.outcome",
      details: {
        bootstrapReportFile: explicitReportFilePath,
      },
    };
  }
  return {
    ok: true as const,
    summary: normalized,
  };
}

function getGlobalFetch() {
  const runtime = globalThis as {
    fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  };
  return runtime.fetch;
}

function buildReleaseAssetProbeTargets(version: string) {
  const normalizedVersion = normalizeString(version);
  const artifact = `skill-runner-${normalizedVersion}.tar.gz`;
  const checksum = `${artifact}.sha256`;
  const base = `https://github.com/${DEFAULT_SKILL_RUNNER_RELEASE_REPO}/releases/download/${normalizedVersion}`;
  return [
    {
      kind: "artifact",
      url: `${base}/${artifact}`,
    },
    {
      kind: "checksum",
      url: `${base}/${checksum}`,
    },
  ] as const;
}

async function probeReleaseAssets(version: string) {
  const targets = buildReleaseAssetProbeTargets(version);
  const fetchImpl = getGlobalFetch();
  if (typeof fetchImpl !== "function") {
    return {
      checked: false,
      ok: true,
      results: targets.map((target) => ({
        kind: target.kind,
        url: target.url,
        ok: false,
        skipped: true,
        reason: "fetch unavailable in current runtime",
      })),
    };
  }
  const results: Array<{
    kind: string;
    url: string;
    ok: boolean;
    status?: number;
    skipped?: boolean;
    reason?: string;
  }> = [];
  for (const target of targets) {
    try {
      const response = await fetchImpl(target.url, {
        method: "HEAD",
      });
      results.push({
        kind: target.kind,
        url: target.url,
        ok: response.ok,
        status: response.status,
      });
    } catch (error) {
      results.push({
        kind: target.kind,
        url: target.url,
        ok: false,
        reason: normalizeString(
          error && typeof error === "object" && "message" in error
            ? (error as { message?: unknown }).message
            : error,
        ),
      });
    }
  }
  return {
    checked: true,
    ok: results.every((entry) => entry.ok),
    results,
  };
}

function normalizeState(raw: unknown): ManagedLocalRuntimeState {
  if (!isObjectRecord(raw)) {
    return {};
  }
  const leaseRaw = isObjectRecord(raw.lease) ? raw.lease : {};
  const managedBackendId = normalizeManagedLocalBackendId(raw.managedBackendId);
  return {
    managedBackendId: managedBackendId || undefined,
    versionTag: normalizeString(raw.versionTag) || undefined,
    installDir: normalizeString(raw.installDir) || undefined,
    ctlPath: normalizeString(raw.ctlPath) || undefined,
    baseUrl: normalizeString(raw.baseUrl) || undefined,
    runtimeHost: normalizeString(raw.runtimeHost) || undefined,
    runtimePort: normalizePort(raw.runtimePort, -1) > 0 ? normalizePort(raw.runtimePort, -1) : undefined,
    runtimeUrl: normalizeUrl(raw.runtimeUrl) || undefined,
    requestedPort:
      normalizePort(raw.requestedPort, -1) > 0
        ? normalizePort(raw.requestedPort, -1)
        : undefined,
    portFallbackSpan: normalizePortFallbackSpan(raw.portFallbackSpan),
    portFallbackUsed: raw.portFallbackUsed === true,
    triedPorts: normalizeNumberArray(raw.triedPorts),
    runtimeState: normalizeRuntimeState(raw.runtimeState),
    runtimeFailureCount: normalizeRuntimeFailureCount(raw.runtimeFailureCount),
    deployedAt: normalizeString(raw.deployedAt) || undefined,
    lastRuntimeStatusAt: normalizeString(raw.lastRuntimeStatusAt) || undefined,
    lastDeployError: normalizeString(raw.lastDeployError) || undefined,
    lastRuntimeError: normalizeString(raw.lastRuntimeError) || undefined,
    autoStartPaused: normalizeAutoStartPaused(raw.autoStartPaused),
    updatedAt: normalizeString(raw.updatedAt) || undefined,
    lease: {
      acquired: leaseRaw.acquired === true,
      stoppedByConflict: leaseRaw.stoppedByConflict === true,
      leaseId: normalizeString(leaseRaw.leaseId) || undefined,
      heartbeatIntervalSeconds: normalizeHeartbeatIntervalSeconds(
        leaseRaw.heartbeatIntervalSeconds,
      ),
      lastAcquireAt: normalizeString(leaseRaw.lastAcquireAt) || undefined,
      lastHeartbeatAt: normalizeString(leaseRaw.lastHeartbeatAt) || undefined,
      lastError: normalizeString(leaseRaw.lastError) || undefined,
    },
  };
}

export function getDefaultSkillRunnerLocalRuntimeVersion() {
  return DEFAULT_LOCAL_RUNTIME_VERSION;
}

export function readManagedLocalRuntimeState() {
  const raw = normalizeString(getPref(STATE_PREF_KEY));
  if (!raw) {
    return {} as ManagedLocalRuntimeState;
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return {} as ManagedLocalRuntimeState;
  }
}

function writeManagedLocalRuntimeState(state: ManagedLocalRuntimeState) {
  const normalized = normalizeState(state);
  delete normalized.autoStartPaused;
  normalized.updatedAt = nowIso();
  setPref(STATE_PREF_KEY, JSON.stringify(normalized));
  notifyManagedLocalRuntimeStateChanged();
  return normalized;
}

function clearManagedLocalRuntimeState() {
  setPref(STATE_PREF_KEY, "");
  notifyManagedLocalRuntimeStateChanged();
}

function getConfiguredVersionTag() {
  return DEFAULT_LOCAL_RUNTIME_VERSION;
}

function setConfiguredVersionTag(versionTag: string) {
  const normalized = normalizeString(versionTag) || DEFAULT_LOCAL_RUNTIME_VERSION;
  setPref(VERSION_PREF_KEY, normalized);
}

function buildManagedSkillRunnerBackend(baseUrl: string): BackendInstance {
  return {
    id: MANAGED_PROFILE_ID,
    type: "skillrunner",
    baseUrl,
    auth: {
      kind: "none",
    },
    defaults: {
      timeout_ms: 600000,
      headers: {},
    },
  };
}

function getCtlBridge() {
  return ctlBridgeFactory();
}

let ctlBridgeFactory = () => new SkillRunnerCtlBridge();
let releaseInstaller = installSkillRunnerRelease;

export function setSkillRunnerCtlBridgeFactoryForTests(
  factory?: () => SkillRunnerCtlBridge,
) {
  ctlBridgeFactory = factory || (() => new SkillRunnerCtlBridge());
}

export function setSkillRunnerReleaseInstallerForTests(
  installer?: (
    args: {
      version: string;
      installRoot: string;
      repo: string;
      runCommand: (args: {
        command: string;
        args: string[];
        cwd?: string;
        timeoutMs?: number;
      }) => Promise<SkillRunnerCtlCommandResult>;
      keepTempOnSuccess?: boolean;
      keepTempOnFailure?: boolean;
    },
  ) => Promise<ReleaseInstallResult>,
) {
  releaseInstaller = installer || installSkillRunnerRelease;
}

function appendLocalRuntimeLog(args: {
  level: "info" | "warn" | "error";
  operation: string;
  stage: string;
  message: string;
  details?: unknown;
  error?: unknown;
}) {
  appendSkillRunnerLocalDeployDebugLog({
    level: args.level,
    operation: args.operation,
    stage: args.stage,
    message: args.message,
    details: args.details,
    error: args.error,
  });
}

function resultFromCtl(
  stage: string,
  result: SkillRunnerCtlCommandResult,
): SkillRunnerLocalRuntimeActionResult {
  const stderrPreview = normalizeString(result.stderr).slice(0, 320);
  const stdoutPreview = normalizeString(result.stdout).slice(0, 320);
  const baseMessage = normalizeString(result.message) || "command finished";
  const diagnosticText = [
    baseMessage,
    normalizeString(result.stderr),
    normalizeString(result.stdout),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  const npmPathHint =
    stage === "deploy-ctl-install" &&
    !result.ok &&
    diagnosticText.includes("npm") &&
    (diagnosticText.includes("filenotfounderror") ||
      diagnosticText.includes("winerror 2") ||
      diagnosticText.includes("system cannot find the file specified"))
      ? "npm executable was not resolved inside runtime environment; verify Node/npm is in system PATH and rerun install."
      : "";
  const message = result.ok
    ? `[${stage}] ${baseMessage}`
    : `[${stage}] ${baseMessage} (exit=${result.exitCode}${
        stderrPreview ? `; stderr=${stderrPreview}` : ""
      }${npmPathHint ? `; hint=${npmPathHint}` : ""})`;
  return {
    ok: result.ok,
    stage,
    message,
    details: {
      exitCode: result.exitCode,
      command: result.command,
      args: result.args,
      stdoutPreview,
      stderrPreview,
      ...(npmPathHint ? { hint: npmPathHint } : {}),
      ...(isObjectRecord(result.details) ? result.details : {}),
    },
  };
}

type RuntimeDetailsFromCtl = {
  host?: string;
  port?: number;
  url?: string;
  requestedPort?: number;
  portFallbackSpan?: number;
  portFallbackUsed?: boolean;
  triedPorts?: number[];
};

function normalizeRuntimeDetailsFromCtl(details: unknown): RuntimeDetailsFromCtl | null {
  if (!isObjectRecord(details)) {
    return null;
  }
  const rawRequestedPort = details.requested_port ?? details.requestedPort;
  const rawPortFallbackSpan =
    details.port_fallback_span ?? details.portFallbackSpan;
  const rawPortFallbackUsed =
    details.port_fallback_used ?? details.portFallbackUsed;
  const rawTriedPorts = details.tried_ports ?? details.triedPorts;
  const host = normalizeString(details.host);
  const url = normalizeUrl(details.url);
  const parsedPort = normalizePort(details.port, -1);
  const parsedRequestedPort = normalizePort(rawRequestedPort, -1);
  const parsedFallbackSpan = normalizeNonNegativeInteger(rawPortFallbackSpan, -1);
  const normalized: RuntimeDetailsFromCtl = {};
  if (host) {
    normalized.host = host;
  }
  if (parsedPort > 0) {
    normalized.port = parsedPort;
  }
  if (url) {
    normalized.url = url;
  }
  if (parsedRequestedPort > 0) {
    normalized.requestedPort = parsedRequestedPort;
  }
  if (parsedFallbackSpan >= 0) {
    normalized.portFallbackSpan = parsedFallbackSpan;
  }
  if (typeof rawPortFallbackUsed === "boolean") {
    normalized.portFallbackUsed = rawPortFallbackUsed;
  }
  const normalizedTriedPorts = normalizeNumberArray(rawTriedPorts);
  if (normalizedTriedPorts.length > 0) {
    normalized.triedPorts = normalizedTriedPorts;
  }
  return normalized;
}

function applyRuntimeEndpointFromDetails(
  state: ManagedLocalRuntimeState,
  details: unknown,
) {
  const endpoint = resolveRuntimeEndpoint(state);
  const parsed = normalizeRuntimeDetailsFromCtl(details);
  if (!parsed) {
    return state;
  }
  const nextHost = normalizeString(parsed.host) || endpoint.host;
  const nextPort = normalizePort(parsed.port, endpoint.port);
  const nextRequestedPort = normalizePort(
    parsed.requestedPort,
    state.requestedPort || endpoint.requestedPort,
  );
  const nextPortFallbackSpan = normalizePortFallbackSpan(
    typeof parsed.portFallbackSpan === "number"
      ? parsed.portFallbackSpan
      : state.portFallbackSpan,
  );
  const nextUrl = normalizeUrl(parsed.url) || `${buildBaseUrl(nextHost, nextPort)}/`;
  const nextState = writeManagedLocalRuntimeState({
    ...state,
    baseUrl: buildBaseUrl(nextHost, nextPort),
    runtimeHost: nextHost,
    runtimePort: nextPort,
    runtimeUrl: nextUrl,
    requestedPort: nextRequestedPort,
    portFallbackSpan: nextPortFallbackSpan,
    portFallbackUsed:
      typeof parsed.portFallbackUsed === "boolean"
        ? parsed.portFallbackUsed
        : state.portFallbackUsed,
    triedPorts: parsed.triedPorts || state.triedPorts,
  });
  return nextState;
}

function resolveManagedBaseUrl(state: ManagedLocalRuntimeState) {
  const endpoint = resolveRuntimeEndpoint(state);
  return buildBaseUrl(endpoint.host, endpoint.port);
}

async function postLease(path: string, body?: Record<string, unknown>): Promise<LeaseHttpResult> {
  const state = readManagedLocalRuntimeState();
  const baseUrl = resolveManagedBaseUrl(state);
  const fetchImpl = getGlobalFetch();
  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      error: "fetch unavailable in current runtime",
    };
  }
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body || {}),
    });
    const text = await response.text();
    let parsedBody: Record<string, unknown> | undefined;
    if (text.trim()) {
      try {
        const parsed = JSON.parse(text);
        if (isObjectRecord(parsed)) {
          parsedBody = parsed;
        }
      } catch {
        parsedBody = {
          raw: text,
        };
      }
    }
    return {
      ok: response.ok,
      status: response.status,
      body: parsedBody,
    };
  } catch (error) {
    return {
      ok: false,
      error: normalizeString(
        error && typeof error === "object" && "message" in error
          ? (error as { message?: unknown }).message
          : error,
      ),
    };
  }
}

let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let heartbeatRunning = false;
let heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_SECONDS * 1000;
let statusReconcileTimer: ReturnType<typeof setInterval> | undefined;
let statusReconcileRunning = false;
let autoEnsureTimer: ReturnType<typeof setInterval> | undefined;
let autoEnsureRunning = false;
let runtimeControlLock: Promise<void> = Promise.resolve();
let monitoringState: MonitoringState = "inactive";
let runtimeActionInFlight = "";
let backgroundInFlightAction = "";

function getEffectiveInFlightAction() {
  return normalizeString(runtimeActionInFlight) || normalizeString(backgroundInFlightAction);
}

function setBackgroundInFlightAction(action: string) {
  const next = normalizeString(action);
  if (backgroundInFlightAction === next) {
    return;
  }
  backgroundInFlightAction = next;
  notifyManagedLocalRuntimeStateChanged();
}

function hasRuntimeInfo(state: ManagedLocalRuntimeState | undefined) {
  const target = state || {};
  return (
    !!normalizeString(target.managedBackendId) &&
    !!normalizeString(target.ctlPath) &&
    !!normalizeString(target.installDir)
  );
}

function setMonitoringState(next: MonitoringState) {
  if (monitoringState === next) {
    return;
  }
  monitoringState = next;
  notifyManagedLocalRuntimeStateChanged();
}

function clearStatusReconcileTimer() {
  if (!statusReconcileTimer) {
    return;
  }
  clearInterval(statusReconcileTimer);
  statusReconcileTimer = undefined;
  if (!heartbeatTimer) {
    setMonitoringState("inactive");
  } else {
    setMonitoringState("heartbeat");
  }
}

function makeActionConflictResult(action: string): SkillRunnerLocalRuntimeActionResult {
  const inFlightAction = getEffectiveInFlightAction() || "unknown";
  return {
    ok: false,
    conflict: true,
    stage: `${action}-conflict`,
    message: `runtime action is already running: ${inFlightAction}`,
    details: {
      inFlightAction,
    },
  };
}

async function withRuntimeActionMutex(
  action: string,
  runner: () => Promise<SkillRunnerLocalRuntimeActionResult>,
) {
  if (getEffectiveInFlightAction()) {
    return makeActionConflictResult(action);
  }
  runtimeActionInFlight = action;
  notifyManagedLocalRuntimeStateChanged();
  try {
    return await withRuntimeControlLock(runner);
  } finally {
    runtimeActionInFlight = "";
    notifyManagedLocalRuntimeStateChanged();
  }
}

function triggerManagedRuntimeAutoEnsureTickAsync() {
  if (suppressAutoEnsureTriggerForTests) {
    return false;
  }
  if (pendingAutoEnsureTickTimer) {
    clearTimeout(pendingAutoEnsureTickTimer);
  }
  pendingAutoEnsureTickTimer = setTimeout(() => {
    pendingAutoEnsureTickTimer = undefined;
    void runManagedRuntimeAutoEnsureTick();
  }, 0);
  return true;
}

function clearHeartbeatTimer() {
  if (!heartbeatTimer) {
    return;
  }
  clearInterval(heartbeatTimer);
  heartbeatTimer = undefined;
  if (!statusReconcileTimer) {
    setMonitoringState("inactive");
  }
}

function clearAutoEnsureTimer() {
  if (!autoEnsureTimer) {
    return;
  }
  clearInterval(autoEnsureTimer);
  autoEnsureTimer = undefined;
}

function withRuntimeControlLock<T>(runner: () => Promise<T>): Promise<T> {
  const queued = runtimeControlLock.then(runner, runner);
  runtimeControlLock = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued;
}

async function acquireLeaseIfNeeded() {
  const state = readManagedLocalRuntimeState();
  const lease = state.lease || {};
  if (lease.stoppedByConflict) {
    return {
      ok: false,
      state,
      reason: "lease conflict already marked",
    };
  }
  if (lease.acquired === true && normalizeString(lease.leaseId)) {
    return {
      ok: true,
      state,
      reason: "lease already acquired",
    };
  }
  const response = await postLease("/v1/local-runtime/lease/acquire", {
    owner_id: LEASE_OWNER_ID,
    metadata: {
      client: LEASE_OWNER_ID,
    },
  });
  if (response.status === 409) {
    state.lease = {
      ...lease,
      acquired: false,
      stoppedByConflict: true,
      leaseId: undefined,
      lastError: "lease conflict (409)",
    };
    writeManagedLocalRuntimeState(state);
    appendLocalRuntimeLog({
      level: "warn",
      operation: "lease-acquire",
      stage: "local-lease-conflict",
      message: "local runtime lease conflict detected",
      details: {
        status: response.status,
      },
    });
    return {
      ok: false,
      state: readManagedLocalRuntimeState(),
      reason: "lease conflict (409)",
    };
  }
  if (!response.ok) {
    state.lease = {
      ...lease,
      acquired: false,
      leaseId: undefined,
      lastError:
        normalizeString(response.body?.detail) ||
        response.error ||
        `lease acquire failed (${String(response.status || "unknown")})`,
    };
    writeManagedLocalRuntimeState(state);
    appendLocalRuntimeLog({
      level: "warn",
      operation: "lease-acquire",
      stage: "local-lease-acquire-failed",
      message: "local runtime lease acquire failed",
      details: {
        status: response.status,
        error: state.lease.lastError,
      },
    });
    return {
      ok: false,
      state: readManagedLocalRuntimeState(),
      reason: normalizeString(state.lease.lastError) || "lease acquire failed",
    };
  }
  const leaseId = normalizeString(response.body?.lease_id);
  if (!leaseId) {
    state.lease = {
      ...lease,
      acquired: false,
      leaseId: undefined,
      lastError: "lease acquire succeeded but lease_id is missing",
    };
    writeManagedLocalRuntimeState(state);
    appendLocalRuntimeLog({
      level: "warn",
      operation: "lease-acquire",
      stage: "local-lease-acquire-invalid-payload",
      message: "local runtime lease acquire response missing lease_id",
    });
    return {
      ok: false,
      state: readManagedLocalRuntimeState(),
      reason: "lease_id missing",
    };
  }
  const heartbeatIntervalSeconds = normalizeHeartbeatIntervalSeconds(
    response.body?.heartbeat_interval_seconds,
  );
  state.lease = {
    ...lease,
    acquired: true,
    stoppedByConflict: false,
    leaseId,
    heartbeatIntervalSeconds,
    lastAcquireAt: nowIso(),
    lastError: undefined,
  };
  writeManagedLocalRuntimeState(state);
  ensureHeartbeatLoop(heartbeatIntervalSeconds);
  appendLocalRuntimeLog({
    level: "info",
    operation: "lease-acquire",
    stage: "local-lease-acquired",
    message: "local runtime lease acquired",
    details: {
      leaseId,
      heartbeatIntervalSeconds,
    },
  });
  return {
    ok: true,
    state: readManagedLocalRuntimeState(),
    reason: "",
  };
}

async function heartbeatLease() {
  if (heartbeatRunning) {
    return;
  }
  heartbeatRunning = true;
  try {
    const state = readManagedLocalRuntimeState();
    const lease = state.lease || {};
    if (lease.stoppedByConflict) {
      return;
    }
    if (!lease.acquired) {
      await acquireLeaseIfNeeded();
      return;
    }
    const leaseId = normalizeString(lease.leaseId);
    if (!leaseId) {
      state.lease = {
        ...lease,
        acquired: false,
        lastError: "lease heartbeat skipped because lease_id is missing",
      };
      writeManagedLocalRuntimeState(state);
      void reconcileAfterHeartbeatFail("lease_id missing during heartbeat");
      await acquireLeaseIfNeeded();
      return;
    }
    const response = await postLease("/v1/local-runtime/lease/heartbeat", {
      lease_id: leaseId,
    });
    if (response.status === 404) {
      state.lease = {
        ...lease,
        acquired: false,
        leaseId: undefined,
        lastError: "lease heartbeat lost (404), reacquire",
      };
      writeManagedLocalRuntimeState(state);
      void reconcileAfterHeartbeatFail("heartbeat 404");
      await acquireLeaseIfNeeded();
      return;
    }
    if (response.status === 409) {
      state.lease = {
        ...lease,
        acquired: false,
        stoppedByConflict: true,
        leaseId: undefined,
        lastError: "lease conflict (409)",
      };
      writeManagedLocalRuntimeState(state);
      appendLocalRuntimeLog({
        level: "warn",
        operation: "lease-heartbeat",
        stage: "local-lease-conflict",
        message: "local runtime lease heartbeat conflict",
      });
      void reconcileAfterHeartbeatFail("heartbeat 409 conflict");
      return;
    }
    if (!response.ok) {
      state.lease = {
        ...lease,
        acquired: false,
        leaseId: undefined,
        lastError:
          normalizeString(response.body?.detail) ||
          response.error ||
          `lease heartbeat failed (${String(response.status || "unknown")})`,
      };
      writeManagedLocalRuntimeState(state);
      appendLocalRuntimeLog({
        level: "warn",
        operation: "lease-heartbeat",
        stage: "local-lease-heartbeat-failed",
        message: "local runtime lease heartbeat failed",
        details: {
          status: response.status,
          error: state.lease.lastError,
        },
      });
      void reconcileAfterHeartbeatFail(
        normalizeString(state.lease.lastError) || "heartbeat failed",
      );
      return;
    }
    state.lease = {
      ...lease,
      acquired: true,
      leaseId,
      lastHeartbeatAt: nowIso(),
      lastError: undefined,
    };
    writeManagedLocalRuntimeState(state);
    if (statusReconcileTimer) {
      clearStatusReconcileTimer();
      applyRuntimeStatePatch({
        state: readManagedLocalRuntimeState(),
        runtimeState: "running",
        runtimeError: "",
      });
    }
  } finally {
    heartbeatRunning = false;
  }
}

function ensureHeartbeatLoop(intervalSeconds?: number) {
  const nextIntervalMs =
    normalizeHeartbeatIntervalSeconds(intervalSeconds) * 1000;
  if (heartbeatTimer && heartbeatIntervalMs === nextIntervalMs) {
    return;
  }
  clearHeartbeatTimer();
  heartbeatIntervalMs = nextIntervalMs;
  heartbeatTimer = setInterval(() => {
    void heartbeatLease();
  }, heartbeatIntervalMs);
  setMonitoringState("heartbeat");
  const timerLike = heartbeatTimer as unknown as { unref?: () => void };
  if (typeof timerLike.unref === "function") {
    timerLike.unref();
  }
}

async function runHeartbeatFailStatusProbe() {
  const state = readManagedLocalRuntimeState();
  const ctlPath = normalizeString(state.ctlPath);
  if (!ctlPath) {
    return {
      ok: false,
      status: "error",
      message: "managed local runtime ctl path is missing",
    } as const;
  }
  const endpoint = resolveRuntimeEndpoint(state);
  const bridge = getCtlBridge();
  const result = await bridge.runCtlCommand({
    ctlPath,
    command: "status",
    mode: "local",
    port: endpoint.port,
  });
  const statusValue = normalizeString(result.details?.status).toLowerCase();
  if (result.ok && statusValue === "stopped") {
    return {
      ok: true,
      status: "stopped",
      message: "runtime stopped",
    } as const;
  }
  if (result.ok && statusValue === "running") {
    return {
      ok: true,
      status: "running",
      message: "runtime running",
    } as const;
  }
  return {
    ok: false,
    status: "error",
    message:
      normalizeString(result.message) ||
      `status probe failed (exitCode=${result.exitCode})`,
  } as const;
}

async function runStatusReconcileTick() {
  if (statusReconcileRunning) {
    return;
  }
  statusReconcileRunning = true;
  try {
    const probe = await runHeartbeatFailStatusProbe();
    const latestState = readManagedLocalRuntimeState();
    if (probe.status === "stopped") {
      clearStatusReconcileTimer();
      clearHeartbeatTimer();
      applyRuntimeStatePatch({
        state: latestState,
        runtimeState: "stopped",
        runtimeError: "",
      });
      emitLocalRuntimeToast("runtime-abnormal-stop");
      return;
    }
    if (probe.status === "running") {
      applyRuntimeStatePatch({
        state: latestState,
        runtimeState: "reconciling_after_heartbeat_fail",
        runtimeError: "",
      });
      return;
    }
    clearStatusReconcileTimer();
    applyRuntimeStatePatch({
      state: latestState,
      runtimeState: "degraded",
      runtimeError: normalizeString(probe.message) || "status reconcile failed",
    });
  } finally {
    statusReconcileRunning = false;
  }
}

function ensureStatusReconcileLoop() {
  if (statusReconcileTimer) {
    return;
  }
  const state = readManagedLocalRuntimeState();
  const intervalMs = Math.max(
    1000,
    resolveHeartbeatIntervalMs(state.lease) || DEFAULT_HEARTBEAT_INTERVAL_SECONDS * 1000,
  );
  statusReconcileTimer = setInterval(() => {
    void runStatusReconcileTick();
  }, intervalMs);
  setMonitoringState("reconciling");
  const timerLike = statusReconcileTimer as unknown as { unref?: () => void };
  if (typeof timerLike.unref === "function") {
    timerLike.unref();
  }
  void runStatusReconcileTick();
}

async function reconcileAfterHeartbeatFail(reason: string) {
  appendLocalRuntimeLog({
    level: "warn",
    operation: "heartbeat-fail-reconcile",
    stage: "heartbeat-fail-reconcile",
    message: "heartbeat failed; reconciling runtime state",
    details: {
      reason,
    },
  });
  const firstProbe = await runHeartbeatFailStatusProbe();
  const state = readManagedLocalRuntimeState();
  if (firstProbe.status === "stopped") {
    clearStatusReconcileTimer();
    clearHeartbeatTimer();
    applyRuntimeStatePatch({
      state,
      runtimeState: "stopped",
      runtimeError: "",
    });
    emitLocalRuntimeToast("runtime-abnormal-stop");
    return;
  }
  if (firstProbe.status === "running") {
    applyRuntimeStatePatch({
      state,
      runtimeState: "reconciling_after_heartbeat_fail",
      runtimeError: "",
    });
    ensureStatusReconcileLoop();
    return;
  }
  applyRuntimeStatePatch({
    state,
    runtimeState: "degraded",
    runtimeError: normalizeString(firstProbe.message) || "status probe failed",
  });
  ensureStatusReconcileLoop();
}

async function ensureManagedProfileConfigured(
  state: ManagedLocalRuntimeState,
  baseUrl: string,
) {
  let message = "";
  const loaded = await loadBackendsRegistry();
  if (loaded.fatalError) {
    return {
      ok: false,
      message: loaded.fatalError,
      conflict: false,
    };
  }
  const existing = loaded.backends.find((entry) => entry.id === MANAGED_PROFILE_ID);
  const managedMarker = normalizeString(state.managedBackendId);
  if (existing && managedMarker !== MANAGED_PROFILE_ID) {
    return {
      ok: false,
      message:
        `backend profile '${MANAGED_PROFILE_ID}' already exists and is not managed by local runtime bootstrap`,
      conflict: true,
    };
  }
  const mergedBackends = existing
    ? loaded.backends.map((entry) =>
        entry.id === MANAGED_PROFILE_ID ? buildManagedSkillRunnerBackend(baseUrl) : entry,
      )
    : [...loaded.backends, buildManagedSkillRunnerBackend(baseUrl)];
  setPref(
    BACKENDS_CONFIG_PREF_KEY,
    JSON.stringify(createBackendsPrefsDocument(mergedBackends)),
  );
  return {
    ok: true,
    message,
    conflict: false,
  };
}

async function removeManagedProfileIfPresent() {
  const loaded = await loadBackendsRegistry();
  if (loaded.fatalError) {
    return {
      ok: false,
      message: loaded.fatalError,
    };
  }
  const existing = loaded.backends.find((entry) => entry.id === MANAGED_PROFILE_ID);
  if (!existing) {
    return {
      ok: true,
      message: "",
    };
  }
  const nextBackends = loaded.backends.filter((entry) => entry.id !== MANAGED_PROFILE_ID);
  setPref(
    BACKENDS_CONFIG_PREF_KEY,
    JSON.stringify(createBackendsPrefsDocument(nextBackends)),
  );
  return {
    ok: true,
    message: "",
  };
}

function isStatusRunning(result: SkillRunnerCtlCommandResult) {
  const status = normalizeString(result.details?.status).toLowerCase();
  if (status === "running") {
    return true;
  }
  return false;
}

function resolveLeaseViewState(lease: LeaseState | undefined): LeaseViewState {
  if (lease?.acquired) {
    return "acquired";
  }
  if (lease?.stoppedByConflict) {
    return "conflict";
  }
  if (normalizeString(lease?.lastError)) {
    return "failed";
  }
  return "pending";
}

function applyRuntimeStatePatch(args: {
  state: ManagedLocalRuntimeState;
  runtimeState: RuntimeState;
  runtimeFailureCount?: number;
  runtimeError?: string;
}) {
  const nextState = writeManagedLocalRuntimeState({
    ...args.state,
    runtimeState: args.runtimeState,
    runtimeFailureCount:
      typeof args.runtimeFailureCount === "number"
        ? Math.max(0, Math.floor(args.runtimeFailureCount))
        : args.state.runtimeFailureCount,
    lastRuntimeError: normalizeString(args.runtimeError) || undefined,
    lastRuntimeStatusAt: nowIso(),
  });
  return nextState;
}

async function pollStatusUntilRunning(args: {
  bridge: SkillRunnerCtlBridge;
  ctlPath: string;
  port: number;
  attempts?: number;
  intervalMs?: number;
}) {
  const attempts =
    typeof args.attempts === "number" && Number.isFinite(args.attempts) && args.attempts > 0
      ? Math.floor(args.attempts)
      : RUNTIME_STATUS_POLL_ATTEMPTS;
  const intervalMs =
    typeof args.intervalMs === "number" && Number.isFinite(args.intervalMs) && args.intervalMs > 0
      ? Math.floor(args.intervalMs)
      : RUNTIME_STATUS_POLL_INTERVAL_MS;
  let lastStatus: SkillRunnerCtlCommandResult | undefined;
  const statusTrail: string[] = [];
  for (let index = 0; index < attempts; index++) {
    const status = await args.bridge.runCtlCommand({
      ctlPath: args.ctlPath,
      command: "status",
      mode: "local",
      port: args.port,
    });
    lastStatus = status;
    statusTrail.push(
      normalizeString(status.details?.status || status.message || `exit-${status.exitCode}`),
    );
    if (status.ok && isStatusRunning(status)) {
      return {
        ok: true as const,
        status,
        attempts: index + 1,
        trail: statusTrail,
      };
    }
    if (index < attempts - 1) {
      await sleepMs(intervalMs);
    }
  }
  return {
    ok: false as const,
    status: lastStatus,
    attempts,
    trail: statusTrail,
  };
}

async function tryAcquireLeaseOnRunning() {
  const acquire = await acquireLeaseIfNeeded();
  const nextState = acquire.state || readManagedLocalRuntimeState();
  if (acquire.ok) {
    ensureHeartbeatLoop(nextState.lease?.heartbeatIntervalSeconds);
  }
  return {
    ok: acquire.ok,
    state: nextState,
    reason: acquire.reason,
  };
}

async function runManagedRuntimeAutoEnsureTick(): Promise<AutoEnsureTickResult> {
  if (autoEnsureRunning) {
    return {
      ok: true,
      stage: "auto-ensure-skip-running",
      message: "managed local runtime auto ensure already running",
    };
  }
  autoEnsureRunning = true;
  try {
    const state = readManagedLocalRuntimeState();
    if (!normalizeString(state.managedBackendId) || !normalizeString(state.ctlPath)) {
      return {
        ok: true,
        stage: "auto-ensure-skip-not-configured",
        message: "managed local runtime is not configured",
      };
    }
    if (isAutoStartPaused()) {
      return {
        ok: true,
        stage: "auto-ensure-skip-paused",
        message: "managed local runtime auto start is paused",
      };
    }
    const backendId = normalizeString(state.managedBackendId);
    const ensureResult = await ensureManagedLocalRuntimeForBackend(backendId, {
      backgroundInFlightAction: "auto-ensure-starting",
    });
    return {
      ok: ensureResult.ok,
      stage: ensureResult.stage,
      message: ensureResult.message,
    };
  } finally {
    autoEnsureRunning = false;
  }
}

export async function runManagedRuntimeAutoEnsureTickForTests() {
  return runManagedRuntimeAutoEnsureTick();
}

export async function runManagedRuntimeStartupPreflightProbe(): Promise<SkillRunnerLocalRuntimeActionResult> {
  return withRuntimeControlLock(async () => {
    setAutoStartEnabledInSession(false);
    const state = readManagedLocalRuntimeState();
    if (!hasRuntimeInfo(state)) {
      return {
        ok: true,
        stage: "startup-preflight-skip-no-runtime-info",
        message: "startup preflight skipped because runtime info is missing",
      };
    }
    const ctlPath = normalizeString(state.ctlPath);
    if (!ctlPath) {
      return {
        ok: false,
        stage: "startup-preflight-missing-ctl",
        message: "startup preflight skipped because ctl path is missing",
      };
    }
    const endpoint = resolveRuntimeEndpoint(state);
    const bridge = getCtlBridge();
    const preflight = await bridge.runCtlCommand({
      ctlPath,
      command: "preflight",
      host: endpoint.host,
      port: endpoint.requestedPort,
      portFallbackSpan: endpoint.portFallbackSpan,
    });
    if (preflight.ok) {
      setAutoStartEnabledInSession(true);
      return {
        ok: true,
        stage: "startup-preflight-ok",
        message: "startup preflight succeeded",
        details: preflight.details,
      };
    }
    setAutoStartEnabledInSession(false);
    return {
      ok: false,
      stage: "startup-preflight-failed",
      message: normalizeString(preflight.message) || "startup preflight failed",
      details: preflight.details,
    };
  });
}

export function startManagedLocalRuntimeAutoEnsureLoop() {
  if (autoEnsureTimer) {
    return;
  }
  autoEnsureTimer = setInterval(() => {
    void runManagedRuntimeAutoEnsureTick();
  }, AUTO_ENSURE_INTERVAL_MS);
  const timerLike = autoEnsureTimer as unknown as { unref?: () => void };
  if (typeof timerLike.unref === "function") {
    timerLike.unref();
  }
  void runManagedRuntimeAutoEnsureTick();
}

export function stopManagedLocalRuntimeAutoEnsureLoop() {
  clearAutoEnsureTimer();
}

export async function deployAndConfigureLocalSkillRunner(args?: {
  version?: string;
}): Promise<SkillRunnerLocalRuntimeActionResult> {
  return withRuntimeActionMutex("oneclick-deploy-start", async () => {
    const bridge = getCtlBridge();
    const version = normalizeString(args?.version) || getConfiguredVersionTag();
    resetSkillRunnerLocalDeployDebugSession({
      version,
      trigger: "deploy",
    });
    const installRoot = resolveDefaultInstallRoot();
    setConfiguredVersionTag(version);
    const stateBeforeOneClick = readManagedLocalRuntimeState();
    if (hasRuntimeInfo(stateBeforeOneClick)) {
      const ctlPath = normalizeString(stateBeforeOneClick.ctlPath);
      const endpoint = resolveRuntimeEndpoint(stateBeforeOneClick);
      const preflight = await bridge.runCtlCommand({
        ctlPath,
        command: "preflight",
        host: endpoint.host,
        port: endpoint.requestedPort,
        portFallbackSpan: endpoint.portFallbackSpan,
      });
      if (preflight.ok) {
        setAutoStartEnabledInSession(true);
        const upResult = await bridge.runCtlCommand({
          ctlPath,
          command: "up",
          mode: "local",
          host: endpoint.host,
          port: endpoint.requestedPort,
          portFallbackSpan: endpoint.portFallbackSpan,
        });
        if (!upResult.ok) {
          return resultFromCtl("oneclick-up", upResult);
        }
        let nextState = applyRuntimeEndpointFromDetails(
          readManagedLocalRuntimeState(),
          upResult.details,
        );
        const endpointAfterUp = resolveRuntimeEndpoint(nextState);
        const statusPoll = await pollStatusUntilRunning({
          bridge,
          ctlPath,
          port: endpointAfterUp.port,
        });
        if (!statusPoll.ok) {
          nextState = applyRuntimeStatePatch({
            state: nextState,
            runtimeState: "degraded",
            runtimeFailureCount: (nextState.runtimeFailureCount || 0) + 1,
            runtimeError: normalizeString(
              statusPoll.status?.details?.status ||
                statusPoll.status?.message ||
                "runtime not running after up",
            ),
          });
          return {
            ok: false,
            stage: "oneclick-status",
            message: `runtime status is not running: ${normalizeString(
              statusPoll.status?.details?.status ||
                statusPoll.status?.message ||
                "unknown",
            )}`,
            details: {
              statusTrail: statusPoll.trail,
              statusAttempts: statusPoll.attempts,
              preflight: preflight.details,
            },
          };
        }
        nextState = applyRuntimeStatePatch({
          state: nextState,
          runtimeState: "running",
          runtimeFailureCount: 0,
          runtimeError: "",
        });
        const profileSyncResult = await ensureManagedProfileConfigured(
          nextState,
          resolveManagedBaseUrl(nextState),
        );
        if (!profileSyncResult.ok) {
          return {
            ok: false,
            stage: "oneclick-configure-profile",
            message: profileSyncResult.message,
            conflict: profileSyncResult.conflict,
          };
        }
        const leaseAcquire = await tryAcquireLeaseOnRunning();
        nextState = leaseAcquire.state;
        if (!leaseAcquire.ok) {
          return {
            ok: false,
            stage: "oneclick-lease",
            message: normalizeString(leaseAcquire.reason) || "lease acquire failed",
            details: {
              preflight: preflight.details,
            },
          };
        }
        const finalEndpoint = resolveRuntimeEndpoint(nextState);
        triggerManagedLocalRuntimePostUpTaskReconcile(nextState);
        emitLocalRuntimeToast("runtime-up");
        return {
          ok: true,
          stage: "oneclick-start-complete",
          message: "one-click start succeeded with existing runtime info",
          details: {
            runtimeState: nextState.runtimeState,
            leaseState: resolveLeaseViewState(nextState.lease),
            baseUrl: resolveManagedBaseUrl(nextState),
            actualHost: finalEndpoint.host,
            actualPort: finalEndpoint.port,
            actualUrl: finalEndpoint.url,
            preflight: preflight.details,
          },
        };
      }
      setAutoStartEnabledInSession(false);
      appendLocalRuntimeLog({
        level: "warn",
        operation: "oneclick-preflight",
        stage: "oneclick-preflight-failed-fallback-deploy",
        message: "one-click preflight failed, fallback to deploy",
        details: {
          message: preflight.message,
          details: preflight.details,
        },
      });
    } else {
      setAutoStartEnabledInSession(false);
    }
    const releaseProbe = await probeReleaseAssets(version);
  appendLocalRuntimeLog({
    level:
      !releaseProbe.checked || releaseProbe.ok ? "info" : "warn",
    operation: "deploy-release-assets-probe",
    stage: "deploy-release-assets-probe",
    message:
      !releaseProbe.checked
        ? "release asset probe skipped"
        : releaseProbe.ok
          ? "release asset probe passed"
          : "release asset probe failed",
    details: {
      version,
      checked: releaseProbe.checked,
      results: releaseProbe.results,
    },
  });
  if (releaseProbe.checked && !releaseProbe.ok) {
    return {
      ok: false,
      stage: "deploy-release-assets",
      message: "release assets are not reachable from GitHub",
      details: {
        version,
        results: releaseProbe.results,
      },
    };
  }
    const install = await releaseInstaller({
      version,
      installRoot,
      repo: DEFAULT_SKILL_RUNNER_RELEASE_REPO,
      runCommand: (commandArgs) => bridge.runSystemCommand(commandArgs),
      keepTempOnSuccess: false,
      keepTempOnFailure: true,
    });
    appendLocalRuntimeLog({
      level: install.ok ? "info" : "warn",
      operation: "deploy-release-install",
      stage: "deploy-release-install",
      message: install.ok
        ? "plugin-native release install succeeded"
        : "plugin-native release install failed",
      details: {
        version,
        installRoot,
        repo: DEFAULT_SKILL_RUNNER_RELEASE_REPO,
        installStage: install.stage,
        installMessage: install.message,
        installDir: install.installDir,
        tempDir: install.tempDir,
        artifactFile: install.artifactFile,
        checksumFile: install.checksumFile,
        artifactBytes: install.artifactBytes,
        expectedSha256: install.expectedSha256,
        actualSha256: install.actualSha256,
        extractCommand: install.extractCommand,
        installDetails: install.details,
      },
    });
    if (!install.ok) {
      return {
        ok: false,
        stage: install.stage,
        message: install.message,
        details: install.details,
      };
    }
    const normalizedInstallDir = normalizeString(install.installDir);
    if (!normalizedInstallDir) {
      return {
        ok: false,
        stage: "deploy-release-install",
        message: "release installer returned empty installDir",
        details: install.details,
      };
    }
    const ctlPath =
      bridge.resolveCtlPathFromInstallDir(normalizedInstallDir) ||
      normalizeString("");
    if (!ctlPath) {
      return {
        ok: false,
        stage: "deploy-install",
        message: "ctl path was not resolved from installer installDir",
        details: {
          installDir: normalizedInstallDir,
          installRoot,
        },
      };
    }
    const ctlBootstrap = await bridge.runCtlCommand({
      ctlPath,
      command: "bootstrap",
    });
    if (!ctlBootstrap.ok) {
      const stateBeforeFail = readManagedLocalRuntimeState();
      const endpoint = resolveRuntimeEndpoint(stateBeforeFail);
      writeManagedLocalRuntimeState({
        ...stateBeforeFail,
        versionTag: version,
        installDir: normalizedInstallDir,
        ctlPath,
        baseUrl: buildBaseUrl(endpoint.host, endpoint.port),
        runtimeHost: endpoint.host,
        runtimePort: endpoint.port,
        runtimeUrl: endpoint.url,
        requestedPort: endpoint.requestedPort,
        portFallbackSpan: endpoint.portFallbackSpan,
        runtimeState: "unknown",
        lastDeployError: normalizeString(ctlBootstrap.message) || "bootstrap failed",
      });
      return resultFromCtl("deploy-ctl-bootstrap", ctlBootstrap);
    }
    const bootstrapReport = await readBootstrapReport({
      installDir: normalizedInstallDir,
      reportFilePath: normalizeString(
        ctlBootstrap.details?.bootstrap_report_file,
      ) || undefined,
    });
    if (!bootstrapReport.ok) {
      appendLocalRuntimeLog({
        level: "warn",
        operation: "deploy-bootstrap-report",
        stage: "deploy-bootstrap-report",
        message: "bootstrap report validation failed",
        details: {
          ...bootstrapReport.details,
          reason: bootstrapReport.message,
        },
      });
      return {
        ok: false,
        stage: bootstrapReport.stage,
        message: bootstrapReport.message,
        details: bootstrapReport.details,
      };
    }
    appendLocalRuntimeLog({
      level:
        bootstrapReport.summary.bootstrapOutcome === "partial_failure"
          ? "warn"
          : "info",
      operation: "deploy-bootstrap-report",
      stage: "deploy-bootstrap-report",
      message:
        bootstrapReport.summary.bootstrapOutcome === "partial_failure"
          ? "bootstrap report loaded with partial failure"
          : "bootstrap report loaded",
      details: bootstrapReport.summary,
    });
    const bootstrapWarning = normalizeString(
      bootstrapReport.summary.bootstrapWarning,
    );
    if (bootstrapWarning) {
      appendLocalRuntimeLog({
        level: "warn",
        operation: "deploy-bootstrap-report",
        stage: "deploy-bootstrap-report-warning",
        message: bootstrapWarning,
        details: bootstrapReport.summary,
      });
    }

    const previousState = readManagedLocalRuntimeState();
    const previousEndpoint = resolveRuntimeEndpoint(previousState);
    const stagedState = writeManagedLocalRuntimeState({
      ...previousState,
      versionTag: version,
      installDir: normalizedInstallDir,
      ctlPath,
      baseUrl: buildBaseUrl(previousEndpoint.host, previousEndpoint.port),
      runtimeHost: previousEndpoint.host,
      runtimePort: previousEndpoint.port,
      runtimeUrl: previousEndpoint.url,
      requestedPort: previousEndpoint.requestedPort,
      portFallbackSpan: previousEndpoint.portFallbackSpan,
      portFallbackUsed: false,
      triedPorts: [],
      runtimeState: "stopped",
      runtimeFailureCount: 0,
      deployedAt: nowIso(),
      lastDeployError: undefined,
      lease: {
        acquired: false,
        stoppedByConflict: false,
        leaseId: undefined,
        heartbeatIntervalSeconds: DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
        lastError: undefined,
      },
    });

    const finalBaseUrl = resolveManagedBaseUrl(stagedState);
    const profileResult = await ensureManagedProfileConfigured(
      previousState,
      finalBaseUrl,
    );
    if (!profileResult.ok) {
      writeManagedLocalRuntimeState({
        ...stagedState,
        lastDeployError: profileResult.message,
      });
      return {
        ok: false,
        stage: "deploy-configure-profile",
        message: profileResult.message,
        conflict: profileResult.conflict,
      };
    }
    const nextState = writeManagedLocalRuntimeState({
      ...stagedState,
      managedBackendId: MANAGED_PROFILE_ID,
    });
    const postDeployEndpoint = resolveRuntimeEndpoint(nextState);
    const postDeployPreflight = await bridge.runCtlCommand({
      ctlPath,
      command: "preflight",
      host: postDeployEndpoint.host,
      port: postDeployEndpoint.requestedPort,
      portFallbackSpan: postDeployEndpoint.portFallbackSpan,
    });
    if (!postDeployPreflight.ok) {
      setAutoStartEnabledInSession(false);
      const failedMessage =
        normalizeString(postDeployPreflight.message) ||
        "post-deploy preflight failed";
      const failedState = writeManagedLocalRuntimeState({
        ...nextState,
        lastDeployError: failedMessage,
      });
      appendLocalRuntimeLog({
        level: "warn",
        operation: "deploy-post-preflight",
        stage: "deploy-post-preflight-failed",
        message: "post-deploy preflight failed",
        details: {
          version,
          installDir: normalizedInstallDir,
          message: failedMessage,
          details: postDeployPreflight.details,
        },
      });
      return {
        ok: false,
        stage: "post-deploy-preflight",
        message: failedMessage,
        details: {
          version,
          backendId: MANAGED_PROFILE_ID,
          baseUrl: finalBaseUrl,
          runtimeState: failedState.runtimeState,
          leaseState: resolveLeaseViewState(failedState.lease),
          actualHost: postDeployEndpoint.host,
          actualPort: postDeployEndpoint.port,
          actualUrl: postDeployEndpoint.url,
          requestedPort:
            failedState.requestedPort || postDeployEndpoint.requestedPort,
          portFallbackSpan:
            failedState.portFallbackSpan ??
            postDeployEndpoint.portFallbackSpan,
          portFallbackUsed: failedState.portFallbackUsed === true,
          triedPorts: failedState.triedPorts || [],
          warnings: bootstrapWarning ? [bootstrapWarning] : [],
          postDeployPreflight: postDeployPreflight.details,
          postDeployPreflightMessage: failedMessage,
          autoEnsureTriggered: false,
          downloadProof: isObjectRecord(install.details)
            ? install.details.downloadProof
            : undefined,
          checksumProof: isObjectRecord(install.details)
            ? install.details.checksumProof
            : undefined,
          extractProof: isObjectRecord(install.details)
            ? install.details.extractProof
            : undefined,
          tempDir: install.tempDir,
          ...bootstrapReport.summary,
        },
      };
    }
    const postPreflightState = applyRuntimeEndpointFromDetails(
      nextState,
      postDeployPreflight.details,
    );
    const finalBaseUrlAfterPreflight = resolveManagedBaseUrl(postPreflightState);
    setAutoStartEnabledInSession(true);
    const autoEnsureTriggered = triggerManagedRuntimeAutoEnsureTickAsync();

    appendLocalRuntimeLog({
      level: "info",
      operation: "deploy-configure",
      stage: "local-runtime-deploy-succeeded",
      message: "skillrunner local runtime deployed and configured",
      details: {
        version,
        managedBackendId: postPreflightState.managedBackendId,
        baseUrl: finalBaseUrlAfterPreflight,
        postDeployPreflight: postDeployPreflight.details,
      },
    });
    const finalEndpoint = resolveRuntimeEndpoint(postPreflightState);
    return {
      ok: true,
      stage: "deploy-complete",
      message: bootstrapWarning
        ? `SkillRunner local runtime deployed and configured with bootstrap warning: ${bootstrapWarning}`
        : "SkillRunner local runtime deployed and configured.",
      details: {
        version,
        backendId: MANAGED_PROFILE_ID,
        baseUrl: finalBaseUrlAfterPreflight,
        runtimeState: postPreflightState.runtimeState,
        leaseState: resolveLeaseViewState(postPreflightState.lease),
        actualHost: finalEndpoint.host,
        actualPort: finalEndpoint.port,
        actualUrl: finalEndpoint.url,
        requestedPort:
          postPreflightState.requestedPort || finalEndpoint.requestedPort,
        portFallbackSpan:
          postPreflightState.portFallbackSpan ??
          finalEndpoint.portFallbackSpan,
        portFallbackUsed: postPreflightState.portFallbackUsed === true,
        triedPorts: postPreflightState.triedPorts || [],
        warnings: bootstrapWarning ? [bootstrapWarning] : [],
        postDeployPreflight: postDeployPreflight.details,
        autoEnsureTriggered,
        downloadProof: isObjectRecord(install.details)
          ? install.details.downloadProof
          : undefined,
        checksumProof: isObjectRecord(install.details)
          ? install.details.checksumProof
          : undefined,
        extractProof: isObjectRecord(install.details)
          ? install.details.extractProof
          : undefined,
        tempDir: install.tempDir,
        ...bootstrapReport.summary,
      },
    };
  });
}

function quoteShellArg(value: string) {
  if (detectWindows()) {
    return `"${String(value || "").replace(/"/g, '\\"')}"`;
  }
  return `'${String(value || "").replace(/'/g, `'\\''`)}'`;
}

export function buildManualDeployCommands(args?: {
  version?: string;
  installRoot?: string;
  host?: string;
  port?: number;
  portFallbackSpan?: number;
}) {
  const version = normalizeString(args?.version) || getConfiguredVersionTag();
  const installRoot = normalizeString(args?.installRoot) || resolveDefaultInstallRoot();
  const host = normalizeString(args?.host) || DEFAULT_MANAGED_LOCAL_HOST;
  const port =
    typeof args?.port === "number" && Number.isFinite(args.port)
      ? Math.floor(args.port)
      : DEFAULT_MANAGED_LOCAL_PORT;
  const portFallbackSpan = normalizePortFallbackSpan(args?.portFallbackSpan);
  const artifactName = `skill-runner-${version}.tar.gz`;
  const checksumName = `${artifactName}.sha256`;
  const baseUrl = `https://github.com/${DEFAULT_SKILL_RUNNER_RELEASE_REPO}/releases/download/${version}`;
  if (detectWindows()) {
    const releaseDir = joinPath(installRoot, version);
    const ctl = joinPath(releaseDir, "scripts", "skill-runnerctl.ps1");
    const uninstall = joinPath(releaseDir, "scripts", "skill-runner-uninstall.ps1");
    const artifactPath = joinPath("$tempDir", artifactName);
    const checksumPath = joinPath("$tempDir", checksumName);
    return [
      `$version = ${quoteShellArg(version)}`,
      `$installRoot = ${quoteShellArg(installRoot)}`,
      `$artifact = ${quoteShellArg(artifactName)}`,
      `$checksum = ${quoteShellArg(checksumName)}`,
      `$baseUrl = ${quoteShellArg(baseUrl)}`,
      `$artifactUrl = "$baseUrl/$artifact"`,
      `$checksumUrl = "$baseUrl/$checksum"`,
      `$tempDir = Join-Path $env:TEMP ("skill-runner-install-" + [guid]::NewGuid().ToString("N"))`,
      `New-Item -ItemType Directory -Path $tempDir -Force | Out-Null`,
      `$artifactPath = ${quoteShellArg(artifactPath)}`,
      `$checksumPath = ${quoteShellArg(checksumPath)}`,
      `Invoke-WebRequest -Uri $artifactUrl -OutFile $artifactPath`,
      `Invoke-WebRequest -Uri $checksumUrl -OutFile $checksumPath`,
      `$expected = (Get-Content $checksumPath -Raw).Split()[0].Trim().ToLowerInvariant()`,
      `$actual = (Get-FileHash -Path $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()`,
      `if ($expected -ne $actual) { throw "SHA256 mismatch" }`,
      `$releaseDir = ${quoteShellArg(releaseDir)}`,
      `New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null`,
      `tar -xzf $artifactPath -C $releaseDir`,
      `$ctl = ${quoteShellArg(ctl)}`,
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${quoteShellArg(ctl)} bootstrap --json`,
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${quoteShellArg(ctl)} preflight --host ${host} --port ${port} --port-fallback-span ${portFallbackSpan} --json`,
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${quoteShellArg(ctl)} up --mode local --host ${host} --port ${port} --port-fallback-span ${portFallbackSpan} --json`,
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${quoteShellArg(ctl)} status --mode local --port ${port} --json`,
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${quoteShellArg(ctl)} doctor --json`,
      `$uninstall = ${quoteShellArg(uninstall)}`,
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${quoteShellArg(uninstall)} -Json`,
    ].join("\n");
  }
  const releaseDir = joinPath(installRoot, version);
  const ctl = joinPath(releaseDir, "scripts", "skill-runnerctl");
  const uninstall = joinPath(releaseDir, "scripts", "skill-runner-uninstall.sh");
  const artifactPath = joinPath("${TMP_DIR}", artifactName);
  const checksumPath = joinPath("${TMP_DIR}", checksumName);
  return [
    `VERSION=${quoteShellArg(version)}`,
    `INSTALL_ROOT=${quoteShellArg(installRoot)}`,
    `REPO=${quoteShellArg(DEFAULT_SKILL_RUNNER_RELEASE_REPO)}`,
    `ARTIFACT=${quoteShellArg(artifactName)}`,
    `CHECKSUM=${quoteShellArg(checksumName)}`,
    `BASE_URL=${quoteShellArg(baseUrl)}`,
    `TMP_DIR="$(mktemp -d)"`,
    `curl -fL "$BASE_URL/$ARTIFACT" -o ${quoteShellArg(artifactPath)}`,
    `curl -fL "$BASE_URL/$CHECKSUM" -o ${quoteShellArg(checksumPath)}`,
    `if command -v sha256sum >/dev/null 2>&1; then (cd "$TMP_DIR" && sha256sum -c "$CHECKSUM"); else EXPECTED="$(awk '{print $1}' ${quoteShellArg(checksumPath)})"; ACTUAL="$(shasum -a 256 ${quoteShellArg(artifactPath)} | awk '{print $1}')"; [ "$EXPECTED" = "$ACTUAL" ] || { echo "SHA256 mismatch"; exit 1; }; fi`,
    `mkdir -p ${quoteShellArg(releaseDir)}`,
    `tar -xzf ${quoteShellArg(artifactPath)} -C ${quoteShellArg(releaseDir)}`,
    `sh ${quoteShellArg(ctl)} bootstrap --json`,
    `sh ${quoteShellArg(ctl)} preflight --host ${host} --port ${port} --port-fallback-span ${portFallbackSpan} --json`,
    `sh ${quoteShellArg(ctl)} up --mode local --host ${host} --port ${port} --port-fallback-span ${portFallbackSpan} --json`,
    `sh ${quoteShellArg(ctl)} status --mode local --port ${port} --json`,
    `sh ${quoteShellArg(ctl)} doctor --json`,
    `sh ${quoteShellArg(uninstall)} --json`,
  ].join("\n");
}

export async function getLocalRuntimeManualDeployCommands(args?: {
  version?: string;
}): Promise<SkillRunnerLocalRuntimeActionResult> {
  const version = normalizeString(args?.version) || getConfiguredVersionTag();
  setConfiguredVersionTag(version);
  const installRoot = resolveDefaultInstallRoot();
  const commands = buildManualDeployCommands({
    version,
    installRoot,
    host: DEFAULT_MANAGED_LOCAL_HOST,
    port: DEFAULT_MANAGED_LOCAL_PORT,
    portFallbackSpan: DEFAULT_MANAGED_LOCAL_PORT_FALLBACK_SPAN,
  });
  return {
    ok: true,
    stage: "manual-deploy-commands",
    message: "[manual-deploy-commands] generated manual deploy commands",
    details: {
      version,
      installRoot,
      commands,
    },
  };
}

export function getManagedLocalRuntimeStateSnapshot(): SkillRunnerLocalRuntimeActionResult {
  const state = readManagedLocalRuntimeState();
  const runtimeInfoReady = hasRuntimeInfo(state);
  const inFlightAction = getEffectiveInFlightAction();
  return {
    ok: true,
    stage: "state",
    message: "managed local runtime state snapshot",
    details: {
      baseUrl: resolveManagedBaseUrl(state),
      runtimeHost: state.runtimeHost || "",
      runtimePort: state.runtimePort || 0,
      runtimeUrl: state.runtimeUrl || "",
      requestedPort: state.requestedPort || 0,
      portFallbackSpan: state.portFallbackSpan ?? DEFAULT_MANAGED_LOCAL_PORT_FALLBACK_SPAN,
      portFallbackUsed: state.portFallbackUsed === true,
      triedPorts: state.triedPorts || [],
      managedBackendId: normalizeString(state.managedBackendId) || "",
      runtimeState: state.runtimeState || "unknown",
      runtimeFailureCount: state.runtimeFailureCount || 0,
      leaseState: resolveLeaseViewState(state.lease),
      autoStartPaused: isAutoStartPaused(),
      hasRuntimeInfo: runtimeInfoReady,
      inFlightAction,
      monitoringState,
      deployedAt: state.deployedAt || "",
      lastRuntimeStatusAt: state.lastRuntimeStatusAt || "",
      lastDeployError: state.lastDeployError || "",
      lastRuntimeError: state.lastRuntimeError || "",
    },
  };
}

export async function setLocalRuntimeAutoPullEnabled(
  enabled: boolean,
): Promise<SkillRunnerLocalRuntimeActionResult> {
  return withRuntimeControlLock(async () => {
    const state = readManagedLocalRuntimeState();
    setAutoStartEnabledInSession(enabled);
    return {
      ok: true,
      stage: "auto-pull",
      message: enabled
        ? "local runtime auto start enabled"
        : "local runtime auto start disabled",
      details: {
        autoStartPaused: isAutoStartPaused(),
        runtimeState: state.runtimeState || "unknown",
        leaseState: resolveLeaseViewState(state.lease),
      },
    };
  });
}

export async function toggleLocalRuntimeAutoPull(): Promise<SkillRunnerLocalRuntimeActionResult> {
  const enable = isAutoStartPaused();
  return setLocalRuntimeAutoPullEnabled(enable);
}

function getManagedCtlPath() {
  const state = readManagedLocalRuntimeState();
  const ctlPath = normalizeString(state.ctlPath);
  if (!ctlPath) {
    return "";
  }
  return ctlPath;
}

function getParentPath(pathValue: string) {
  const normalized = normalizeString(pathValue).replace(/[\\/]+$/g, "");
  if (!normalized) {
    return "";
  }
  if (normalized === "/" || normalized === "\\") {
    return normalized;
  }
  if (/^[A-Za-z]:$/.test(normalized)) {
    return `${normalized}\\`;
  }
  const lastSlashIndex = Math.max(
    normalized.lastIndexOf("/"),
    normalized.lastIndexOf("\\"),
  );
  if (lastSlashIndex < 0) {
    return "";
  }
  if (lastSlashIndex === 0) {
    return normalized[0];
  }
  if (lastSlashIndex === 2 && /^[A-Za-z]:/.test(normalized)) {
    return `${normalized.slice(0, 2)}\\`;
  }
  return normalized.slice(0, lastSlashIndex);
}

function isAbsoluteFsPath(pathValue: string) {
  const normalized = normalizeString(pathValue);
  if (!normalized) {
    return false;
  }
  if (detectWindows()) {
    return /^[A-Za-z]:[\\/]/.test(normalized) || /^\\\\/.test(normalized);
  }
  return normalized.startsWith("/");
}

function normalizePathForCompare(pathValue: string) {
  const normalized = normalizeString(pathValue).replace(/[\\/]+$/, "");
  if (!normalized) {
    return "";
  }
  if (detectWindows()) {
    return normalized.replace(/\//g, "\\").toLowerCase();
  }
  return normalized;
}

function isFsRootPath(pathValue: string) {
  const normalized = normalizeString(pathValue).replace(/[\\/]+$/, "");
  if (!normalized) {
    return true;
  }
  if (normalized === "/" || normalized === "\\") {
    return true;
  }
  if (detectWindows()) {
    if (/^[A-Za-z]:$/.test(normalized)) {
      return true;
    }
    if (/^\\\\[^\\]+\\[^\\]+$/.test(normalized)) {
      return true;
    }
  }
  return false;
}

function resolveManagedLocalRoot(args?: { state?: ManagedLocalRuntimeState }) {
  const state = args?.state || readManagedLocalRuntimeState();
  const installDir = normalizeString(state.installDir);
  if (!installDir) {
    return {
      ok: false as const,
      reason: "managed installDir is missing",
      details: {
        installDir,
      },
    };
  }
  if (!isAbsoluteFsPath(installDir)) {
    return {
      ok: false as const,
      reason: "managed installDir is not absolute",
      details: {
        installDir,
      },
    };
  }
  const releasesDir = getParentPath(installDir);
  const localRoot = getParentPath(releasesDir);
  const expectedReleasesDir = joinPath(localRoot, "releases");
  if (
    !localRoot ||
    normalizePathForCompare(releasesDir) !==
      normalizePathForCompare(expectedReleasesDir)
  ) {
    return {
      ok: false as const,
      reason: "managed installDir does not belong to expected releases/<version> layout",
      details: {
        installDir,
        releasesDir,
        expectedReleasesDir,
      },
    };
  }
  if (!isAbsoluteFsPath(localRoot) || isFsRootPath(localRoot)) {
    return {
      ok: false as const,
      reason: "resolved localRoot is unsafe",
      details: {
        installDir,
        localRoot,
      },
    };
  }
  return {
    ok: true as const,
    localRoot,
    details: {
      installDir,
      releasesDir,
      localRoot,
    },
  };
}

type ManagedUninstallDeleteTarget = {
  path: string;
  preserve: boolean;
};

function buildManagedUninstallDeleteTargets(args: {
  localRoot: string;
  clearData: boolean;
  clearAgentHome: boolean;
}) {
  const releasesPath = joinPath(args.localRoot, "releases");
  const npmCachePath = joinPath(args.localRoot, "agent-cache", "npm");
  const uvCachePath = joinPath(args.localRoot, "agent-cache", "uv_cache");
  const uvVenvPath = joinPath(args.localRoot, "agent-cache", "uv_venv");
  const dataPath = joinPath(args.localRoot, "data");
  const agentHomePath = joinPath(args.localRoot, "agent-cache", "agent-home");
  const targets: ManagedUninstallDeleteTarget[] = [
    { path: releasesPath, preserve: false },
    { path: npmCachePath, preserve: false },
    { path: uvCachePath, preserve: false },
    { path: uvVenvPath, preserve: false },
    { path: dataPath, preserve: !args.clearData },
    { path: agentHomePath, preserve: !args.clearAgentHome },
  ];
  if (args.clearData && args.clearAgentHome && !isFsRootPath(args.localRoot)) {
    targets.push({
      path: args.localRoot,
      preserve: false,
    });
  }
  return targets;
}

async function deleteManagedLocalRuntimePaths(args: {
  localRoot: string;
  clearData: boolean;
  clearAgentHome: boolean;
}) {
  const targets = buildManagedUninstallDeleteTargets(args);
  const removedPaths: string[] = [];
  const failedPaths: string[] = [];
  const preservedPaths: string[] = [];
  const failedPathErrors: Record<string, string> = {};
  for (const target of targets) {
    if (target.preserve) {
      preservedPaths.push(target.path);
      continue;
    }
    try {
      await removePathRecursive(target.path);
      const afterExists = await pathExists(target.path);
      if (afterExists) {
        failedPaths.push(target.path);
        failedPathErrors[target.path] = "path still exists after deletion attempt";
      } else {
        removedPaths.push(target.path);
      }
    } catch (error) {
      const message = normalizeString(
        error && typeof error === "object" && "message" in error
          ? (error as { message?: unknown }).message
          : error,
      );
      failedPaths.push(target.path);
      failedPathErrors[target.path] = message || "unknown error";
    }
  }
  return {
    removedPaths,
    failedPaths,
    preservedPaths,
    failedPathErrors,
  };
}

export async function getLocalRuntimeStatus(): Promise<SkillRunnerLocalRuntimeActionResult> {
  const ctlPath = getManagedCtlPath();
  if (!ctlPath) {
    return {
      ok: false,
      stage: "status",
      message: "managed local runtime is not configured yet",
    };
  }
  const bridge = getCtlBridge();
  const stateBeforeStatus = readManagedLocalRuntimeState();
  const endpoint = resolveRuntimeEndpoint(stateBeforeStatus);
  const result = await bridge.runCtlCommand({
    ctlPath,
    command: "status",
    mode: "local",
    port: endpoint.port,
  });
  if (result.ok) {
    applyRuntimeEndpointFromDetails(readManagedLocalRuntimeState(), result.details);
  }
  return resultFromCtl("status", result);
}

export async function stopLocalRuntime(): Promise<SkillRunnerLocalRuntimeActionResult> {
  return withRuntimeActionMutex("stop", async () => {
    setAutoStartEnabledInSession(false);
    const ctlPath = getManagedCtlPath();
    if (!ctlPath) {
      return {
        ok: false,
        stage: "stop",
        message: "managed local runtime is not configured yet",
      };
    }
    await releaseManagedLocalRuntimeLeaseOnShutdown();
    const bridge = getCtlBridge();
    const downResult = await bridge.runCtlCommand({
      ctlPath,
      command: "down",
      mode: "local",
    });
    if (!downResult.ok) {
      return resultFromCtl("stop-down", downResult);
    }
    const stateAfterDown = readManagedLocalRuntimeState();
    const endpoint = resolveRuntimeEndpoint(stateAfterDown);
    const statusResult = await bridge.runCtlCommand({
      ctlPath,
      command: "status",
      mode: "local",
      port: endpoint.port,
    });
    const statusValue = normalizeString(statusResult.details?.status).toLowerCase();
    if (statusResult.ok && statusValue === "stopped") {
      clearHeartbeatTimer();
      clearStatusReconcileTimer();
      applyRuntimeStatePatch({
        state: readManagedLocalRuntimeState(),
        runtimeState: "stopped",
        runtimeError: "",
      });
      emitLocalRuntimeToast("runtime-down");
      return {
        ok: true,
        stage: "stop-complete",
        message: "local runtime stopped",
        details: {
          down: downResult.details,
          status: statusResult.details,
        },
      };
    }
    if (statusResult.ok && statusValue === "running") {
      applyRuntimeStatePatch({
        state: readManagedLocalRuntimeState(),
        runtimeState: "running",
        runtimeError: "status probe reports running after down",
      });
      return {
        ok: false,
        stage: "stop-status-running",
        message: "runtime still running after stop chain",
        details: {
          down: downResult.details,
          status: statusResult.details,
        },
      };
    }
    applyRuntimeStatePatch({
      state: readManagedLocalRuntimeState(),
      runtimeState: "degraded",
      runtimeError: normalizeString(statusResult.message) || "status probe failed after down",
    });
    return {
      ok: false,
      stage: "stop-status",
      message: normalizeString(statusResult.message) || "status probe failed after down",
      details: {
        down: downResult.details,
        status: statusResult.details,
      },
    };
  });
}

export async function uninstallLocalRuntime(args?: {
  clearData?: boolean;
  clearAgentHome?: boolean;
}): Promise<SkillRunnerLocalRuntimeActionResult> {
  return withRuntimeActionMutex("uninstall", async () => {
    const stateBeforeUninstall = readManagedLocalRuntimeState();
    const ctlPath = normalizeString(stateBeforeUninstall.ctlPath);
    const clearData = args?.clearData === true;
    const clearAgentHome = args?.clearAgentHome === true;
    setAutoStartEnabledInSession(false);
    clearManagedLocalRuntimeState();
    const localRootResolution = resolveManagedLocalRoot({
      state: stateBeforeUninstall,
    });
    if (!localRootResolution.ok) {
      return {
        ok: false,
        stage: "uninstall-local-root",
        message: localRootResolution.reason,
        details: localRootResolution.details,
      };
    }
    const localRoot = localRootResolution.localRoot;
    clearStatusReconcileTimer();
    clearHeartbeatTimer();
    const bridge = getCtlBridge();
    const downResultDetails: Record<string, unknown> = {
      invoked: false,
      ok: true,
      exitCode: 0,
      message: "ctl path unavailable; skip down and continue uninstall cleanup",
      command: "",
      args: [],
      details: {},
    };
    let downInvokedAndSucceeded = false;
    const canInvokeDown = !!ctlPath && (await pathExists(ctlPath));
    if (canInvokeDown) {
      const downResult = await bridge.runCtlCommand({
        ctlPath,
        command: "down",
        mode: "local",
      });
      downResultDetails.invoked = true;
      downResultDetails.ok = downResult.ok;
      downResultDetails.exitCode = downResult.exitCode;
      downResultDetails.message = downResult.message;
      downResultDetails.command = downResult.command;
      downResultDetails.args = downResult.args;
      downResultDetails.details = downResult.details || {};
      if (!downResult.ok) {
        return {
          ok: false,
          stage: "uninstall-down",
          message: normalizeString(downResult.message) || "managed local runtime stop failed",
          details: {
            localRoot,
            down_result: downResultDetails,
          },
        };
      }
      downInvokedAndSucceeded = true;
    }
    const deleteResult = await deleteManagedLocalRuntimePaths({
      localRoot,
      clearData,
      clearAgentHome,
    });
    if (deleteResult.failedPaths.length > 0) {
      return {
        ok: false,
        stage: "uninstall-delete",
        message: "failed to delete one or more managed runtime paths",
        details: {
          localRoot,
          clearData,
          clearAgentHome,
          down_result: downResultDetails,
          removed_paths: deleteResult.removedPaths,
          failed_paths: deleteResult.failedPaths,
          preserved_paths: deleteResult.preservedPaths,
          failed_path_errors: deleteResult.failedPathErrors,
        },
      };
    }
    const removeProfileResult = await removeManagedProfileIfPresent();
    if (!removeProfileResult.ok) {
      return {
        ok: false,
        stage: "uninstall-configure-profile",
        message: removeProfileResult.message || "failed to remove managed profile after uninstall",
        details: {
          localRoot,
          clearData,
          clearAgentHome,
          down_result: downResultDetails,
          removed_paths: deleteResult.removedPaths,
          failed_paths: deleteResult.failedPaths,
          preserved_paths: deleteResult.preservedPaths,
          failed_path_errors: deleteResult.failedPathErrors,
        },
      };
    }
    if (downInvokedAndSucceeded) {
      emitLocalRuntimeToast("runtime-down");
    }
    return {
      ok: true,
      stage: "uninstall-complete",
      message: "managed local runtime uninstalled and profile removed",
      details: {
        localRoot,
        clearData,
        clearAgentHome,
        down_result: downResultDetails,
        removed_paths: deleteResult.removedPaths,
        failed_paths: deleteResult.failedPaths,
        preserved_paths: deleteResult.preservedPaths,
      },
    };
  });
}

export async function startLocalRuntime(): Promise<SkillRunnerLocalRuntimeActionResult> {
  const state = readManagedLocalRuntimeState();
  const backendId = normalizeString(state.managedBackendId);
  if (!backendId) {
    return {
      ok: false,
      stage: "start-backend",
      message: "managed local runtime backend id is missing",
    };
  }
  writeManagedLocalRuntimeState({
    ...state,
    runtimeState: state.runtimeState === "running" ? "running" : "starting",
  });
  const ensure = await ensureManagedLocalRuntimeForBackend(backendId, {
    ignoreAutoStartPaused: true,
  });
  if (!ensure.ok) {
    return {
      ok: false,
      stage: "start-ensure",
      message: ensure.message,
      details: ensure.details,
    };
  }
  return {
    ok: true,
    stage: "start-complete",
    message: "managed local runtime start requested",
    details: ensure.details,
  };
}

export async function runLocalDoctor(): Promise<SkillRunnerLocalRuntimeActionResult> {
  const ctlPath = getManagedCtlPath();
  if (!ctlPath) {
    return {
      ok: false,
      stage: "doctor",
      message: "managed local runtime is not configured yet",
    };
  }
  const bridge = getCtlBridge();
  const result = await bridge.runCtlCommand({
    ctlPath,
    command: "doctor",
  });
  return resultFromCtl("doctor", result);
}

export async function ensureManagedLocalRuntimeForBackend(
  backendId: string,
  options?: EnsureManagedLocalRuntimeOptions,
): Promise<SkillRunnerLocalRuntimeActionResult> {
  return withRuntimeControlLock(async () => {
    const normalizedBackendId = normalizeString(backendId);
    let state = readManagedLocalRuntimeState();
    if (!normalizedBackendId || state.managedBackendId !== normalizedBackendId) {
      return {
        ok: true,
        stage: "ensure-skipped",
        message: "backend is not managed by local runtime bootstrap",
      };
    }
    if (!options?.ignoreAutoStartPaused && isAutoStartPaused()) {
      return {
        ok: true,
        stage: "ensure-skipped-paused",
        message: "managed local runtime auto start is disabled",
      };
    }
    const ctlPath = normalizeString(state.ctlPath);
    if (!ctlPath) {
      return {
        ok: false,
        stage: "ensure",
        message: "managed local runtime ctl path is missing",
      };
    }
    const bridge = getCtlBridge();
    let endpoint = resolveRuntimeEndpoint(state);
    const status = await bridge.runCtlCommand({
      ctlPath,
      command: "status",
      mode: "local",
      port: endpoint.port,
    });
    state = applyRuntimeEndpointFromDetails(state, status.details);
    endpoint = resolveRuntimeEndpoint(state);
    const statusRunning = status.ok && isStatusRunning(status);
    let didRunUp = false;
    let preflightResult: SkillRunnerCtlCommandResult | undefined;
    if (!statusRunning) {
      const backgroundAction = normalizeString(options?.backgroundInFlightAction);
      if (backgroundAction) {
        setBackgroundInFlightAction(backgroundAction);
      }
      try {
        state = applyRuntimeStatePatch({
          state,
          runtimeState: "starting",
          runtimeError: normalizeString(
            status.details?.status || status.message || "runtime not running",
          ),
        });
        preflightResult = await bridge.runCtlCommand({
          ctlPath,
          command: "preflight",
          host: endpoint.host,
          port: endpoint.requestedPort,
          portFallbackSpan: endpoint.portFallbackSpan,
        });
        if (!preflightResult.ok) {
          setAutoStartEnabledInSession(false);
          const nextFailureCount = (state.runtimeFailureCount || 0) + 1;
          state = applyRuntimeStatePatch({
            state,
            runtimeState: "degraded",
            runtimeFailureCount: nextFailureCount,
            runtimeError: normalizeString(preflightResult.message) || "preflight failed",
          });
          return {
            ok: false,
            stage: "ensure-preflight",
            message: normalizeString(preflightResult.message) || "managed local runtime preflight failed",
            details: {
              runtimeState: state.runtimeState,
              runtimeFailureCount: state.runtimeFailureCount || 0,
              lastRuntimeError: state.lastRuntimeError,
              preflight: preflightResult.details,
            },
          };
        }
        setAutoStartEnabledInSession(true);
        const up = await bridge.runCtlCommand({
          ctlPath,
          command: "up",
          mode: "local",
          host: endpoint.host,
          port: endpoint.requestedPort,
          portFallbackSpan: endpoint.portFallbackSpan,
        });
        state = applyRuntimeEndpointFromDetails(state, up.details);
        endpoint = resolveRuntimeEndpoint(state);
        if (!up.ok) {
          const nextFailureCount = (state.runtimeFailureCount || 0) + 1;
          state = applyRuntimeStatePatch({
            state,
            runtimeState: "degraded",
            runtimeFailureCount: nextFailureCount,
            runtimeError: normalizeString(up.message) || "ctl up failed",
          });
          return {
            ok: false,
            stage: "ensure-up",
            message: normalizeString(up.message) || "managed local runtime up failed",
            details: {
              runtimeState: state.runtimeState,
              runtimeFailureCount: state.runtimeFailureCount || 0,
              lastRuntimeError: state.lastRuntimeError,
              preflight: preflightResult.details,
            },
          };
        }
        didRunUp = true;
        const statusPoll = await pollStatusUntilRunning({
          bridge,
          ctlPath,
          port: endpoint.port,
        });
        if (statusPoll.status) {
          state = applyRuntimeEndpointFromDetails(state, statusPoll.status.details);
          endpoint = resolveRuntimeEndpoint(state);
        }
        if (!statusPoll.ok) {
          const nextFailureCount = (state.runtimeFailureCount || 0) + 1;
          state = applyRuntimeStatePatch({
            state,
            runtimeState: "degraded",
            runtimeFailureCount: nextFailureCount,
            runtimeError: normalizeString(
              statusPoll.status?.details?.status ||
                statusPoll.status?.message ||
                "runtime not running after up",
            ),
          });
          return {
            ok: false,
            stage: "ensure-status",
            message: `runtime status is not running: ${normalizeString(
              statusPoll.status?.details?.status ||
                statusPoll.status?.message ||
                "unknown",
            )}`,
            details: {
              statusTrail: statusPoll.trail,
              statusAttempts: statusPoll.attempts,
              runtimeState: state.runtimeState,
              runtimeFailureCount: state.runtimeFailureCount || 0,
              lastRuntimeError: state.lastRuntimeError,
              preflight: preflightResult.details,
            },
          };
        }
      } finally {
        if (backgroundAction) {
          setBackgroundInFlightAction("");
        }
      }
    }
    state = applyRuntimeStatePatch({
      state,
      runtimeState: "running",
      runtimeFailureCount: 0,
      runtimeError: "",
    });
    const profileSyncResult = await ensureManagedProfileConfigured(
      state,
      resolveManagedBaseUrl(state),
    );
    if (!profileSyncResult.ok) {
      return {
        ok: false,
        stage: "ensure-configure-profile",
        message: profileSyncResult.message,
        conflict: profileSyncResult.conflict,
      };
    }
    const leaseAcquire = await tryAcquireLeaseOnRunning();
    state = leaseAcquire.state;
    if (!leaseAcquire.ok) {
      state = applyRuntimeStatePatch({
        state,
        runtimeState: "degraded",
        runtimeFailureCount: state.runtimeFailureCount || 0,
        runtimeError: normalizeString(leaseAcquire.reason) || "lease acquire failed",
      });
      return {
        ok: false,
        stage: "ensure-lease",
        message: `managed local runtime lease acquire failed: ${normalizeString(
          leaseAcquire.reason || "unknown",
        )}`,
        details: {
          runtimeState: state.runtimeState,
          runtimeFailureCount: state.runtimeFailureCount || 0,
          leaseState: resolveLeaseViewState(state.lease),
          leaseError: state.lease?.lastError,
          preflight: preflightResult?.details,
        },
      };
    }
    const finalEndpoint = resolveRuntimeEndpoint(state);
    if (didRunUp) {
      triggerManagedLocalRuntimePostUpTaskReconcile(state);
      emitLocalRuntimeToast("runtime-up");
    }
    return {
      ok: true,
      stage: "ensure-complete",
      message: "managed local runtime ensured (running + lease acquired)",
      details: {
        baseUrl: resolveManagedBaseUrl(state),
        actualHost: finalEndpoint.host,
        actualPort: finalEndpoint.port,
        actualUrl: finalEndpoint.url,
        requestedPort: state.requestedPort || finalEndpoint.requestedPort,
        portFallbackSpan: state.portFallbackSpan ?? finalEndpoint.portFallbackSpan,
        portFallbackUsed: state.portFallbackUsed === true,
        triedPorts: state.triedPorts || [],
        runtimeState: state.runtimeState,
        leaseState: resolveLeaseViewState(state.lease),
        runtimeFailureCount: state.runtimeFailureCount || 0,
        preflight: preflightResult?.details,
      },
    };
  });
}

export async function releaseManagedLocalRuntimeLeaseOnShutdown() {
  clearStatusReconcileTimer();
  clearHeartbeatTimer();
  const state = readManagedLocalRuntimeState();
  const lease = state.lease || {};
  if (!lease.acquired) {
    return;
  }
  const leaseId = normalizeString(lease.leaseId);
  if (!leaseId) {
    state.lease = {
      ...lease,
      acquired: false,
      leaseId: undefined,
      lastHeartbeatAt: nowIso(),
      lastError: "lease release skipped because lease_id is missing",
    };
    writeManagedLocalRuntimeState(state);
    return;
  }
  const response = await postLease("/v1/local-runtime/lease/release", {
    lease_id: leaseId,
  });
  state.lease = {
    ...lease,
    acquired: false,
    leaseId: undefined,
    lastHeartbeatAt: nowIso(),
    lastError: response.ok
      ? undefined
      : normalizeString(response.body?.detail) || response.error || "lease release failed",
  };
  writeManagedLocalRuntimeState(state);
}
