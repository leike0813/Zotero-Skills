import { getString } from "./locale";

export type ManagedLocalRuntimeToastKind =
  | "runtime-up"
  | "runtime-down"
  | "runtime-abnormal-stop";

function normalizeLocale(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function resolveRuntimeLocale() {
  const runtime = globalThis as {
    Zotero?: { locale?: unknown };
    navigator?: { language?: unknown };
  };
  const fromZotero = normalizeLocale(runtime.Zotero?.locale);
  if (fromZotero) {
    return fromZotero;
  }
  const fromNavigator = normalizeLocale(runtime.navigator?.language);
  if (fromNavigator) {
    return fromNavigator;
  }
  return "en-us";
}

export function isZhLocale(locale?: string) {
  const normalized = normalizeLocale(locale || resolveRuntimeLocale());
  return normalized.startsWith("zh");
}

export function fallbackByLocale(args: {
  zhCN: string;
  enUS: string;
  locale?: string;
}) {
  if (isZhLocale(args.locale)) {
    return args.zhCN;
  }
  return args.enUS;
}

function looksLikeUnresolvedLocalizationValue(value: string, key: string) {
  const normalizedValue = String(value || "").trim();
  const normalizedKey = String(key || "").trim();
  if (!normalizedValue) {
    return true;
  }
  if (!normalizedKey) {
    return false;
  }
  if (normalizedValue === normalizedKey) {
    return true;
  }
  // getString unresolved shape: "<addonRef>-<key>"
  if (normalizedValue.endsWith(`-${normalizedKey}`)) {
    return true;
  }
  return false;
}

export function getStringWithLocaleFallback(args: {
  key: string;
  fallback: {
    zhCN: string;
    enUS: string;
  };
  locale?: string;
}) {
  let localized = "";
  try {
    const runtime = globalThis as { addon?: unknown };
    if (runtime.addon) {
      localized = String(getString(args.key as any) || "").trim();
    }
  } catch {
    localized = "";
  }
  if (looksLikeUnresolvedLocalizationValue(localized, args.key)) {
    return fallbackByLocale({
      zhCN: args.fallback.zhCN,
      enUS: args.fallback.enUS,
      locale: args.locale,
    });
  }
  return localized;
}

const managedLocalBackendDisplayNameFallback = {
  zhCN: "本地后端",
  enUS: "Local Backend",
};

const managedLocalRuntimeToastFallback: Record<
  ManagedLocalRuntimeToastKind,
  { zhCN: string; enUS: string }
> = {
  "runtime-up": {
    zhCN: "本地后端已启动。",
    enUS: "Local backend started.",
  },
  "runtime-down": {
    zhCN: "本地后端已停止。",
    enUS: "Local backend stopped.",
  },
  "runtime-abnormal-stop": {
    zhCN: "本地后端异常停止。",
    enUS: "Local backend stopped unexpectedly.",
  },
};

export function resolveManagedLocalBackendDisplayNameText() {
  return getStringWithLocaleFallback({
    key: "backend-display-local-skillrunner",
    fallback: managedLocalBackendDisplayNameFallback,
  });
}

export function resolveManagedLocalRuntimeToastText(
  kind: ManagedLocalRuntimeToastKind,
) {
  if (kind === "runtime-up") {
    return getStringWithLocaleFallback({
      key: "skillrunner-local-runtime-toast-up",
      fallback: managedLocalRuntimeToastFallback["runtime-up"],
    });
  }
  if (kind === "runtime-down") {
    return getStringWithLocaleFallback({
      key: "skillrunner-local-runtime-toast-down",
      fallback: managedLocalRuntimeToastFallback["runtime-down"],
    });
  }
  return getStringWithLocaleFallback({
    key: "skillrunner-local-runtime-toast-abnormal-stop",
    fallback: managedLocalRuntimeToastFallback["runtime-abnormal-stop"],
  });
}
