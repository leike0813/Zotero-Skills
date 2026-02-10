import { joinPath } from "../utils/path";

type DynamicImport = (specifier: string) => Promise<any>;
const dynamicImport: DynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as DynamicImport;

function hasZoteroZipRuntime() {
  const runtime = globalThis as {
    Cc?: Record<string, { createInstance: (iface: unknown) => any }>;
    Ci?: Record<string, unknown> & {
      nsIZipReader?: unknown;
      nsIConverterInputStream?: { DEFAULT_REPLACEMENT_CHARACTER: number };
    };
    Zotero?: { File?: { pathToFile: (targetPath: string) => unknown } };
  };
  return (
    !!runtime.Cc &&
    !!runtime.Ci?.nsIZipReader &&
    !!runtime.Ci?.nsIConverterInputStream &&
    typeof runtime.Zotero?.File?.pathToFile === "function"
  );
}

async function mkTempDir(prefix: string) {
  const fs = await dynamicImport("fs/promises");
  const os = await dynamicImport("os");
  const path = await dynamicImport("path");
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`)) as Promise<string>;
}

export class ZipBundleReader {
  private extractedDirPromise: Promise<string> | null = null;

  constructor(private readonly bundlePath: string) {}

  private readZipEntryInZotero(entryPath: string) {
    const runtime = globalThis as unknown as {
      Cc: Record<string, { createInstance: (iface: unknown) => any }>;
      Ci: Record<string, unknown> & {
        nsIZipReader: unknown;
        nsIConverterInputStream: { DEFAULT_REPLACEMENT_CHARACTER: number };
      };
      Zotero: { File: { pathToFile: (targetPath: string) => unknown } };
    };
    const zipReader = runtime.Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(
      runtime.Ci.nsIZipReader,
    );
    zipReader.open(runtime.Zotero.File.pathToFile(this.bundlePath));
    const stream = zipReader.getInputStream(entryPath);
    const converter = runtime.Cc[
      "@mozilla.org/intl/converter-input-stream;1"
    ].createInstance(runtime.Ci.nsIConverterInputStream);
    converter.init(
      stream,
      "UTF-8",
      0,
      runtime.Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER,
    );
    let output = "";
    const chunk = { value: "" };
    while (converter.readString(0xffffffff, chunk) !== 0) {
      output += chunk.value;
    }
    converter.close();
    zipReader.close();
    return output;
  }

  private async ensureExtractedDirInNode() {
    if (!this.extractedDirPromise) {
      this.extractedDirPromise = (async () => {
        const tmpDir = await mkTempDir("zotero-skills-bundle");
        const childProcess = await dynamicImport("child_process");
        const util = await dynamicImport("util");
        const execFileAsync = util.promisify(childProcess.execFile);
        const processObj = globalThis as {
          process?: { platform?: string };
        };

        if (processObj.process?.platform === "win32") {
          const command = [
            "Expand-Archive",
            `-LiteralPath '${this.bundlePath.replace(/'/g, "''")}'`,
            `-DestinationPath '${tmpDir.replace(/'/g, "''")}'`,
            "-Force",
          ].join(" ");
          await execFileAsync("powershell", [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            command,
          ]);
          return tmpDir;
        }

        await execFileAsync("unzip", ["-q", this.bundlePath, "-d", tmpDir]);
        return tmpDir;
      })();
    }
    return this.extractedDirPromise;
  }

  async readText(entryPath: string) {
    if (hasZoteroZipRuntime()) {
      return this.readZipEntryInZotero(entryPath);
    }
    const fs = await dynamicImport("fs/promises");
    const extractedDir = await this.ensureExtractedDirInNode();
    const targetPath = joinPath(
      extractedDir,
      ...entryPath.split("/").filter(Boolean),
    );
    return fs.readFile(targetPath, "utf8") as Promise<string>;
  }
}
