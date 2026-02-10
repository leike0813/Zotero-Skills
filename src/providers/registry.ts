import type { BackendInstance } from "../backends/types";
import type { ProviderExecutionResult } from "./contracts";
import { GenericHttpProvider } from "./generic-http/provider";
import { SkillRunnerProvider } from "./skillrunner/provider";
import type { Provider } from "./types";

const providers: Provider[] = [new SkillRunnerProvider(), new GenericHttpProvider()];

export function registerProvider(provider: Provider) {
  const existingIndex = providers.findIndex((entry) => entry.id === provider.id);
  if (existingIndex >= 0) {
    providers.splice(existingIndex, 1, provider);
    return;
  }
  providers.push(provider);
}

export function listProviders() {
  return [...providers];
}

export function resolveProviderById(id: string) {
  const target = String(id || "").trim();
  const matched = providers.find((provider) => provider.id === target);
  if (!matched) {
    throw new Error(`Unknown provider: ${target}`);
  }
  return matched;
}

function normalizeWithSchema(
  rawOptions: unknown,
  schema: ReturnType<NonNullable<Provider["getRuntimeOptionSchema"]>>,
) {
  const source =
    rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)
      ? (rawOptions as Record<string, unknown>)
      : {};
  const normalized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(schema)) {
    const raw = source[key];
    const fallback = entry.default;
    if (entry.type === "boolean") {
      const value =
        typeof raw === "boolean"
          ? raw
          : typeof raw === "string"
            ? ["1", "true", "yes", "on"].includes(raw.toLowerCase())
            : typeof fallback === "boolean"
              ? fallback
              : false;
      normalized[key] = value;
      continue;
    }
    if (entry.type === "number") {
      const parsed =
        typeof raw === "number"
          ? raw
          : typeof raw === "string"
            ? Number(raw)
            : NaN;
      if (Number.isFinite(parsed)) {
        normalized[key] = parsed;
        continue;
      }
      if (typeof fallback === "number" && Number.isFinite(fallback)) {
        normalized[key] = fallback;
      }
      continue;
    }
    if (entry.type === "string") {
      if (typeof raw === "string") {
        normalized[key] = raw;
        continue;
      }
      if (typeof fallback === "string") {
        normalized[key] = fallback;
      }
    }
  }
  return normalized;
}

export function normalizeProviderRuntimeOptions(args: {
  providerId: string;
  options: unknown;
}) {
  const provider = resolveProviderById(args.providerId);
  if (typeof provider.normalizeRuntimeOptions === "function") {
    return provider.normalizeRuntimeOptions(args.options);
  }
  const schema = provider.getRuntimeOptionSchema?.() || {};
  return normalizeWithSchema(args.options, schema);
}

export function resolveProvider(args: {
  requestKind: string;
  backend: BackendInstance;
}) {
  const matched = providers.find((provider) => provider.supports(args));
  if (!matched) {
    throw new Error(
      `No provider found for requestKind "${args.requestKind}" with backend type "${args.backend.type}"`,
    );
  }
  return matched;
}

export async function executeWithProvider(args: {
  requestKind: string;
  request: unknown;
  backend: BackendInstance;
  providerOptions?: Record<string, unknown>;
}): Promise<ProviderExecutionResult> {
  const provider = resolveProvider(args);
  return provider.execute(args);
}
