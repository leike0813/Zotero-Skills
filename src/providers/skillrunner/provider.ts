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
import type { Provider, ProviderSupportsArgs } from "../types";
import {
  getDefaultSkillRunnerEngine,
  listSkillRunnerEngines,
  listSkillRunnerModelOptions,
  normalizeSkillRunnerModel,
} from "./modelCatalog";
import { SkillRunnerClient } from "./client";

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
    return {
      engine: {
        type: "string" as const,
        title: "Engine",
        description: "Skill-Runner execution engine.",
        default: defaultEngine,
        enum: listSkillRunnerEngines(),
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
    };
  }

  getRuntimeOptionEnumValues(args: {
    key: string;
    options: Record<string, unknown>;
  }) {
    if (args.key === "engine") {
      return listSkillRunnerEngines();
    }
    if (args.key === "model") {
      const rawEngine = args.options.engine;
      const normalizedEngine =
        typeof rawEngine === "string" && rawEngine.trim()
          ? rawEngine.trim()
          : getDefaultSkillRunnerEngine();
      return listSkillRunnerModelOptions(normalizedEngine).map(
        (entry) => entry.value,
      );
    }
    return [];
  }

  normalizeRuntimeOptions(options: unknown) {
    const source =
      options && typeof options === "object" && !Array.isArray(options)
        ? (options as Record<string, unknown>)
        : {};
    const rawEngine = source.engine;
    const rawModel = source.model;
    const raw = source.no_cache;
    const normalizedEngine =
      typeof rawEngine === "string" && rawEngine.trim()
        ? rawEngine.trim()
        : getDefaultSkillRunnerEngine() || "gemini";
    const normalizedModel = normalizeSkillRunnerModel(
      normalizedEngine,
      rawModel,
    );
    if (typeof raw === "boolean") {
      return {
        engine: normalizedEngine,
        model: normalizedModel,
        no_cache: raw,
      };
    }
    if (typeof raw === "string") {
      return {
        engine: normalizedEngine,
        model: normalizedModel,
        no_cache: ["1", "true", "yes", "on"].includes(raw.toLowerCase()),
      };
    }
    return {
      engine: normalizedEngine,
      model: normalizedModel,
      no_cache: false,
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
    );
    const client =
      this.staticClient || new SkillRunnerClient({ baseUrl: backend!.baseUrl });
    if (
      args.request &&
      typeof args.request === "object" &&
      (args.request as { kind?: unknown }).kind === "http.steps"
    ) {
      return client.executeHttpSteps(args.request as SkillRunnerHttpStepsRequest);
    }
    const request = args.request as SkillRunnerJobRequestV1;
    if (request.kind !== "skillrunner.job.v1") {
      throw new Error(
        `Unsupported skillrunner request payload kind: ${String(request.kind || "")}`,
      );
    }
    return client.executeSkillRunnerJob(request, normalizedProviderOptions);
  }
}
