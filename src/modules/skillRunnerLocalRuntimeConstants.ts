export const MANAGED_LOCAL_BACKEND_ID = "local-skillrunner-backend";

export function normalizeManagedLocalBackendId(value: unknown) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  if (normalized === MANAGED_LOCAL_BACKEND_ID) {
    return MANAGED_LOCAL_BACKEND_ID;
  }
  return normalized;
}
