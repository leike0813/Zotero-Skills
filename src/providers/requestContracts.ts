import {
  DEFAULT_BACKEND_TYPE,
  PASS_THROUGH_BACKEND_TYPE,
  PASS_THROUGH_REQUEST_KIND,
} from "../config/defaults";

type ProviderRequestContractDefinition = {
  providerType: string;
  backendType: string;
  validatePayload: (request: unknown) => string | null;
};

const PROVIDER_REQUEST_CONTRACTS: Record<
  string,
  ProviderRequestContractDefinition
> = {
  "skillrunner.job.v1": {
    providerType: DEFAULT_BACKEND_TYPE,
    backendType: DEFAULT_BACKEND_TYPE,
    validatePayload: validateSkillRunnerJobPayload,
  },
  "generic-http.request.v1": {
    providerType: "generic-http",
    backendType: "generic-http",
    validatePayload: validateGenericHttpRequestPayload,
  },
  "generic-http.steps.v1": {
    providerType: "generic-http",
    backendType: "generic-http",
    validatePayload: validateGenericHttpStepsPayload,
  },
  [PASS_THROUGH_REQUEST_KIND]: {
    providerType: PASS_THROUGH_BACKEND_TYPE,
    backendType: PASS_THROUGH_BACKEND_TYPE,
    validatePayload: validatePassThroughPayload,
  },
};

export type ProviderRequestContractCategory =
  | "provider_contract_error"
  | "provider_backend_mismatch"
  | "request_kind_unsupported"
  | "request_payload_invalid";

export type ProviderRequestContractReason =
  | "request_kind_missing"
  | "unsupported_request_kind"
  | "backend_type_mismatch"
  | "provider_type_mismatch"
  | "provider_not_registered"
  | "invalid_request_payload";

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeRequestKind(value: unknown) {
  return String(value || "").trim();
}

function validateSkillRunnerJobPayload(request: unknown) {
  if (!isObject(request)) {
    return "payload must be object";
  }
  if (String(request.kind || "").trim() !== "skillrunner.job.v1") {
    return "payload.kind must be skillrunner.job.v1";
  }
  if (!isNonEmptyString(request.skill_id)) {
    return "payload.skill_id must be non-empty string";
  }
  if (!Array.isArray(request.upload_files) || request.upload_files.length === 0) {
    return "payload.upload_files must be non-empty array";
  }
  return null;
}

function validateGenericHttpRequestPayload(request: unknown) {
  if (!isObject(request)) {
    return "payload must be object";
  }
  if (!isObject(request.request)) {
    return "payload.request must be object";
  }
  if (!isNonEmptyString(request.request.method)) {
    return "payload.request.method must be non-empty string";
  }
  if (!isNonEmptyString(request.request.path)) {
    return "payload.request.path must be non-empty string";
  }
  return null;
}

function validateGenericHttpStepsPayload(request: unknown) {
  if (!isObject(request)) {
    return "payload must be object";
  }
  if (!Array.isArray(request.steps) || request.steps.length === 0) {
    return "payload.steps must be non-empty array";
  }
  return null;
}

function validatePassThroughPayload(request: unknown) {
  if (!isObject(request)) {
    return "payload must be object";
  }
  if (String(request.kind || "").trim() !== PASS_THROUGH_REQUEST_KIND) {
    return `payload.kind must be ${PASS_THROUGH_REQUEST_KIND}`;
  }
  if (!Object.prototype.hasOwnProperty.call(request, "selectionContext")) {
    return "payload.selectionContext is required";
  }
  return null;
}

function buildContractErrorMessage(args: {
  category: ProviderRequestContractCategory;
  reason: ProviderRequestContractReason;
  requestKind?: string;
  backendType?: string;
  providerId?: string;
  detail?: string;
}) {
  const parts = [
    `category=${args.category}`,
    `reason=${args.reason}`,
    `requestKind=${String(args.requestKind || "")}`,
    `backendType=${String(args.backendType || "")}`,
    `providerId=${String(args.providerId || "")}`,
  ];
  if (String(args.detail || "").trim()) {
    parts.push(`detail=${String(args.detail).trim()}`);
  }
  return `Provider request contract error (${parts.join(", ")})`;
}

export class ProviderRequestContractError extends Error {
  readonly category: ProviderRequestContractCategory;

  readonly reason: ProviderRequestContractReason;

  readonly requestKind?: string;

  readonly backendType?: string;

  readonly providerId?: string;

  readonly detail?: string;

  constructor(args: {
    category: ProviderRequestContractCategory;
    reason: ProviderRequestContractReason;
    requestKind?: string;
    backendType?: string;
    providerId?: string;
    detail?: string;
  }) {
    super(
      buildContractErrorMessage({
        category: args.category,
        reason: args.reason,
        requestKind: args.requestKind,
        backendType: args.backendType,
        providerId: args.providerId,
        detail: args.detail,
      }),
    );
    this.name = "ProviderRequestContractError";
    this.category = args.category;
    this.reason = args.reason;
    this.requestKind = args.requestKind;
    this.backendType = args.backendType;
    this.providerId = args.providerId;
    this.detail = args.detail;
  }
}

export function assertRequestKindSupported(requestKind: unknown) {
  const normalized = normalizeRequestKind(requestKind);
  if (!normalized) {
    throw new ProviderRequestContractError({
      category: "request_kind_unsupported",
      reason: "request_kind_missing",
      requestKind: normalized,
      detail: "requestKind is required",
    });
  }
  const contract = PROVIDER_REQUEST_CONTRACTS[normalized];
  if (!contract) {
    throw new ProviderRequestContractError({
      category: "request_kind_unsupported",
      reason: "unsupported_request_kind",
      requestKind: normalized,
    });
  }
  return {
    requestKind: normalized,
    contract,
  };
}

export function assertRequestKindBackendCompatible(args: {
  requestKind: unknown;
  backendType: unknown;
}) {
  const normalizedBackendType = String(args.backendType || "").trim();
  const resolved = assertRequestKindSupported(args.requestKind);
  if (resolved.contract.backendType !== normalizedBackendType) {
    throw new ProviderRequestContractError({
      category: "provider_backend_mismatch",
      reason: "backend_type_mismatch",
      requestKind: resolved.requestKind,
      backendType: normalizedBackendType,
      providerId: resolved.contract.providerType,
      detail: `expected backendType=${resolved.contract.backendType}`,
    });
  }
  return {
    ...resolved,
    backendType: normalizedBackendType,
  };
}

export function assertRequestKindProviderCompatible(args: {
  requestKind: unknown;
  providerId: unknown;
}) {
  const normalizedProviderId = String(args.providerId || "").trim();
  const resolved = assertRequestKindSupported(args.requestKind);
  if (resolved.contract.providerType !== normalizedProviderId) {
    throw new ProviderRequestContractError({
      category: "provider_contract_error",
      reason: "provider_type_mismatch",
      requestKind: resolved.requestKind,
      providerId: normalizedProviderId,
      detail: `expected providerId=${resolved.contract.providerType}`,
    });
  }
  return {
    ...resolved,
    providerId: normalizedProviderId,
  };
}

export function assertRequestPayloadContract(args: {
  requestKind: unknown;
  request: unknown;
}) {
  const resolved = assertRequestKindSupported(args.requestKind);
  const detail = resolved.contract.validatePayload(args.request);
  if (detail) {
    throw new ProviderRequestContractError({
      category: "request_payload_invalid",
      reason: "invalid_request_payload",
      requestKind: resolved.requestKind,
      detail,
    });
  }
  return resolved;
}

export function assertProviderRequestDispatchContract(args: {
  requestKind: unknown;
  backendType: unknown;
  providerId: unknown;
  request: unknown;
}) {
  const byBackend = assertRequestKindBackendCompatible({
    requestKind: args.requestKind,
    backendType: args.backendType,
  });
  const byProvider = assertRequestKindProviderCompatible({
    requestKind: byBackend.requestKind,
    providerId: args.providerId,
  });
  assertRequestPayloadContract({
    requestKind: byProvider.requestKind,
    request: args.request,
  });
  return byProvider;
}
