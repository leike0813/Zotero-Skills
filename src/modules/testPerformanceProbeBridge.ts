type PerformanceSpanLabels = Record<string, unknown>;

type PerformanceProbeHooks = {
  enabled: boolean;
  recordSpan?: (args: {
    name: string;
    startedAt: number;
    durationMs: number;
    labels?: PerformanceSpanLabels;
  }) => void;
};

const HOOKS_KEY = "__zs_test_performance_probe_hooks__";

type RuntimeWithPerfHooks = typeof globalThis & {
  [HOOKS_KEY]?: PerformanceProbeHooks;
};

function getRuntime() {
  return globalThis as RuntimeWithPerfHooks;
}

function getHooks() {
  return getRuntime()[HOOKS_KEY] || null;
}

export function installTestPerformanceProbeHooksForTests(
  hooks: PerformanceProbeHooks,
) {
  getRuntime()[HOOKS_KEY] = hooks;
}

export function resetTestPerformanceProbeHooksForTests() {
  delete getRuntime()[HOOKS_KEY];
}

export function isTestPerformanceProbeEnabled() {
  return getHooks()?.enabled === true;
}

export function recordTestPerformanceSpan(args: {
  name: string;
  startedAt: number;
  durationMs: number;
  labels?: PerformanceSpanLabels;
}) {
  const hooks = getHooks();
  if (!hooks?.enabled || typeof hooks.recordSpan !== "function") {
    return;
  }
  hooks.recordSpan(args);
}

export async function measureAsyncTestPerformanceSpan<T>(
  name: string,
  labels: PerformanceSpanLabels | undefined,
  work: () => Promise<T>,
) {
  const hooks = getHooks();
  if (!hooks?.enabled || typeof hooks.recordSpan !== "function") {
    return work();
  }
  const startedAt = Date.now();
  try {
    return await work();
  } finally {
    hooks.recordSpan({
      name,
      startedAt,
      durationMs: Date.now() - startedAt,
      labels,
    });
  }
}

export function measureSyncTestPerformanceSpan<T>(
  name: string,
  labels: PerformanceSpanLabels | undefined,
  work: () => T,
) {
  const hooks = getHooks();
  if (!hooks?.enabled || typeof hooks.recordSpan !== "function") {
    return work();
  }
  const startedAt = Date.now();
  try {
    return work();
  } finally {
    hooks.recordSpan({
      name,
      startedAt,
      durationMs: Date.now() - startedAt,
      labels,
    });
  }
}
