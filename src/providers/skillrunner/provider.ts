import {
  DEFAULT_BACKEND_TYPE,
  DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE,
} from "../../config/defaults";
import type { BackendInstance } from "../../backends/types";
import type {
  ProviderExecutionResult,
  SkillRunnerHttpStepsRequest,
  SkillRunnerJobRequestV1,
} from "../contracts";
import type {
  Provider,
  ProviderProgressEvent,
  ProviderSupportsArgs,
} from "../types";
import { appendRuntimeLog } from "../../modules/runtimeLogManager";
import {
  getDefaultSkillRunnerEngine,
  getDefaultSkillRunnerModelProvider,
  listSkillRunnerEngines,
  listSkillRunnerModelOptions,
  listSkillRunnerModelOptionsForProvider,
  listSkillRunnerModelProviders,
  normalizeSkillRunnerModel,
  splitSkillRunnerModelId,
} from "./modelCatalog";
import { SkillRunnerClient } from "./client";
import { ensureManagedLocalRuntimeForBackend } from "../../modules/skillRunnerLocalRuntimeManager";

function isOpencodeEngine(engine: string) {
  return String(engine || "").trim() === "opencode";
}

function normalizeNoCache(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  }
  return false;
}

function normalizeBooleanOption(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return false;
}

function normalizePositiveInteger(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) {
    return undefined;
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

export class SkillRunnerProvider implements Provider {
  readonly id = "skillrunner";

  private readonly staticClient?: SkillRunnerClient;

  constructor(args?: { baseUrl: string }) {
    if (args?.baseUrl) {
      this.staticClient = new SkillRunnerClient({ baseUrl: args.baseUrl });
    }
  }

  supports(args: ProviderSupportsArgs) {
    return (
      args.backend.type === DEFAULT_BACKEND_TYPE &&
      args.requestKind === DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE[DEFAULT_BACKEND_TYPE]
    );
  }

  supportsRequestKind(requestKind: string) {
    return requestKind === DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE[DEFAULT_BACKEND_TYPE];
  }

  getRuntimeOptionSchema() {
    const defaultEngine = getDefaultSkillRunnerEngine() || "gemini";
    const defaultModelProvider =
      getDefaultSkillRunnerModelProvider(defaultEngine) || "";
    return {
      engine: {
        type: "string" as const,
        title: "Engine",
        description: "Skill-Runner execution engine.",
        default: defaultEngine,
        enum: listSkillRunnerEngines(),
      },
      model_provider: {
        type: "string" as const,
        title: "Model Provider",
        description:
          "Model provider for OpenCode. Other engines use a fixed provider.",
        default: defaultModelProvider,
      },
      model: {
        type: "string" as const,
        title: "Model",
        description: "Optional model override for selected engine.",
        default: "",
      },
      no_cache: {
        type: "boolean" as const,
        title: "Bypass Cache",
        description: "When true, force backend execution without cache.",
        default: false,
      },
      interactive_auto_reply: {
        type: "boolean" as const,
        title: "Auto Reply",
        description:
          "Interactive mode only. Automatically continue after waiting timeout.",
        default: false,
      },
      hard_timeout_seconds: {
        type: "number" as const,
        title: "Job Timeout",
        description:
          "Optional positive integer timeout in seconds. Empty means backend default.",
      },
    };
  }

  getRuntimeOptionEnumValues(args: {
    key: string;
    options: Record<string, unknown>;
    backend?: BackendInstance;
  }) {
    const backendContext =
      args.backend &&
      typeof args.backend.id === "string" &&
      typeof args.backend.baseUrl === "string"
        ? {
            backendId: args.backend.id,
            baseUrl: args.backend.baseUrl,
          }
        : undefined;
    if (args.key === "engine") {
      return listSkillRunnerEngines(backendContext);
    }
    const rawEngine = args.options.engine;
    const normalizedEngine =
      typeof rawEngine === "string" && rawEngine.trim()
        ? rawEngine.trim()
        : getDefaultSkillRunnerEngine();
    if (args.key === "model_provider") {
      return listSkillRunnerModelProviders(normalizedEngine, backendContext);
    }
    if (args.key === "model") {
      if (isOpencodeEngine(normalizedEngine)) {
        const modelProviderRaw = String(args.options.model_provider || "").trim();
        const modelProvider =
          modelProviderRaw ||
          getDefaultSkillRunnerModelProvider(normalizedEngine, backendContext);
        return listSkillRunnerModelOptionsForProvider(
          normalizedEngine,
          modelProvider,
          backendContext,
        ).map((entry) => entry.value);
      }
      return listSkillRunnerModelOptions(normalizedEngine, backendContext).map(
        (entry) => entry.value,
      );
    }
    return [];
  }

  normalizeRuntimeOptions(options: unknown, backend?: BackendInstance) {
    const source =
      options && typeof options === "object" && !Array.isArray(options)
        ? (options as Record<string, unknown>)
        : {};
    const rawEngine = source.engine;
    const rawModelProvider = source.model_provider;
    const rawModel = source.model;
    const rawNoCache = source.no_cache;
    const rawInteractiveAutoReply = source.interactive_auto_reply;
    const rawHardTimeoutSeconds = source.hard_timeout_seconds;
    const normalizedEngine =
      typeof rawEngine === "string" && rawEngine.trim()
        ? rawEngine.trim()
        : getDefaultSkillRunnerEngine() || "gemini";
    const backendContext =
      backend &&
      typeof backend.id === "string" &&
      typeof backend.baseUrl === "string"
        ? {
            backendId: backend.id,
            baseUrl: backend.baseUrl,
          }
        : undefined;
    const rawModelText = String(rawModel || "").trim();
    const parsedRawModel =
      isOpencodeEngine(normalizedEngine) && rawModelText
        ? splitSkillRunnerModelId(rawModelText)
        : null;
    const providerCandidates = listSkillRunnerModelProviders(
      normalizedEngine,
      backendContext,
    );
    const explicitProvider =
      typeof rawModelProvider === "string" ? rawModelProvider.trim() : "";
    let normalizedModelProvider =
      (explicitProvider && providerCandidates.includes(explicitProvider)
        ? explicitProvider
        : "") ||
      (parsedRawModel && providerCandidates.includes(parsedRawModel.provider)
        ? parsedRawModel.provider
        : "") ||
      getDefaultSkillRunnerModelProvider(normalizedEngine, backendContext) ||
      "";

    let normalizedModel = "";
    if (isOpencodeEngine(normalizedEngine)) {
      const normalizedCombined = normalizeSkillRunnerModel(
        normalizedEngine,
        rawModelText,
        backendContext,
      );
      if (normalizedCombined) {
        normalizedModel = normalizedCombined;
        const parsedCombined = splitSkillRunnerModelId(normalizedCombined);
        if (parsedCombined) {
          normalizedModelProvider = parsedCombined.provider;
        }
      } else if (normalizedModelProvider) {
        const rawModelName = parsedRawModel ? parsedRawModel.model : rawModelText;
        const allowedModels = listSkillRunnerModelOptionsForProvider(
          normalizedEngine,
          normalizedModelProvider,
          backendContext,
        ).map((entry) => entry.value);
        if (rawModelName && allowedModels.includes(rawModelName)) {
          const combinedModel = `${normalizedModelProvider}/${rawModelName}`;
          normalizedModel = normalizeSkillRunnerModel(
            normalizedEngine,
            combinedModel,
            backendContext,
          );
        }
      }
    } else {
      normalizedModel = normalizeSkillRunnerModel(
        normalizedEngine,
        rawModel,
        backendContext,
      );
    }

    const normalizedNoCache = normalizeNoCache(rawNoCache);
    const normalizedInteractiveAutoReply = normalizeBooleanOption(
      rawInteractiveAutoReply,
    );
    const normalizedHardTimeout = normalizePositiveInteger(rawHardTimeoutSeconds);
    if (typeof rawNoCache === "boolean") {
      return {
        engine: normalizedEngine,
        model_provider: normalizedModelProvider,
        model: normalizedModel,
        no_cache: normalizedNoCache,
        interactive_auto_reply: normalizedInteractiveAutoReply,
        ...(typeof normalizedHardTimeout === "number"
          ? { hard_timeout_seconds: normalizedHardTimeout }
          : {}),
      };
    }
    if (typeof rawNoCache === "string") {
      return {
        engine: normalizedEngine,
        model_provider: normalizedModelProvider,
        model: normalizedModel,
        no_cache: normalizedNoCache,
        interactive_auto_reply: normalizedInteractiveAutoReply,
        ...(typeof normalizedHardTimeout === "number"
          ? { hard_timeout_seconds: normalizedHardTimeout }
          : {}),
      };
    }
    return {
      engine: normalizedEngine,
      model_provider: normalizedModelProvider,
      model: normalizedModel,
      no_cache: normalizedNoCache,
      interactive_auto_reply: normalizedInteractiveAutoReply,
      ...(typeof normalizedHardTimeout === "number"
        ? { hard_timeout_seconds: normalizedHardTimeout }
        : {}),
    };
  }

  private resolveBackend(args: {
    backend?: BackendInstance;
  }) {
    if (args.backend) {
      return args.backend;
    }
    if (this.staticClient) {
      return null;
    }
    throw new Error(
      "SkillRunnerProvider requires backend config when baseUrl is not provided in constructor",
    );
  }

  async execute(args: {
    requestKind: string;
    request: unknown;
    backend?: BackendInstance;
    providerOptions?: Record<string, unknown>;
    onProgress?: (event: ProviderProgressEvent) => void;
  }): Promise<ProviderExecutionResult> {
    const backend = this.resolveBackend(args);
    if (backend && !this.supports({ requestKind: args.requestKind, backend })) {
      throw new Error(
        `Unsupported request kind/backend for SkillRunner: requestKind=${args.requestKind}, backendType=${backend.type}`,
      );
    }
    if (!backend && !this.supportsRequestKind(args.requestKind)) {
      throw new Error(
        `Unsupported request kind for SkillRunner: ${args.requestKind}`,
      );
    }
    const normalizedProviderOptions = this.normalizeRuntimeOptions(
      args.providerOptions || {},
      backend || undefined,
    );
    const backendId = backend?.id;
    const backendType = backend?.type || "skillrunner";
    if (backend && backend.type === "skillrunner") {
      const ensureResult = await ensureManagedLocalRuntimeForBackend(backend.id);
      if (!ensureResult.ok) {
        throw new Error(
          `managed local runtime ensure failed: ${ensureResult.message}`,
        );
      }
    }
    appendRuntimeLog({
      level: "info",
      scope: "provider",
      backendId,
      backendType,
      providerId: this.id,
      component: "skillrunner-provider",
      operation: "execute",
      phase: "start",
      stage: "provider-execute-start",
      message: "skillrunner provider execute started",
      details: {
        requestKind: args.requestKind,
        engine: normalizedProviderOptions.engine,
        model: normalizedProviderOptions.model,
      },
    });
    const client =
      this.staticClient || new SkillRunnerClient({ baseUrl: backend!.baseUrl });
    try {
      let result: ProviderExecutionResult;
      if (
        args.request &&
        typeof args.request === "object" &&
        (args.request as { kind?: unknown }).kind === "http.steps"
      ) {
        result = await client.executeHttpSteps(
          args.request as SkillRunnerHttpStepsRequest,
          {
            onProgress: args.onProgress,
          },
        );
      } else {
        const request = args.request as SkillRunnerJobRequestV1;
        if (request.kind !== "skillrunner.job.v1") {
          throw new Error(
            `Unsupported skillrunner request payload kind: ${String(request.kind || "")}`,
          );
        }
        result = await client.executeSkillRunnerJob(
          request,
          normalizedProviderOptions,
          {
            onProgress: args.onProgress,
          },
        );
      }
      appendRuntimeLog({
        level: "info",
        scope: "provider",
        backendId,
        backendType,
        providerId: this.id,
        requestId: String(result.requestId || "").trim() || undefined,
        component: "skillrunner-provider",
        operation: "execute",
        phase: result.status === "deferred" ? "deferred" : "terminal",
        stage: "provider-execute-succeeded",
        message: "skillrunner provider execute succeeded",
        details: {
          status: result.status,
          fetchType: result.fetchType,
          backendStatus: (result as { backendStatus?: unknown }).backendStatus,
        },
      });
      return result;
    } catch (error) {
      appendRuntimeLog({
        level: "error",
        scope: "provider",
        backendId,
        backendType,
        providerId: this.id,
        component: "skillrunner-provider",
        operation: "execute",
        phase: "terminal",
        stage: "provider-execute-failed",
        message: "skillrunner provider execute failed",
        error,
      });
      throw error;
    }
  }
}
