export type BackendInstance = {
  id: string;
  type: string;
  baseUrl: string;
  auth?: {
    kind?: "none" | "bearer";
    token?: string;
  };
  defaults?: {
    headers?: Record<string, string>;
    timeout_ms?: number;
  };
};

export type LoadedBackends = {
  sourcePath: string;
  backends: BackendInstance[];
  warnings: string[];
  errors: string[];
  invalidBackends: Record<string, string>;
  fatalError?: string;
};
