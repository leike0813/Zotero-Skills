import { resolveBackendForWorkflow, listBackendsForProvider } from "../backends/registry";
import type { BackendInstance } from "../backends/types";
import { resolveProviderById, normalizeProviderRuntimeOptions } from "../providers/registry";
import type { WorkflowManifest, LoadedWorkflow } from "../workflows/types";
import { getPref, setPref } from "../utils/prefs";
import { resolveWorkflowRequestKind } from "./workflowRequestKind";
import {
  DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE,
  PASS_THROUGH_BACKEND_TYPE,
} from "../config/defaults";

const WORKFLOW_SETTINGS_PREF_KEY = "workflowSettingsJson";
const DEFAULT_REFERENCE_MATCHING_CITEKEY_TEMPLATE = "{author}_{title}_{year}";
const REFERENCE_MATCHING_WORKFLOW_ID = "reference-matching";
const REFERENCE_MATCHING_CITEKEY_TEMPLATE_KEY = "citekey_template";
const SUPPORTED_LEGACY_REFERENCE_MATCHING_TOKENS = new Set([
  "author",
  "year",
  "title",
]);
const BBT_LITE_ALLOWED_OBJECTS = new Set(["auth", "year", "title"]);
const BBT_LITE_METHOD_SPECS: Record<
  string,
  Record<string, { minArgs: number; maxArgs: number }>
> = {
  auth: {
    lower: { minArgs: 0, maxArgs: 0 },
    upper: { minArgs: 0, maxArgs: 0 },
    nopunct: { minArgs: 0, maxArgs: 0 },
    skipwords: { minArgs: 0, maxArgs: 0 },
    select: { minArgs: 1, maxArgs: 2 },
    prefix: { minArgs: 1, maxArgs: 1 },
    postfix: { minArgs: 1, maxArgs: 1 },
    initials: { minArgs: 0, maxArgs: 0 },
    trim: { minArgs: 0, maxArgs: 0 },
    replace: { minArgs: 2, maxArgs: 2 },
    clean: { minArgs: 0, maxArgs: 0 },
    short: { minArgs: 0, maxArgs: 0 },
    abbr: { minArgs: 0, maxArgs: 0 },
  },
  title: {
    lower: { minArgs: 0, maxArgs: 0 },
    upper: { minArgs: 0, maxArgs: 0 },
    nopunct: { minArgs: 0, maxArgs: 0 },
    skipwords: { minArgs: 0, maxArgs: 0 },
    select: { minArgs: 1, maxArgs: 2 },
    prefix: { minArgs: 1, maxArgs: 1 },
    postfix: { minArgs: 1, maxArgs: 1 },
    initials: { minArgs: 0, maxArgs: 0 },
    trim: { minArgs: 0, maxArgs: 0 },
    replace: { minArgs: 2, maxArgs: 2 },
    clean: { minArgs: 0, maxArgs: 0 },
    short: { minArgs: 0, maxArgs: 0 },
    abbr: { minArgs: 0, maxArgs: 0 },
  },
  year: {
    lower: { minArgs: 0, maxArgs: 0 },
    upper: { minArgs: 0, maxArgs: 0 },
    nopunct: { minArgs: 0, maxArgs: 0 },
    select: { minArgs: 1, maxArgs: 2 },
    prefix: { minArgs: 1, maxArgs: 1 },
    postfix: { minArgs: 1, maxArgs: 1 },
    trim: { minArgs: 0, maxArgs: 0 },
    replace: { minArgs: 2, maxArgs: 2 },
  },
};

export type WorkflowExecutionOptions = {
  backendId?: string;
  workflowParams?: Record<string, unknown>;
  providerOptions?: Record<string, unknown>;
};

export type WorkflowSettingsRecord = Record<string, WorkflowExecutionOptions>;

type WorkflowExecutionContext = {
  backend: BackendInstance;
  requestKind: string;
  workflowParams: Record<string, unknown>;
  providerOptions: Record<string, unknown>;
  providerId: string;
};

const runOnceOverrides = new Map<string, WorkflowExecutionOptions>();

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseSettingsRecord(raw: unknown): WorkflowSettingsRecord {
  if (!isObject(raw)) {
    return {};
  }
  const normalized: WorkflowSettingsRecord = {};
  for (const [workflowId, value] of Object.entries(raw)) {
    if (!isObject(value)) {
      continue;
    }
    normalized[workflowId] = {
      backendId:
        typeof value.backendId === "string" ? value.backendId.trim() : undefined,
      workflowParams: isObject(value.workflowParams)
        ? { ...value.workflowParams }
        : {},
      providerOptions: isObject(value.providerOptions)
        ? { ...value.providerOptions }
        : {},
    };
  }
  return normalized;
}

function readSettingsRecord(): WorkflowSettingsRecord {
  const rawText = String(getPref(WORKFLOW_SETTINGS_PREF_KEY) || "").trim();
  if (!rawText) {
    return {};
  }
  try {
    return parseSettingsRecord(JSON.parse(rawText));
  } catch {
    return {};
  }
}

function writeSettingsRecord(record: WorkflowSettingsRecord) {
  setPref(WORKFLOW_SETTINGS_PREF_KEY, JSON.stringify(record));
}

function coerceBySchemaType(type: string, value: unknown) {
  if (type === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return ["1", "true", "yes", "on"].includes(value.toLowerCase());
    }
    return undefined;
  }
  if (type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }
  if (type === "string") {
    if (typeof value === "string") {
      return value;
    }
    return undefined;
  }
  return undefined;
}

function normalizeWorkflowParamsBySchema(
  manifest: WorkflowManifest,
  source: unknown,
) {
  const schemas = manifest.parameters || {};
  const schemaEntries = Object.entries(schemas);
  const input = isObject(source) ? source : {};
  if (schemaEntries.length === 0) {
    return { ...input };
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, schema] of schemaEntries) {
    const hasExplicitInput = typeof input[key] !== "undefined";
    const pickValidValue = (value: unknown) => {
      const coerced = coerceBySchemaType(schema.type, value);
      if (typeof coerced === "undefined") {
        return undefined;
      }
      if (Array.isArray(schema.enum) && schema.enum.length > 0) {
        if (!schema.enum.some((candidate) => candidate === coerced)) {
          return undefined;
        }
      }
      if (
        schema.type === "number" &&
        typeof coerced === "number" &&
        typeof schema.min === "number" &&
        coerced < schema.min
      ) {
        return undefined;
      }
      if (
        schema.type === "number" &&
        typeof coerced === "number" &&
        typeof schema.max === "number" &&
        coerced > schema.max
      ) {
        return undefined;
      }
      return coerced;
    };

    let coerced = pickValidValue(hasExplicitInput ? input[key] : schema.default);
    if (typeof coerced === "undefined" && hasExplicitInput) {
      coerced = pickValidValue(schema.default);
    }
    if (typeof coerced === "undefined") {
      continue;
    }
    normalized[key] = coerced;
  }

  if (manifest.id === REFERENCE_MATCHING_WORKFLOW_ID) {
    const schemaDefault = String(
      schemas.citekey_template?.default || DEFAULT_REFERENCE_MATCHING_CITEKEY_TEMPLATE,
    ).trim();
    const fallbackTemplate = isValidReferenceMatchingCitekeyTemplate(schemaDefault)
      ? schemaDefault
      : DEFAULT_REFERENCE_MATCHING_CITEKEY_TEMPLATE;
    const candidate = String(normalized.citekey_template || "").trim();
    normalized.citekey_template = isValidReferenceMatchingCitekeyTemplate(candidate)
      ? candidate
      : fallbackTemplate;
  }

  return normalized;
}

function isValidReferenceMatchingCitekeyTemplate(template: string) {
  return (
    isValidReferenceMatchingLegacyTemplate(template) ||
    isValidReferenceMatchingBbtLiteTemplate(template)
  );
}

function isValidReferenceMatchingLegacyTemplate(template: string) {
  const text = String(template || "");
  if (!text.trim()) {
    return false;
  }
  if (!text.includes("{")) {
    return false;
  }
  const openBraces = (text.match(/\{/g) || []).length;
  const closeBraces = (text.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    return false;
  }
  for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
    const token = String(match[1] || "").trim().toLowerCase();
    if (!SUPPORTED_LEGACY_REFERENCE_MATCHING_TOKENS.has(token)) {
      return false;
    }
  }
  const stripped = text.replace(/\{[^{}]+\}/g, "");
  return !/[{}]/.test(stripped);
}

type BbtLiteToken = {
  type: string;
  value: number | string;
};

type BbtLiteMethod = {
  name: string;
  args: Array<number | string>;
};

type BbtLiteTerm =
  | { type: "literal"; value: string }
  | { type: "chain"; object: string; methods: BbtLiteMethod[] };

type BbtLiteAst = {
  terms: BbtLiteTerm[];
};

function tokenizeReferenceMatchingBbtLiteTemplate(
  template: string,
): BbtLiteToken[] | null {
  const text = String(template || "");
  const tokens: BbtLiteToken[] = [];
  let index = 0;
  while (index < text.length) {
    const ch = text[index];
    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }
    if (ch === "+" || ch === "." || ch === "," || ch === "(" || ch === ")") {
      tokens.push({ type: ch, value: ch });
      index += 1;
      continue;
    }
    if (ch === "'") {
      let cursor = index + 1;
      let literal = "";
      let closed = false;
      while (cursor < text.length) {
        const current = text[cursor];
        if (current === "\\") {
          const next = text[cursor + 1];
          if (typeof next === "string") {
            literal += next;
            cursor += 2;
            continue;
          }
          return null;
        }
        if (current === "'") {
          closed = true;
          cursor += 1;
          break;
        }
        literal += current;
        cursor += 1;
      }
      if (!closed) {
        return null;
      }
      tokens.push({ type: "string", value: literal });
      index = cursor;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let cursor = index + 1;
      while (cursor < text.length && /[0-9]/.test(text[cursor])) {
        cursor += 1;
      }
      tokens.push({
        type: "number",
        value: Number(text.slice(index, cursor)),
      });
      index = cursor;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let cursor = index + 1;
      while (cursor < text.length && /[A-Za-z0-9_]/.test(text[cursor])) {
        cursor += 1;
      }
      tokens.push({
        type: "identifier",
        value: text.slice(index, cursor),
      });
      index = cursor;
      continue;
    }
    return null;
  }
  return tokens;
}

function parseReferenceMatchingBbtLiteTemplate(template: string): BbtLiteAst | null {
  const tokens = tokenizeReferenceMatchingBbtLiteTemplate(template);
  if (!tokens || tokens.length === 0) {
    return null;
  }
  let cursor = 0;
  const consume = (type: string) => {
    if (tokens[cursor]?.type === type) {
      const consumed = tokens[cursor];
      cursor += 1;
      return consumed;
    }
    return null;
  };
  const peek = () => tokens[cursor];
  const parseArg = () => {
    const token = peek();
    if (!token) {
      return null;
    }
    if (token.type === "number" || token.type === "string") {
      cursor += 1;
      return token.value;
    }
    return null;
  };
  const parseChain = (): BbtLiteTerm | null => {
    const objectToken = consume("identifier");
    if (!objectToken) {
      return null;
    }
    const chain: BbtLiteTerm = {
      type: "chain",
      object: String(objectToken.value || "").toLowerCase(),
      methods: [],
    };
    while (consume(".")) {
      const methodToken = consume("identifier");
      if (!methodToken || chain.type !== "chain") {
        return null;
      }
      const method: BbtLiteMethod = {
        name: String(methodToken.value || "").toLowerCase(),
        args: [],
      };
      if (consume("(")) {
        if (!consume(")")) {
          const firstArg = parseArg();
          if (firstArg === null) {
            return null;
          }
          method.args.push(firstArg);
          while (consume(",")) {
            const nextArg = parseArg();
            if (nextArg === null) {
              return null;
            }
            method.args.push(nextArg);
          }
          if (!consume(")")) {
            return null;
          }
        }
      }
      chain.methods.push(method);
    }
    return chain;
  };
  const parseTerm = (): BbtLiteTerm | null => {
    const literalToken = consume("string");
    if (literalToken) {
      return {
        type: "literal",
        value: String(literalToken.value || ""),
      };
    }
    return parseChain();
  };

  const terms: BbtLiteTerm[] = [];
  const first = parseTerm();
  if (!first) {
    return null;
  }
  terms.push(first);
  while (consume("+")) {
    const next = parseTerm();
    if (!next) {
      return null;
    }
    terms.push(next);
  }
  if (cursor !== tokens.length) {
    return null;
  }
  return { terms };
}

function isValidReferenceMatchingBbtLiteTemplate(template: string) {
  const text = String(template || "").trim();
  if (!text || /[{}]/.test(text)) {
    return false;
  }
  const ast = parseReferenceMatchingBbtLiteTemplate(text);
  if (!ast || ast.terms.length === 0) {
    return false;
  }
  for (const term of ast.terms) {
    if (term.type === "literal") {
      continue;
    }
    if (!BBT_LITE_ALLOWED_OBJECTS.has(term.object)) {
      return false;
    }
    const methodSpecs = BBT_LITE_METHOD_SPECS[term.object] || {};
    for (const method of term.methods) {
      const spec = methodSpecs[method.name];
      if (!spec) {
        return false;
      }
      const count = method.args.length;
      if (count < spec.minArgs || count > spec.maxArgs) {
        return false;
      }
    }
  }
  return true;
}

function resolveReferenceMatchingTemplateFallback(
  value: unknown,
) {
  const candidate = String(value || "").trim();
  if (isValidReferenceMatchingCitekeyTemplate(candidate)) {
    return candidate;
  }
  return DEFAULT_REFERENCE_MATCHING_CITEKEY_TEMPLATE;
}

function hasOwnWorkflowParam(
  options: WorkflowExecutionOptions | undefined,
  key: string,
) {
  return isObject(options?.workflowParams) &&
    Object.prototype.hasOwnProperty.call(options.workflowParams, key);
}

function normalizeReferenceMatchingSavedSettings(args: {
  previous: WorkflowExecutionOptions | undefined;
  merged: WorkflowExecutionOptions;
  incoming: WorkflowExecutionOptions;
}) {
  const fallbackTemplate = resolveReferenceMatchingTemplateFallback(
    args.previous?.workflowParams?.[REFERENCE_MATCHING_CITEKEY_TEMPLATE_KEY],
  );
  const nextParams = {
    ...(args.merged.workflowParams || {}),
  };
  const candidate = String(
    nextParams[REFERENCE_MATCHING_CITEKEY_TEMPLATE_KEY] || "",
  ).trim();
  const incomingHasTemplate = hasOwnWorkflowParam(
    args.incoming,
    REFERENCE_MATCHING_CITEKEY_TEMPLATE_KEY,
  );
  if (incomingHasTemplate) {
    nextParams[REFERENCE_MATCHING_CITEKEY_TEMPLATE_KEY] =
      isValidReferenceMatchingCitekeyTemplate(candidate)
        ? candidate
        : fallbackTemplate;
  } else if (!isValidReferenceMatchingCitekeyTemplate(candidate)) {
    nextParams[REFERENCE_MATCHING_CITEKEY_TEMPLATE_KEY] = fallbackTemplate;
  }
  return {
    ...args.merged,
    workflowParams: nextParams,
  };
}

function resolveProviderId(workflow: LoadedWorkflow) {
  const providerId = String(workflow.manifest.provider || "").trim();
  if (!providerId) {
    const requestKind = String(workflow.manifest.request?.kind || "").trim();
    for (const [backendType, knownRequestKind] of Object.entries(
      DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE,
    )) {
      if (knownRequestKind === requestKind) {
        return backendType;
      }
    }
    throw new Error(
      `Workflow ${workflow.manifest.id} does not declare provider`,
    );
  }
  return providerId;
}

function mergeExecutionOptions(
  base: WorkflowExecutionOptions | undefined,
  override: WorkflowExecutionOptions | undefined,
): WorkflowExecutionOptions {
  return {
    backendId: String(override?.backendId || base?.backendId || "").trim() || undefined,
    workflowParams: {
      ...(base?.workflowParams || {}),
      ...(override?.workflowParams || {}),
    },
    providerOptions: {
      ...(base?.providerOptions || {}),
      ...(override?.providerOptions || {}),
    },
  };
}

function buildLocalBackendForProvider(providerId: string): BackendInstance {
  const normalizedProvider = String(providerId || "").trim();
  const backendType = normalizedProvider || PASS_THROUGH_BACKEND_TYPE;
  return {
    id: `${backendType}-local`,
    type: backendType,
    baseUrl: `local://${backendType}`,
    auth: {
      kind: "none",
    },
  };
}

export function getWorkflowSettings(workflowId: string): WorkflowExecutionOptions {
  const record = readSettingsRecord();
  return record[String(workflowId || "").trim()] || {};
}

export function updateWorkflowSettings(
  workflowId: string,
  next: WorkflowExecutionOptions,
) {
  const normalizedWorkflowId = String(workflowId || "").trim();
  if (!normalizedWorkflowId) {
    throw new Error("workflowId is required");
  }
  const record = readSettingsRecord();
  const previous = record[normalizedWorkflowId];
  let merged = mergeExecutionOptions(
    record[normalizedWorkflowId],
    next,
  );
  if (normalizedWorkflowId === REFERENCE_MATCHING_WORKFLOW_ID) {
    merged = normalizeReferenceMatchingSavedSettings({
      previous,
      merged,
      incoming: next,
    });
  }
  record[normalizedWorkflowId] = merged;
  writeSettingsRecord(record);
}

export function clearWorkflowSettings(workflowId: string) {
  const normalizedWorkflowId = String(workflowId || "").trim();
  if (!normalizedWorkflowId) {
    return;
  }
  const record = readSettingsRecord();
  delete record[normalizedWorkflowId];
  writeSettingsRecord(record);
}

export function listWorkflowSettingsRecord() {
  return readSettingsRecord();
}

export function setRunOnceWorkflowOverrides(
  workflowId: string,
  overrides: WorkflowExecutionOptions,
) {
  const normalizedWorkflowId = String(workflowId || "").trim();
  if (!normalizedWorkflowId) {
    throw new Error("workflowId is required");
  }
  runOnceOverrides.set(
    normalizedWorkflowId,
    mergeExecutionOptions(runOnceOverrides.get(normalizedWorkflowId), overrides),
  );
}

export function clearRunOnceWorkflowOverrides(workflowId: string) {
  runOnceOverrides.delete(String(workflowId || "").trim());
}

export function resetRunOnceOverridesForSettingsOpen(
  workflowId: string,
): WorkflowExecutionOptions {
  const normalizedWorkflowId = String(workflowId || "").trim();
  if (!normalizedWorkflowId) {
    throw new Error("workflowId is required");
  }
  clearRunOnceWorkflowOverrides(normalizedWorkflowId);
  return getWorkflowSettings(normalizedWorkflowId);
}

function getRunOnceWorkflowOverrides(args: {
  workflowId: string;
  consume: boolean;
}) {
  const key = String(args.workflowId || "").trim();
  if (!key) {
    return {};
  }
  const found = runOnceOverrides.get(key) || {};
  if (args.consume) {
    runOnceOverrides.delete(key);
  }
  return found;
}

export async function listProviderProfilesForWorkflow(workflow: LoadedWorkflow) {
  const providerId = resolveProviderId(workflow);
  return listBackendsForProvider(providerId);
}

export async function resolveWorkflowExecutionContext(args: {
  workflow: LoadedWorkflow;
  consumeRunOnce?: boolean;
}): Promise<WorkflowExecutionContext> {
  const providerId = resolveProviderId(args.workflow);
  const provider = resolveProviderById(providerId);
  const saved = getWorkflowSettings(args.workflow.manifest.id);
  const runOnce = getRunOnceWorkflowOverrides({
    workflowId: args.workflow.manifest.id,
    consume: args.consumeRunOnce === true,
  });
  const merged = mergeExecutionOptions(saved, runOnce);

  const backend = provider.requiresBackendProfile === false
    ? buildLocalBackendForProvider(provider.id)
    : await resolveBackendForWorkflow(args.workflow, {
        preferredBackendId: merged.backendId,
      });
  const requestKind = resolveWorkflowRequestKind(args.workflow, backend.type);
  const workflowParams = normalizeWorkflowParamsBySchema(
    args.workflow.manifest,
    merged.workflowParams,
  );
  const providerOptions = normalizeProviderRuntimeOptions({
    providerId: provider.id,
    options: merged.providerOptions,
  });

  return {
    backend,
    requestKind,
    workflowParams,
    providerOptions,
    providerId,
  };
}
