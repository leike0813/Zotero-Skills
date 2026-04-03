type RuntimeAddonLike = {
  data?: {
    config?: {
      addonName?: string;
      addonRef?: string;
    };
    ztoolkit?: Record<string, unknown>;
  };
};

type RuntimeZoteroLike = typeof Zotero;

type RuntimeGlobalLike = typeof globalThis & {
  addon?: RuntimeAddonLike;
  Zotero?: RuntimeZoteroLike;
  ztoolkit?: Record<string, unknown>;
  alert?: (message?: unknown) => void;
  console?: typeof globalThis.console | null;
};

type RuntimeBridgeOverride = {
  addon?: RuntimeAddonLike | undefined;
  zotero?: RuntimeZoteroLike | undefined;
  ztoolkit?: Record<string, unknown> | undefined;
};

type RuntimeHostCapabilities = {
  zotero?: RuntimeZoteroLike | undefined;
  addon?: RuntimeAddonLike | undefined;
  fetch?: typeof globalThis.fetch | null;
  Buffer?: typeof globalThis.Buffer | null;
  btoa?: typeof globalThis.btoa | null;
  atob?: typeof globalThis.atob | null;
  TextEncoder?: typeof globalThis.TextEncoder | null;
  TextDecoder?: typeof globalThis.TextDecoder | null;
  FileReader?: typeof globalThis.FileReader | null;
  navigator?: typeof globalThis.navigator | null;
  console?: typeof globalThis.console | undefined;
};

type RuntimeZoteroShape = {
  hasItems: boolean;
  hasPrefs: boolean;
  hasFile: boolean;
  hasDebug: boolean;
};

type RuntimeZoteroResolution = {
  zotero?: RuntimeZoteroLike | undefined;
  source: "override" | "global-var" | "global-this" | "unresolved";
  shape: RuntimeZoteroShape;
};

let runtimeBridgeOverride: RuntimeBridgeOverride | null = null;

function resolveRuntimeGlobal() {
  return globalThis as RuntimeGlobalLike;
}

function readAddonFromGlobalVar() {
  if (typeof addon === "undefined" || !addon) {
    return undefined;
  }
  return addon as unknown as RuntimeAddonLike;
}

function readZoteroFromGlobalVar() {
  if (typeof Zotero === "undefined" || !Zotero) {
    return undefined;
  }
  return Zotero as unknown as RuntimeZoteroLike;
}

function readToolkitFromGlobalVar() {
  if (typeof ztoolkit === "undefined" || !ztoolkit) {
    return undefined;
  }
  return ztoolkit as unknown as Record<string, unknown>;
}

function readConsoleFromGlobalVar() {
  if (typeof console === "undefined" || !console) {
    return undefined;
  }
  return console as typeof globalThis.console;
}

export function summarizeRuntimeZoteroShape(
  value: unknown,
): RuntimeZoteroShape {
  const candidate =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;
  const items =
    candidate && typeof candidate.Items === "object"
      ? (candidate.Items as Record<string, unknown>)
      : null;
  const prefs =
    candidate && typeof candidate.Prefs === "object"
      ? (candidate.Prefs as Record<string, unknown>)
      : null;
  const file =
    candidate && typeof candidate.File === "object"
      ? (candidate.File as Record<string, unknown>)
      : null;
  return {
    hasItems: !!items && typeof items.get === "function",
    hasPrefs:
      !!prefs &&
      typeof prefs.get === "function" &&
      typeof prefs.set === "function",
    hasFile: !!file && typeof file.pathToFile === "function",
    hasDebug: !!candidate && typeof candidate.debug === "function",
  };
}

function scoreRuntimeZoteroShape(shape: RuntimeZoteroShape) {
  return (
    (shape.hasItems && shape.hasPrefs ? 100 : 0) +
    (shape.hasItems ? 40 : 0) +
    (shape.hasPrefs ? 20 : 0) +
    (shape.hasFile ? 5 : 0) +
    (shape.hasDebug ? 1 : 0)
  );
}

export function resolveRuntimeZoteroDetails(): RuntimeZoteroResolution {
  if (runtimeBridgeOverride && "zotero" in runtimeBridgeOverride) {
    if (typeof runtimeBridgeOverride.zotero === "undefined") {
      return {
        zotero: undefined,
        source: "override",
        shape: summarizeRuntimeZoteroShape(undefined),
      };
    }
  }

  const candidates: Array<{
    source: "override" | "global-var" | "global-this";
    zotero: RuntimeZoteroLike;
  }> = [];
  if (
    runtimeBridgeOverride &&
    "zotero" in runtimeBridgeOverride &&
    runtimeBridgeOverride.zotero
  ) {
    candidates.push({
      source: "override",
      zotero: runtimeBridgeOverride.zotero,
    });
  }
  const fromGlobalVar = readZoteroFromGlobalVar();
  if (fromGlobalVar) {
    candidates.push({
      source: "global-var",
      zotero: fromGlobalVar,
    });
  }
  const fromGlobalThis = resolveRuntimeGlobal().Zotero;
  if (fromGlobalThis) {
    candidates.push({
      source: "global-this",
      zotero: fromGlobalThis,
    });
  }

  let best: RuntimeZoteroResolution | null = null;
  let bestScore = -1;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const shape = summarizeRuntimeZoteroShape(candidate.zotero);
    const score = scoreRuntimeZoteroShape(shape);
    if (score > bestScore) {
      best = {
        zotero: candidate.zotero,
        source: candidate.source,
        shape,
      };
      bestScore = score;
    }
  }

  if (best) {
    return best;
  }
  return {
    zotero: undefined,
    source: "unresolved",
    shape: summarizeRuntimeZoteroShape(undefined),
  };
}

export function resolveRuntimeAddon() {
  if (runtimeBridgeOverride && "addon" in runtimeBridgeOverride) {
    return runtimeBridgeOverride.addon;
  }
  return readAddonFromGlobalVar() || resolveRuntimeGlobal().addon;
}

export function resolveRuntimeZotero() {
  return resolveRuntimeZoteroDetails().zotero;
}

export function resolveRuntimeConsole() {
  return readConsoleFromGlobalVar() || resolveRuntimeGlobal().console || undefined;
}

export function resolveRuntimeHostCapabilities(): RuntimeHostCapabilities {
  const runtimeGlobal = resolveRuntimeGlobal();
  const boundFetch =
    typeof runtimeGlobal.fetch === "function"
      ? runtimeGlobal.fetch.bind(runtimeGlobal)
      : null;
  const boundBtoa =
    typeof runtimeGlobal.btoa === "function"
      ? runtimeGlobal.btoa.bind(runtimeGlobal)
      : null;
  const boundAtob =
    typeof runtimeGlobal.atob === "function"
      ? runtimeGlobal.atob.bind(runtimeGlobal)
      : null;
  return {
    zotero: resolveRuntimeZotero(),
    addon: resolveRuntimeAddon(),
    fetch: boundFetch,
    Buffer:
      (runtimeGlobal.Buffer as typeof globalThis.Buffer | undefined) ?? null,
    btoa: boundBtoa,
    atob: boundAtob,
    TextEncoder:
      (runtimeGlobal.TextEncoder as typeof globalThis.TextEncoder | undefined) ??
      null,
    TextDecoder:
      (runtimeGlobal.TextDecoder as typeof globalThis.TextDecoder | undefined) ??
      null,
    FileReader:
      (runtimeGlobal.FileReader as typeof globalThis.FileReader | undefined) ??
      null,
    navigator:
      (runtimeGlobal.navigator as typeof globalThis.navigator | undefined) ?? null,
    console: resolveRuntimeConsole(),
  };
}

export function resolveRuntimeToolkit() {
  if (runtimeBridgeOverride && "ztoolkit" in runtimeBridgeOverride) {
    return runtimeBridgeOverride.ztoolkit;
  }
  const fromGlobalVar = readToolkitFromGlobalVar();
  const fromGlobalThis = resolveRuntimeGlobal().ztoolkit;
  const fromAddon = resolveRuntimeAddon()?.data?.ztoolkit;
  return fromGlobalVar || fromGlobalThis || fromAddon;
}

export function resolveToolkitMember<T>(member: string) {
  const toolkit = resolveRuntimeToolkit();
  const value = toolkit ? (toolkit as Record<string, unknown>)[member] : undefined;
  if (typeof value === "undefined") {
    return undefined;
  }
  return value as T;
}

export function resolveAddonName(fallback = "Zotero Skills") {
  const name = String(resolveRuntimeAddon()?.data?.config?.addonName || "").trim();
  return name || fallback;
}

export function resolveAddonRef(fallback = "") {
  const ref = String(resolveRuntimeAddon()?.data?.config?.addonRef || "").trim();
  return ref || fallback;
}

export function resolveRuntimeAlert(win?: unknown) {
  const candidate = win as { alert?: ((message?: unknown) => void) | undefined } | undefined;
  if (typeof candidate?.alert === "function") {
    return (message: string) => candidate.alert?.(message);
  }
  const toolkit = resolveRuntimeToolkit() as
    | {
        getGlobal?: (name: string) => unknown;
      }
    | undefined;
  const fromToolkit = toolkit?.getGlobal?.("alert");
  if (typeof fromToolkit === "function") {
    return (message: string) => (fromToolkit as (value: string) => unknown)(message);
  }
  const fromGlobal = resolveRuntimeGlobal().alert;
  if (typeof fromGlobal === "function") {
    return (message: string) => fromGlobal(message);
  }
  return undefined;
}

export function installRuntimeBridgeOverrideForTests(
  override: RuntimeBridgeOverride,
) {
  runtimeBridgeOverride = { ...override };
}

export function resetRuntimeBridgeOverrideForTests() {
  runtimeBridgeOverride = null;
}
