import type { ProviderExecutionResult, AcpPromptRequestV1 } from "../contracts";
import type { Provider, ProviderSupportsArgs } from "../types";
import {
  ACP_BACKEND_TYPE,
  ACP_PROMPT_REQUEST_KIND,
} from "../../config/defaults";
import { appendRuntimeLog } from "../../modules/runtimeLogManager";

export class AcpProvider implements Provider {
  readonly id = ACP_BACKEND_TYPE;

  getRuntimeOptionSchema() {
    return {};
  }

  normalizeRuntimeOptions() {
    return {};
  }

  supports(args: ProviderSupportsArgs) {
    return (
      String(args.backend.type || "").trim() === ACP_BACKEND_TYPE &&
      String(args.requestKind || "").trim() === ACP_PROMPT_REQUEST_KIND
    );
  }

  async execute(args: {
    requestKind: string;
    request: unknown;
    backend: import("../../backends/types").BackendInstance;
    providerOptions?: Record<string, unknown>;
  }): Promise<ProviderExecutionResult> {
    if (!this.supports(args)) {
      throw new Error(
        `Unsupported request kind/backend for AcpProvider: requestKind=${args.requestKind}, backendType=${args.backend.type}`,
      );
    }
    const request = args.request as AcpPromptRequestV1;
    const requestId = `acp-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    appendRuntimeLog({
      level: "info",
      scope: "provider",
      backendId: args.backend.id,
      backendType: args.backend.type,
      providerId: this.id,
      requestId,
      component: "acp-provider",
      operation: "execute",
      phase: "terminal",
      stage: "provider-acp-dispatch-stubbed",
      message: "ACP provider routed prompt contract to phase-1 global chat surface",
      details: {
        requestKind: args.requestKind,
        hasHostContext: !!request.hostContext,
      },
    });
    return {
      status: "succeeded",
      requestId,
      fetchType: "result",
      resultJson: {
        kind: ACP_PROMPT_REQUEST_KIND,
        message: request.message,
        hostContext: request.hostContext || {},
        phase: "sidebar-global-chat",
      },
      responseJson: {
        kind: ACP_PROMPT_REQUEST_KIND,
        phase: "sidebar-global-chat",
      },
    };
  }
}
