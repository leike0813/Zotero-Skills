export const MANAGED_LOCAL_BACKEND_ID = "local-skillrunner-backend";
export const LEGACY_MANAGED_LOCAL_BACKEND_IDS = new Set(["skillrunner-local"]);

export function normalizeManagedLocalBackendId(value: unknown) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  if (normalized === MANAGED_LOCAL_BACKEND_ID) {
    return MANAGED_LOCAL_BACKEND_ID;
  }
  if (LEGACY_MANAGED_LOCAL_BACKEND_IDS.has(normalized)) {
    return MANAGED_LOCAL_BACKEND_ID;
  }
  return normalized;
}
