import { getString } from "../utils/locale";
import { MANAGED_LOCAL_BACKEND_ID } from "../modules/skillRunnerLocalRuntimeConstants";

function fallbackLocalBackendName() {
  const locale = String((Zotero as { locale?: unknown })?.locale || "")
    .trim()
    .toLowerCase();
  if (locale.startsWith("zh")) {
    return "本地后端";
  }
  return "Local Backend";
}

export function resolveBackendDisplayName(
  backendId: string,
  configuredDisplayName?: string,
) {
  const normalized = String(backendId || "").trim();
  const configured = String(configuredDisplayName || "").trim();
  if (!normalized) {
    return "";
  }
  if (normalized === MANAGED_LOCAL_BACKEND_ID) {
    const localized = (() => {
      try {
        const runtime = globalThis as { addon?: unknown };
        if (!runtime.addon) {
          return "";
        }
        return String(getString("backend-display-local-skillrunner" as any) || "").trim();
      } catch {
        return "";
      }
    })();
    if (!localized || /backend-display-local-skillrunner/.test(localized)) {
      return configured || fallbackLocalBackendName();
    }
    return localized;
  }
  if (configured) {
    return configured;
  }
  return normalized;
}
