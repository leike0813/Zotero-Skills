import type {
  ApplyResultHook,
  BuildRequestHook,
  FilterInputsHook,
  LoadedWorkflow,
  LoadedWorkflows,
  WorkflowHooksModule,
  WorkflowManifest,
} from "./types";
import { getBaseName, joinPath } from "../utils/path";
import {
  DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE,
  PASS_THROUGH_BACKEND_TYPE,
} from "../config/defaults";

type DynamicImport = (specifier: string) => Promise<any>;

const dynamicImport: DynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as DynamicImport;

function isZoteroRuntime() {
  const runtime = globalThis as {
    IOUtils?: unknown;
    PathUtils?: unknown;
    Services?: {
      io?: { newFileURI?: unknown };
      scriptloader?: { loadSubScript?: unknown };
    };
    Cc?: unknown;
    Ci?: unknown;
  };
  return (
    typeof runtime.IOUtils !== "undefined" &&
    typeof runtime.PathUtils !== "undefined" &&
    typeof runtime.Services?.io?.newFileURI === "function" &&
    typeof runtime.Services?.scriptloader?.loadSubScript === "function" &&
    typeof runtime.Cc !== "undefined" &&
    typeof runtime.Ci !== "undefined"
  );
}

async function readTextFile(filePath: string) {
  if (isZoteroRuntime()) {
    const io = (globalThis as { IOUtils: { readUTF8: (path: string) => Promise<string> } }).IOUtils;
    return io.readUTF8(filePath);
  }
  const fs = await dynamicImport("fs/promises");
  return fs.readFile(filePath, "utf8") as Promise<string>;
}

async function listDirectoryEntries(dirPath: string): Promise<string[]> {
  if (isZoteroRuntime()) {
    const io = (globalThis as { IOUtils: { getChildren: (path: string) => Promise<string[]> } }).IOUtils;
    const children = await io.getChildren(dirPath);
    return children.map((entryPath) => getBaseName(entryPath));
  }
  const fs = await dynamicImport("fs/promises");
  return fs.readdir(dirPath) as Promise<string[]>;
}

async function statPath(targetPath: string): Promise<{ isDirectory: boolean }> {
  if (isZoteroRuntime()) {
    const io = (globalThis as { IOUtils: { stat: (path: string) => Promise<{ type: string }> } }).IOUtils;
    const stat = await io.stat(targetPath);
    return { isDirectory: stat.type === "directory" };
  }
  const fs = await dynamicImport("fs/promises");
  const stat = await fs.stat(targetPath);
  return { isDirectory: stat.isDirectory() };
}

function transformModuleExports(source: string) {
  const names: string[] = [];
  const record = (name: string) => {
    if (!names.includes(name)) {
      names.push(name);
    }
    return name;
  };

  let code = source.replace(
    /export\s+async\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    (_, name: string) => `async function ${record(name)}(`,
  );
  code = code.replace(
    /export\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    (_, name: string) => `function ${record(name)}(`,
  );
  code = code.replace(
    /export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
    (_, decl: string, name: string) => `${decl} ${record(name)} =`,
  );

  if (names.length === 0) {
    throw new Error("No exported symbols found in hooks module");
  }
  return { code, names };
}

async function importHooksModuleFromText(filePath: string) {
  const source = await readTextFile(filePath);
  const transformed = transformModuleExports(source);
  const scriptText = `${transformed.code}\nthis.__zoteroSkillsHookExports = { ${transformed.names.join(", ")} };`;

  if (isZoteroRuntime()) {
    const runtime = globalThis as unknown as {
      IOUtils: {
        writeUTF8: (path: string, data: string) => Promise<void>;
        remove?: (path: string, options?: { ignoreAbsent?: boolean }) => Promise<void>;
      };
      PathUtils: { tempDir: string };
      Services: {
        io: { newFileURI: (file: unknown) => { spec: string } };
        scriptloader: {
          loadSubScript: (url: string, obj?: Record<string, unknown>) => void;
        };
      };
      Zotero: { File: { pathToFile: (path: string) => unknown } };
    };

    const tempScriptPath = joinPath(
      runtime.PathUtils.tempDir,
      `zotero-skills-hook-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.js`,
    );
    await runtime.IOUtils.writeUTF8(tempScriptPath, scriptText);
    const scope: Record<string, unknown> = {};
    try {
      const file = runtime.Zotero.File.pathToFile(tempScriptPath);
      const scriptUri = runtime.Services.io.newFileURI(file).spec;
      runtime.Services.scriptloader.loadSubScript(scriptUri, scope);
      const loaded = scope.__zoteroSkillsHookExports;
      if (!loaded || typeof loaded !== "object") {
        throw new Error("No hook exports loaded from script");
      }
      return loaded as Record<string, unknown>;
    } finally {
      if (runtime.IOUtils.remove) {
        await runtime.IOUtils.remove(tempScriptPath, {
          ignoreAbsent: true,
        });
      }
    }
  }

  const factory = new Function(
    `${scriptText}\nreturn this.__zoteroSkillsHookExports;`,
  ) as () => Record<string, unknown>;
  return factory();
}

async function loadHooksModule(filePath: string): Promise<Record<string, unknown>> {
  if (!isZoteroRuntime()) {
    try {
      const urlMod = await dynamicImport("url");
      const moduleUrl = urlMod.pathToFileURL(filePath).href;
      const loaded = (await dynamicImport(moduleUrl)) as Record<string, unknown>;
      if (
        typeof loaded.applyResult === "function" ||
        typeof loaded.filterInputs === "function" ||
        typeof loaded.buildRequest === "function"
      ) {
        return loaded;
      }
    } catch {
      // fall back to text-based loader
    }
    return importHooksModuleFromText(filePath);
  }

  try {
    const runtime = globalThis as unknown as {
      Services?: { io?: { newFileURI?: (file: unknown) => { spec: string } } };
      Zotero?: { File: { pathToFile: (path: string) => unknown } };
      ChromeUtils?: { importESModule?: (spec: string) => Record<string, unknown> };
    };
    const services = runtime.Services as
      | { io?: { newFileURI?: (file: unknown) => { spec: string } } }
      | undefined;
    const zoteroFile = runtime.Zotero?.File;
    if (!zoteroFile) {
      throw new Error("Zotero.File unavailable");
    }
    const file = zoteroFile.pathToFile(filePath);
    const uri = services?.io?.newFileURI?.(file)?.spec;
    const chromeUtils = runtime.ChromeUtils;
    if (uri && chromeUtils?.importESModule) {
      return chromeUtils.importESModule(uri);
    }
  } catch {
    // fall back to text-based loader
  }

  return importHooksModuleFromText(filePath);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidParameterSchema(
  value: unknown,
): value is import("./types").WorkflowParameterSchema {
  if (!isObject(value)) {
    return false;
  }
  const type = value.type;
  if (type !== "string" && type !== "number" && type !== "boolean") {
    return false;
  }
  if (
    typeof value.min !== "undefined" &&
    (typeof value.min !== "number" || !Number.isFinite(value.min))
  ) {
    return false;
  }
  if (
    typeof value.max !== "undefined" &&
    (typeof value.max !== "number" || !Number.isFinite(value.max))
  ) {
    return false;
  }
  if (
    typeof value.min === "number" &&
    typeof value.max === "number" &&
    value.min > value.max
  ) {
    return false;
  }
  if (
    typeof value.enum !== "undefined" &&
    (!Array.isArray(value.enum) || value.enum.length === 0)
  ) {
    return false;
  }
  return true;
}

function hasValidParameters(value: unknown) {
  if (typeof value === "undefined") {
    return true;
  }
  if (!isObject(value)) {
    return false;
  }
  for (const entry of Object.values(value)) {
    if (!isValidParameterSchema(entry)) {
      return false;
    }
  }
  return true;
}

function hasDeprecatedWorkflowFields(value: Record<string, unknown>) {
  if (typeof value.backend !== "undefined") {
    return true;
  }
  if (typeof value.defaults !== "undefined") {
    return true;
  }

  const request = value.request;
  if (!isObject(request)) {
    return false;
  }
  if (typeof request.result !== "undefined") {
    return true;
  }
  const create = request.create;
  if (!isObject(create)) {
    return false;
  }
  return (
    typeof create.engine !== "undefined" ||
    typeof create.parameter !== "undefined" ||
    typeof create.model !== "undefined" ||
    typeof create.runtime_options !== "undefined"
  );
}

function inferProviderFromRequestKind(kind: string) {
  const normalized = String(kind || "").trim();
  if (!normalized) {
    return "";
  }
  for (const [backendType, requestKind] of Object.entries(
    DEFAULT_REQUEST_KIND_BY_BACKEND_TYPE,
  )) {
    if (requestKind === normalized) {
      return backendType;
    }
  }
  return "";
}

function isManifestLike(value: unknown): value is WorkflowManifest {
  if (!isObject(value)) {
    return false;
  }
  if (hasDeprecatedWorkflowFields(value)) {
    return false;
  }
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.label) &&
    isObject(value.hooks) &&
    isNonEmptyString(value.hooks.applyResult) &&
    hasValidParameters(value.parameters)
  );
}

function normalizeManifestProvider(manifest: WorkflowManifest) {
  const declared = String(manifest.provider || "").trim();
  if (declared) {
    manifest.provider = declared;
    return manifest;
  }
  const inferred = inferProviderFromRequestKind(manifest.request?.kind || "");
  if (inferred) {
    manifest.provider = inferred;
  }
  return manifest;
}

function resolveBuildStrategy(manifest: WorkflowManifest) {
  if (manifest.hooks.buildRequest) {
    return "hook" as const;
  }
  if (manifest.request) {
    return "declarative" as const;
  }
  if (manifest.provider === PASS_THROUGH_BACKEND_TYPE) {
    return "declarative" as const;
  }
  return null;
}

async function readManifestFile(
  filePath: string,
): Promise<WorkflowManifest | null> {
  const raw = await readTextFile(filePath);
  const parsed = JSON.parse(raw) as unknown;
  if (!isManifestLike(parsed)) {
    return null;
  }
  return normalizeManifestProvider(parsed);
}

async function loadHooks(
  workflowRoot: string,
  manifest: WorkflowManifest,
): Promise<WorkflowHooksModule> {
  const hooks: WorkflowHooksModule = {} as WorkflowHooksModule;

  const applyResultPath = joinPath(workflowRoot, manifest.hooks.applyResult);
  await statPath(applyResultPath);
  const applyResultModule = await loadHooksModule(applyResultPath);
  if (typeof applyResultModule.applyResult !== "function") {
    throw new Error(
      `Hook export applyResult() not found: ${manifest.hooks.applyResult}`,
    );
  }
  hooks.applyResult = applyResultModule.applyResult as ApplyResultHook;

  if (manifest.hooks.filterInputs) {
    const filterInputsPath = joinPath(workflowRoot, manifest.hooks.filterInputs);
    await statPath(filterInputsPath);
    const filterInputsModule = await loadHooksModule(filterInputsPath);
    if (typeof filterInputsModule.filterInputs !== "function") {
      throw new Error(
        `Hook export filterInputs() not found: ${manifest.hooks.filterInputs}`,
      );
    }
    hooks.filterInputs = filterInputsModule.filterInputs as FilterInputsHook;
  }

  if (manifest.hooks.buildRequest) {
    const buildRequestPath = joinPath(workflowRoot, manifest.hooks.buildRequest);
    await statPath(buildRequestPath);
    const buildRequestModule = await loadHooksModule(buildRequestPath);
    if (typeof buildRequestModule.buildRequest !== "function") {
      throw new Error(
        `Hook export buildRequest() not found: ${manifest.hooks.buildRequest}`,
      );
    }
    hooks.buildRequest = buildRequestModule.buildRequest as BuildRequestHook;
  }

  return hooks;
}

export async function loadWorkflowManifests(
  workflowsDir: string,
): Promise<LoadedWorkflows> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const workflowsById = new Map<string, LoadedWorkflow>();

  let entries: string[] = [];
  try {
    entries = await listDirectoryEntries(workflowsDir);
  } catch (error) {
    return {
      workflows: [],
      manifests: [],
      warnings,
      errors: [
        `Unable to read workflows directory: ${workflowsDir} (${String(error)})`,
      ],
    };
  }

  for (const entry of entries) {
    const workflowRoot = joinPath(workflowsDir, entry);
    const manifestPath = joinPath(workflowRoot, "workflow.json");
    try {
      const stat = await statPath(workflowRoot);
      if (!stat.isDirectory) {
        continue;
      }
      const manifest = await readManifestFile(manifestPath);
      if (!manifest) {
        warnings.push(`Invalid workflow manifest: ${manifestPath}`);
        continue;
      }
      if (!isNonEmptyString(manifest.provider)) {
        warnings.push(
          `Skip workflow ${manifest.id}: missing provider declaration and unable to infer from request kind`,
        );
        continue;
      }

      const buildStrategy = resolveBuildStrategy(manifest);
      if (!buildStrategy) {
        warnings.push(
          `Skip workflow ${manifest.id}: missing hooks.buildRequest and request declaration`,
        );
        continue;
      }

      const hooks = await loadHooks(workflowRoot, manifest);
      workflowsById.set(manifest.id, {
        manifest,
        rootDir: workflowRoot,
        hooks,
        buildStrategy,
      });
    } catch (error) {
      warnings.push(`Skip workflow ${entry}: ${String(error)}`);
    }
  }

  const workflows = Array.from(workflowsById.values());
  return {
    workflows,
    manifests: workflows.map((entry) => entry.manifest),
    warnings,
    errors,
  };
}
