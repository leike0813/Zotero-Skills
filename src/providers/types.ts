import type { BackendInstance } from "../backends/types";
import type { ProviderExecutionResult } from "./contracts";

export type ProviderSupportsArgs = {
  requestKind: string;
  backend: BackendInstance;
};

export type ProviderExecuteArgs = {
  requestKind: string;
  request: unknown;
  backend: BackendInstance;
  providerOptions?: Record<string, unknown>;
};

export type ProviderRuntimeOptionType = "string" | "number" | "boolean";

export type ProviderRuntimeOptionSchemaEntry = {
  type: ProviderRuntimeOptionType;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
};

export type ProviderRuntimeOptionSchema = Record<
  string,
  ProviderRuntimeOptionSchemaEntry
>;

export type Provider = {
  id: string;
  supports: (args: ProviderSupportsArgs) => boolean;
  execute: (args: ProviderExecuteArgs) => Promise<ProviderExecutionResult>;
  getRuntimeOptionSchema?: () => ProviderRuntimeOptionSchema;
  getRuntimeOptionEnumValues?: (args: {
    key: string;
    options: Record<string, unknown>;
  }) => string[];
  normalizeRuntimeOptions?: (
    options: unknown,
  ) => Record<string, unknown>;
};
