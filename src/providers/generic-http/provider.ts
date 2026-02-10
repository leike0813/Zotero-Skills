import type {
  GenericHttpRequestV1,
  ProviderExecutionResult,
} from "../contracts";
import type { Provider, ProviderSupportsArgs } from "../types";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function ensureLeadingSlash(input: string) {
  return input.startsWith("/") ? input : `/${input}`;
}

function buildUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${ensureLeadingSlash(path)}`;
}

async function readResponse(response: Response) {
  const text = await response.text();
  let parsed: unknown = {};
  if (text.trim().length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }
  if (!response.ok) {
    throw new Error(
      `Generic HTTP request failed: HTTP ${response.status} ${response.statusText} ${JSON.stringify(parsed)}`,
    );
  }
  return parsed;
}

function resolveFetchImpl() {
  const runtime = globalThis as { fetch?: FetchLike };
  if (typeof runtime.fetch !== "function") {
    throw new Error("fetch() is unavailable in current runtime");
  }
  return runtime.fetch.bind(globalThis);
}

export class GenericHttpProvider implements Provider {
  readonly id = "generic-http";

  private readonly fetchImpl: FetchLike;

  constructor(args?: { fetchImpl?: FetchLike }) {
    this.fetchImpl = args?.fetchImpl || resolveFetchImpl();
  }

  getRuntimeOptionSchema() {
    return {};
  }

  normalizeRuntimeOptions() {
    return {};
  }

  supports(args: ProviderSupportsArgs) {
    return (
      args.backend.type === "generic-http" &&
      args.requestKind === "generic-http.request.v1"
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
        `Unsupported request kind/backend for GenericHttpProvider: requestKind=${args.requestKind}, backendType=${args.backend.type}`,
      );
    }
    const request = args.request as GenericHttpRequestV1;
    if (!request?.request?.method || !request?.request?.path) {
      throw new Error(
        "Invalid generic-http request payload: request.method and request.path are required",
      );
    }

    const response = await this.fetchImpl(
      buildUrl(args.backend.baseUrl, request.request.path),
      {
        method: request.request.method,
        headers: {
          "content-type": "application/json",
          ...(request.request.headers || {}),
        },
        ...(typeof request.request.json !== "undefined"
          ? { body: JSON.stringify(request.request.json) }
          : {}),
      },
    );
    const resultJson = await readResponse(response);
    let requestId = `generic-http-${Date.now().toString(36)}`;
    if (
      resultJson &&
      typeof resultJson === "object" &&
      typeof (resultJson as { request_id?: unknown }).request_id === "string"
    ) {
      requestId = (resultJson as { request_id: string }).request_id;
    }

    return {
      status: "succeeded",
      requestId,
      fetchType: "result",
      resultJson,
      responseJson: resultJson,
    };
  }
}
