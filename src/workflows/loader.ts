import type {
  ApplyResultHook,
  BuildRequestHook,
  FilterInputsHook,
  NormalizeWorkflowSettingsHook,
  LoadedWorkflow,
  LoadedWorkflows,
  WorkflowHooksModule,
  WorkflowManifest,
} from "./types";
import { getBaseName, joinPath } from "../utils/path";
import {
  createLoaderDiagnostic,
  normalizeDirectoryEntries,
  normalizeManifestProvider,
  parseWorkflowManifestFromText,
  resolveBuildStrategy,
  sortLoaderDiagnostics,
  toDiagnosticFromUnknown,
  WorkflowLoaderDiagnosticError,
  type LoaderDiagnostic,
} from "./loaderContracts";

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

async function loadHooks(
  workflowRoot: string,
  manifest: WorkflowManifest,
): Promise<WorkflowHooksModule> {
  const hooks: WorkflowHooksModule = {} as WorkflowHooksModule;

  const applyResultPath = joinPath(workflowRoot, manifest.hooks.applyResult);
  try {
    await statPath(applyResultPath);
  } catch (error) {
    throw new WorkflowLoaderDiagnosticError({
      category: "hook_missing_error",
      message: `Hook file missing: ${manifest.hooks.applyResult}`,
      workflowId: manifest.id,
      path: applyResultPath,
      reason: String(error),
    });
  }
  let applyResultModule: Record<string, unknown>;
  try {
    applyResultModule = await loadHooksModule(applyResultPath);
  } catch (error) {
    throw new WorkflowLoaderDiagnosticError({
      category: "hook_import_error",
      message: `Hook import failed: ${manifest.hooks.applyResult}`,
      workflowId: manifest.id,
      path: applyResultPath,
      reason: String(error),
    });
  }
  if (typeof applyResultModule.applyResult !== "function") {
    throw new WorkflowLoaderDiagnosticError({
      category: "hook_import_error",
      message: `Hook export applyResult() not found: ${manifest.hooks.applyResult}`,
      workflowId: manifest.id,
      path: applyResultPath,
      reason: "applyResult export missing",
    });
  }
  hooks.applyResult = applyResultModule.applyResult as ApplyResultHook;

  if (manifest.hooks.filterInputs) {
    const filterInputsPath = joinPath(workflowRoot, manifest.hooks.filterInputs);
    try {
      await statPath(filterInputsPath);
    } catch (error) {
      throw new WorkflowLoaderDiagnosticError({
        category: "hook_missing_error",
        message: `Hook file missing: ${manifest.hooks.filterInputs}`,
        workflowId: manifest.id,
        path: filterInputsPath,
        reason: String(error),
      });
    }
    let filterInputsModule: Record<string, unknown>;
    try {
      filterInputsModule = await loadHooksModule(filterInputsPath);
    } catch (error) {
      throw new WorkflowLoaderDiagnosticError({
        category: "hook_import_error",
        message: `Hook import failed: ${manifest.hooks.filterInputs}`,
        workflowId: manifest.id,
        path: filterInputsPath,
        reason: String(error),
      });
    }
    if (typeof filterInputsModule.filterInputs !== "function") {
      throw new WorkflowLoaderDiagnosticError({
        category: "hook_import_error",
        message: `Hook export filterInputs() not found: ${manifest.hooks.filterInputs}`,
        workflowId: manifest.id,
        path: filterInputsPath,
        reason: "filterInputs export missing",
      });
    }
    hooks.filterInputs = filterInputsModule.filterInputs as FilterInputsHook;
  }

  if (manifest.hooks.buildRequest) {
    const buildRequestPath = joinPath(workflowRoot, manifest.hooks.buildRequest);
    try {
      await statPath(buildRequestPath);
    } catch (error) {
      throw new WorkflowLoaderDiagnosticError({
        category: "hook_missing_error",
        message: `Hook file missing: ${manifest.hooks.buildRequest}`,
        workflowId: manifest.id,
        path: buildRequestPath,
        reason: String(error),
      });
    }
    let buildRequestModule: Record<string, unknown>;
    try {
      buildRequestModule = await loadHooksModule(buildRequestPath);
    } catch (error) {
      throw new WorkflowLoaderDiagnosticError({
        category: "hook_import_error",
        message: `Hook import failed: ${manifest.hooks.buildRequest}`,
        workflowId: manifest.id,
        path: buildRequestPath,
        reason: String(error),
      });
    }
    if (typeof buildRequestModule.buildRequest !== "function") {
      throw new WorkflowLoaderDiagnosticError({
        category: "hook_import_error",
        message: `Hook export buildRequest() not found: ${manifest.hooks.buildRequest}`,
        workflowId: manifest.id,
        path: buildRequestPath,
        reason: "buildRequest export missing",
      });
    }
    hooks.buildRequest = buildRequestModule.buildRequest as BuildRequestHook;
  }

  if (manifest.hooks.normalizeSettings) {
    const normalizeSettingsPath = joinPath(
      workflowRoot,
      manifest.hooks.normalizeSettings,
    );
    try {
      await statPath(normalizeSettingsPath);
    } catch (error) {
      throw new WorkflowLoaderDiagnosticError({
        category: "hook_missing_error",
        message: `Hook file missing: ${manifest.hooks.normalizeSettings}`,
        workflowId: manifest.id,
        path: normalizeSettingsPath,
        reason: String(error),
      });
    }
    let normalizeSettingsModule: Record<string, unknown>;
    try {
      normalizeSettingsModule = await loadHooksModule(normalizeSettingsPath);
    } catch (error) {
      throw new WorkflowLoaderDiagnosticError({
        category: "hook_import_error",
        message: `Hook import failed: ${manifest.hooks.normalizeSettings}`,
        workflowId: manifest.id,
        path: normalizeSettingsPath,
        reason: String(error),
      });
    }
    if (typeof normalizeSettingsModule.normalizeSettings !== "function") {
      throw new WorkflowLoaderDiagnosticError({
        category: "hook_import_error",
        message:
          `Hook export normalizeSettings() not found: ${manifest.hooks.normalizeSettings}`,
        workflowId: manifest.id,
        path: normalizeSettingsPath,
        reason: "normalizeSettings export missing",
      });
    }
    hooks.normalizeSettings =
      normalizeSettingsModule.normalizeSettings as NormalizeWorkflowSettingsHook;
  }

  return hooks;
}

export async function loadWorkflowManifests(
  workflowsDir: string,
): Promise<LoadedWorkflows> {
  const diagnostics: LoaderDiagnostic[] = [];
  const workflowsById = new Map<string, LoadedWorkflow>();

  let entries: string[] = [];
  try {
    entries = await listDirectoryEntries(workflowsDir);
  } catch (error) {
    const diagnostic = createLoaderDiagnostic({
      level: "error",
      category: "scan_path_error",
      message: `Unable to read workflows directory: ${workflowsDir} (${String(error)})`,
      path: workflowsDir,
      reason: String(error),
    });
    return {
      workflows: [],
      manifests: [],
      warnings: [],
      errors: [diagnostic.message],
      diagnostics: [diagnostic],
    };
  }
  entries = normalizeDirectoryEntries(entries);

  for (const entry of entries) {
    const workflowRoot = joinPath(workflowsDir, entry);
    const manifestPath = joinPath(workflowRoot, "workflow.json");
    try {
      const stat = await statPath(workflowRoot);
      if (!stat.isDirectory) {
        continue;
      }
      const manifestResult = parseWorkflowManifestFromText({
        raw: await readTextFile(manifestPath),
        manifestPath,
      });
      if (!manifestResult.manifest) {
        if (manifestResult.diagnostic) {
          diagnostics.push({
            ...manifestResult.diagnostic,
            entry,
          });
        }
        continue;
      }
      const manifest = normalizeManifestProvider(manifestResult.manifest);
      if (!isNonEmptyString(manifest.provider)) {
        diagnostics.push(
          createLoaderDiagnostic({
            level: "warning",
            category: "manifest_validation_error",
            message:
              `Skip workflow ${manifest.id}: missing provider declaration and unable to infer from request kind`,
            entry,
            workflowId: manifest.id,
            path: manifestPath,
            reason: "provider missing and cannot infer",
          }),
        );
        continue;
      }

      const buildStrategy = resolveBuildStrategy(manifest);
      if (!buildStrategy) {
        diagnostics.push(
          createLoaderDiagnostic({
            level: "warning",
            category: "manifest_validation_error",
            message:
              `Skip workflow ${manifest.id}: missing hooks.buildRequest and request declaration`,
            entry,
            workflowId: manifest.id,
            path: manifestPath,
            reason: "build strategy unresolved",
          }),
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
      const normalized = toDiagnosticFromUnknown({
        error,
        fallback: createLoaderDiagnostic({
          level: "warning",
          category: "scan_runtime_warning",
          message: `Skip workflow ${entry}: ${String(error)}`,
          entry,
          path: manifestPath,
        }),
      });
      diagnostics.push({
        ...normalized,
        message: normalized.message.startsWith("Skip workflow")
          ? normalized.message
          : `Skip workflow ${entry}: ${normalized.message}`,
      });
    }
  }

  const workflows = Array.from(workflowsById.values()).sort((a, b) =>
    a.manifest.id.localeCompare(b.manifest.id),
  );
  const sortedDiagnostics = sortLoaderDiagnostics(diagnostics);
  const warnings = sortedDiagnostics
    .filter((entry) => entry.level === "warning")
    .map((entry) => entry.message);
  const errors = sortedDiagnostics
    .filter((entry) => entry.level === "error")
    .map((entry) => entry.message);
  return {
    workflows,
    manifests: workflows.map((entry) => entry.manifest),
    warnings,
    errors,
    diagnostics: sortedDiagnostics,
  };
}
