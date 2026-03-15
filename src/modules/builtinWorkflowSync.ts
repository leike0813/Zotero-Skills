import { joinPath } from "../utils/path";
import { resolveAddonRef } from "../utils/runtimeBridge";

type DynamicImport = (specifier: string) => Promise<any>;

const dynamicImport: DynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as DynamicImport;

const BUILTIN_WORKFLOW_ROOT = "workflows_builtin";
const BUILTIN_MANIFEST_FILE = "manifest.json";
const BUILTIN_RUNTIME_FALLBACK_ROOT = ".zotero-skills-runtime";

type BuiltinWorkflowManifest = {
  version: number;
  files: string[];
};

function normalizeString(value: unknown) {
  return String(value || "").trim();
}

function detectZoteroRuntime() {
  const runtime = globalThis as {
    IOUtils?: unknown;
    Zotero?: { DataDirectory?: { dir?: string } };
  };
  return (
    typeof runtime.IOUtils !== "undefined" &&
    typeof runtime.Zotero?.DataDirectory?.dir === "string"
  );
}

function ensureTrailingSlash(value: string) {
  if (!value) {
    return value;
  }
  return value.endsWith("/") ? value : `${value}/`;
}

function toPosixRelativePath(value: string) {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function getRuntimeCwd() {
  const runtime = globalThis as {
    process?: { cwd?: () => string };
  };
  if (typeof runtime.process?.cwd === "function") {
    return runtime.process.cwd();
  }
  return "";
}

function getDataDirectory() {
  const runtime = globalThis as {
    Zotero?: { DataDirectory?: { dir?: string } };
  };
  const dataDir = normalizeString(runtime.Zotero?.DataDirectory?.dir);
  return dataDir;
}

function normalizeFsPathForCompare(value: string) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

function isSameFsPath(left: string, right: string) {
  const normalizedLeft = normalizeFsPathForCompare(left);
  const normalizedRight = normalizeFsPathForCompare(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  return normalizedLeft === normalizedRight;
}

function isNestedFsPath(parent: string, child: string) {
  const normalizedParent = normalizeFsPathForCompare(parent);
  const normalizedChild = normalizeFsPathForCompare(child);
  if (!normalizedParent || !normalizedChild) {
    return false;
  }
  if (normalizedParent === normalizedChild) {
    return false;
  }
  return normalizedChild.startsWith(`${normalizedParent}/`);
}

function getPackagedBuiltinSourceDir() {
  const cwd = getRuntimeCwd();
  if (!cwd) {
    return "";
  }
  return joinPath(cwd, BUILTIN_WORKFLOW_ROOT);
}

export function getBuiltinWorkflowTargetDir() {
  const dataDir = getDataDirectory();
  if (dataDir) {
    return joinPath(dataDir, "zotero-skills", BUILTIN_WORKFLOW_ROOT);
  }
  const cwd = getRuntimeCwd();
  if (cwd) {
    return joinPath(cwd, BUILTIN_RUNTIME_FALLBACK_ROOT, BUILTIN_WORKFLOW_ROOT);
  }
  return joinPath(BUILTIN_RUNTIME_FALLBACK_ROOT, BUILTIN_WORKFLOW_ROOT);
}

async function readTextFileNode(filePath: string) {
  const fs = await dynamicImport("fs/promises");
  return fs.readFile(filePath, "utf8") as Promise<string>;
}

async function writeTextFileNode(filePath: string, content: string) {
  const fs = await dynamicImport("fs/promises");
  const path = await dynamicImport("path");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function removeDirectoryNode(targetDir: string) {
  const fs = await dynamicImport("fs/promises");
  await fs.rm(targetDir, { recursive: true, force: true });
}

async function removeDirectoryZotero(targetDir: string) {
  const runtime = globalThis as {
    IOUtils?: {
      remove?: (
        path: string,
        options?: { recursive?: boolean; ignoreAbsent?: boolean },
      ) => Promise<void>;
      makeDirectory?: (
        path: string,
        options?: { createAncestors?: boolean },
      ) => Promise<void>;
    };
  };
  const remove = runtime.IOUtils?.remove;
  if (typeof remove === "function") {
    await remove(targetDir, { recursive: true, ignoreAbsent: true });
  }
}

async function removeDirectory(targetDir: string) {
  if (detectZoteroRuntime()) {
    await removeDirectoryZotero(targetDir);
    return;
  }
  await removeDirectoryNode(targetDir);
}

async function makeDirectoryZotero(targetDir: string) {
  const runtime = globalThis as {
    IOUtils?: {
      makeDirectory?: (
        path: string,
        options?: { createAncestors?: boolean },
      ) => Promise<void>;
    };
  };
  const makeDirectory = runtime.IOUtils?.makeDirectory;
  if (typeof makeDirectory === "function") {
    await makeDirectory(targetDir, { createAncestors: true });
  }
}

async function pathExistsNode(targetPath: string) {
  const fs = await dynamicImport("fs/promises");
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function pathExistsZotero(targetPath: string) {
  const runtime = globalThis as {
    IOUtils?: { exists?: (path: string) => Promise<boolean> };
  };
  if (typeof runtime.IOUtils?.exists === "function") {
    try {
      return runtime.IOUtils.exists(targetPath);
    } catch {
      return false;
    }
  }
  return false;
}

async function pathExists(targetPath: string) {
  if (detectZoteroRuntime()) {
    return pathExistsZotero(targetPath);
  }
  return pathExistsNode(targetPath);
}

async function movePathNode(sourcePath: string, targetPath: string) {
  const fs = await dynamicImport("fs/promises");
  await fs.rename(sourcePath, targetPath);
}

async function movePathZotero(sourcePath: string, targetPath: string) {
  const runtime = globalThis as {
    IOUtils?: {
      move?: (sourcePath: string, targetPath: string) => Promise<void>;
    };
  };
  if (typeof runtime.IOUtils?.move !== "function") {
    throw new Error("IOUtils.move is unavailable");
  }
  await runtime.IOUtils.move(sourcePath, targetPath);
}

async function movePath(sourcePath: string, targetPath: string) {
  if (detectZoteroRuntime()) {
    return movePathZotero(sourcePath, targetPath);
  }
  return movePathNode(sourcePath, targetPath);
}

async function writeTextFileZotero(filePath: string, content: string) {
  const runtime = globalThis as unknown as {
    IOUtils?: {
      writeUTF8?: (path: string, data: string) => Promise<unknown>;
    };
  };
  const writeUTF8 = runtime.IOUtils?.writeUTF8;
  if (typeof writeUTF8 !== "function") {
    throw new Error("IOUtils.writeUTF8 is unavailable");
  }
  await writeUTF8(filePath, content);
}

async function readPackagedTextFromNode(relativePath: string) {
  const cwd = getRuntimeCwd() || ".";
  const sourcePath = joinPath(cwd, BUILTIN_WORKFLOW_ROOT, relativePath);
  return readTextFileNode(sourcePath);
}

async function readPackagedTextFromRuntime(args: {
  rootURI?: string;
  relativePath: string;
}) {
  const addonRef = resolveAddonRef("zotero-skills");
  const rootURI = ensureTrailingSlash(
    normalizeString(args.rootURI) || `chrome://${addonRef}/`,
  );
  const posixRelative = toPosixRelativePath(args.relativePath);
  const fetchUri = `${rootURI}${BUILTIN_WORKFLOW_ROOT}/${posixRelative}`;
  if (typeof fetch !== "function") {
    throw new Error("fetch is unavailable in current runtime");
  }
  const response = await fetch(fetchUri);
  if (!response.ok) {
    throw new Error(
      `failed to load packaged builtin workflow resource: ${fetchUri} (${response.status})`,
    );
  }
  return response.text();
}

async function readPackagedText(args: { rootURI?: string; relativePath: string }) {
  if (detectZoteroRuntime()) {
    try {
      return await readPackagedTextFromRuntime(args);
    } catch {
      return readPackagedTextFromNode(args.relativePath);
    }
  }
  return readPackagedTextFromNode(args.relativePath);
}

function parseBuiltinManifest(rawText: string): BuiltinWorkflowManifest {
  const parsed = JSON.parse(rawText) as {
    version?: unknown;
    files?: unknown;
  };
  const version =
    typeof parsed.version === "number" && Number.isFinite(parsed.version)
      ? Math.floor(parsed.version)
      : 0;
  const files = Array.isArray(parsed.files)
    ? parsed.files
        .map((entry) => toPosixRelativePath(String(entry || "")))
        .filter(Boolean)
    : [];
  if (version <= 0) {
    throw new Error("builtin workflow manifest version is invalid");
  }
  if (files.length === 0) {
    throw new Error("builtin workflow manifest files is empty");
  }
  return {
    version,
    files,
  };
}

function toLocalPath(rootDir: string, posixRelativePath: string) {
  const segments = toPosixRelativePath(posixRelativePath).split("/");
  return joinPath(rootDir, ...segments);
}

async function clearAndPrepareTargetDirectory(targetDir: string) {
  await removeDirectory(targetDir);
  if (detectZoteroRuntime()) {
    await makeDirectoryZotero(targetDir);
    return;
  }
  const fs = await dynamicImport("fs/promises");
  await fs.mkdir(targetDir, { recursive: true });
}

async function replaceTargetDirectory(args: {
  targetRoot: string;
  stagingRoot: string;
}) {
  const backupRoot = `${args.targetRoot}.backup`;
  await removeDirectory(backupRoot);
  const hadTarget = await pathExists(args.targetRoot);
  if (hadTarget) {
    await movePath(args.targetRoot, backupRoot);
  }
  try {
    await movePath(args.stagingRoot, args.targetRoot);
    await removeDirectory(backupRoot);
  } catch (error) {
    try {
      if (hadTarget && (await pathExists(backupRoot))) {
        await movePath(backupRoot, args.targetRoot);
      }
    } catch {
      // noop: keep original error
    }
    throw error;
  }
}

async function writeTargetFile(args: {
  targetRoot: string;
  targetPath: string;
  relativePath: string;
  rootURI?: string;
}) {
  const content = await readPackagedText({
    rootURI: args.rootURI,
    relativePath: args.relativePath,
  });
  if (detectZoteroRuntime()) {
    const relativeDir = toPosixRelativePath(args.relativePath)
      .split("/")
      .slice(0, -1)
      .join("/");
    const targetDir = relativeDir
      ? toLocalPath(args.targetRoot, relativeDir)
      : args.targetRoot;
    await makeDirectoryZotero(targetDir);
    await writeTextFileZotero(args.targetPath, content);
    return;
  }
  await writeTextFileNode(args.targetPath, content);
}

export async function syncBuiltinWorkflowsOnStartup(args?: {
  rootURI?: string;
}) {
  const manifestText = await readPackagedText({
    rootURI: args?.rootURI,
    relativePath: BUILTIN_MANIFEST_FILE,
  });
  const manifest = parseBuiltinManifest(manifestText);
  const targetRoot = getBuiltinWorkflowTargetDir();
  const sourceRoot = getPackagedBuiltinSourceDir();
  const stagingRoot = `${targetRoot}.staging`;

  if (
    sourceRoot &&
    (isSameFsPath(targetRoot, sourceRoot) ||
      isNestedFsPath(sourceRoot, targetRoot) ||
      isNestedFsPath(targetRoot, sourceRoot))
  ) {
    throw new Error(
      "refusing to sync builtin workflows when source and target are same or nested",
    );
  }

  await clearAndPrepareTargetDirectory(stagingRoot);

  try {
    for (const relativePath of manifest.files) {
      const targetPath = toLocalPath(stagingRoot, relativePath);
      await writeTargetFile({
        targetRoot: stagingRoot,
        targetPath,
        relativePath,
        rootURI: args?.rootURI,
      });
    }
    await replaceTargetDirectory({
      targetRoot,
      stagingRoot,
    });
  } catch (error) {
    await removeDirectory(stagingRoot);
    throw error;
  }

  return {
    ok: true,
    version: manifest.version,
    targetRoot,
    files: manifest.files.length,
  };
}
