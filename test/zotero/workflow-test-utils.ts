type DynamicImport = (specifier: string) => Promise<any>;

const dynamicImport: DynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as DynamicImport;

export function isZoteroRuntime() {
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
    !!runtime.IOUtils &&
    !!runtime.PathUtils &&
    typeof runtime.Services?.io?.newFileURI === "function" &&
    typeof runtime.Services?.scriptloader?.loadSubScript === "function" &&
    typeof runtime.Cc !== "undefined" &&
    typeof runtime.Ci !== "undefined"
  );
}

function getPathSeparator() {
  const runtime = globalThis as {
    Zotero?: { isWin?: boolean };
    process?: { platform?: string };
  };
  if (typeof runtime.Zotero?.isWin === "boolean") {
    return runtime.Zotero.isWin ? "\\" : "/";
  }
  return runtime.process?.platform === "win32" ? "\\" : "/";
}

export function joinPath(...segments: string[]) {
  const runtime = globalThis as {
    PathUtils?: { join?: (...parts: string[]) => string };
  };
  if (typeof runtime.PathUtils?.join === "function") {
    return runtime.PathUtils.join(...segments.filter(Boolean));
  }
  const separator = getPathSeparator();
  const firstNonEmpty = segments.find((segment) => segment.length > 0) || "";
  const isPosixAbsolute = firstNonEmpty.startsWith("/");
  const driveMatch = firstNonEmpty.match(/^([A-Za-z]:)[\\/]?/);
  const drivePrefix = driveMatch?.[1] || "";
  const normalized = segments
    .flatMap((segment) => segment.split(/[\\/]+/))
    .filter(Boolean);
  if (!normalized.length) {
    if (drivePrefix) {
      return `${drivePrefix}${separator}`;
    }
    return isPosixAbsolute ? separator : "";
  }
  if (
    drivePrefix &&
    normalized[0].toLowerCase() === drivePrefix.toLowerCase()
  ) {
    normalized.shift();
  }
  const joined = normalized.join(separator);
  if (drivePrefix) {
    return `${drivePrefix}${separator}${joined}`;
  }
  if (isPosixAbsolute) {
    return `${separator}${joined}`;
  }
  return joined;
}

export function getProjectRoot() {
  const services = globalThis as {
    Services?: {
      dirsvc?: {
        get?: (key: string, iface: unknown) => { path?: string };
      };
    };
    Ci?: { nsIFile?: unknown };
    process?: { cwd?: () => string };
  };
  if (services.Services?.dirsvc?.get && services.Ci?.nsIFile) {
    const file = services.Services.dirsvc.get("CurWorkD", services.Ci.nsIFile);
    if (file?.path) {
      return file.path;
    }
  }
  if (typeof services.process?.cwd === "function") {
    return services.process.cwd();
  }
  return ".";
}

export function fixturePath(...segments: string[]) {
  return joinPath(getProjectRoot(), "test", "fixtures", ...segments);
}

export function workflowsPath(...segments: string[]) {
  return joinPath(getProjectRoot(), "workflows", ...segments);
}

function dirnamePath(targetPath: string) {
  const normalized = targetPath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return "";
  }
  return joinPath(...parts.slice(0, -1));
}

export async function mkTempDir(prefix: string) {
  if (isZoteroRuntime()) {
    const runtime = globalThis as {
      PathUtils: { tempDir: string };
      IOUtils: { makeDirectory: (path: string, options?: Record<string, unknown>) => Promise<void> };
    };
    const dir = joinPath(
      runtime.PathUtils.tempDir,
      `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    );
    await runtime.IOUtils.makeDirectory(dir, { createAncestors: true });
    return dir;
  }
  const fs = await dynamicImport("fs/promises");
  const os = await dynamicImport("os");
  const path = await dynamicImport("path");
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`)) as Promise<string>;
}

export async function writeUtf8(filePath: string, content: string) {
  if (isZoteroRuntime()) {
    const runtime = globalThis as {
      IOUtils: {
        makeDirectory: (path: string, options?: Record<string, unknown>) => Promise<void>;
        writeUTF8: (path: string, data: string) => Promise<void>;
      };
    };
    const parent = dirnamePath(filePath);
    if (parent) {
      await runtime.IOUtils.makeDirectory(parent, { createAncestors: true });
    }
    await runtime.IOUtils.writeUTF8(filePath, content);
    return;
  }
  const fs = await dynamicImport("fs/promises");
  const path = await dynamicImport("path");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}
