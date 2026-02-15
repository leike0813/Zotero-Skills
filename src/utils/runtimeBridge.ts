type RuntimeAddonLike = {
  data?: {
    config?: {
      addonName?: string;
      addonRef?: string;
    };
    ztoolkit?: Record<string, unknown>;
  };
};

type RuntimeGlobalLike = typeof globalThis & {
  addon?: RuntimeAddonLike;
  ztoolkit?: Record<string, unknown>;
  alert?: (message?: unknown) => void;
};

type RuntimeBridgeOverride = {
  addon?: RuntimeAddonLike | undefined;
  ztoolkit?: Record<string, unknown> | undefined;
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

function readToolkitFromGlobalVar() {
  if (typeof ztoolkit === "undefined" || !ztoolkit) {
    return undefined;
  }
  return ztoolkit as unknown as Record<string, unknown>;
}

export function resolveRuntimeAddon() {
  if (runtimeBridgeOverride && "addon" in runtimeBridgeOverride) {
    return runtimeBridgeOverride.addon;
  }
  return readAddonFromGlobalVar() || resolveRuntimeGlobal().addon;
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
