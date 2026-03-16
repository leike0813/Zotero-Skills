import { appendSkillRunnerLocalDeployDebugLog } from "./skillRunnerLocalDeployDebugStore";

type DynamicImport = (specifier: string) => Promise<any>;

const dynamicImport: DynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as DynamicImport;

export type SkillRunnerCtlCommandResult = {
  ok: boolean;
  exitCode: number;
  message: string;
  stdout: string;
  stderr: string;
  details?: Record<string, unknown>;
  command: string;
  args: string[];
};

type CommandOutput = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type SkillRunnerCtlBridgeDeps = {
  runCommand?: (args: {
    command: string;
    args: string[];
    cwd?: string;
    timeoutMs?: number;
  }) => Promise<CommandOutput>;
};

type CtlArgs = {
  ctlPath: string;
  command:
    | "bootstrap"
    | "install"
    | "preflight"
    | "up"
    | "down"
    | "status"
    | "doctor";
  mode?: "local" | "docker";
  host?: string;
  port?: number;
  portFallbackSpan?: number;
  waitSeconds?: number;
};

type UninstallArgs = {
  uninstallPath: string;
  clearData?: boolean;
  clearAgentHome?: boolean;
  localRoot?: string;
};

type ScriptCommandInvocation = {
  command: string;
  argv: string[];
  scriptPath: string;
};

function normalizeString(value: unknown) {
  return String(value || "").trim();
}

function isExecutableNotFoundText(value: unknown) {
  return /executable not found|not found|does not exist|is not executable|找不到|不存在|不可执行/i.test(
    normalizeString(value),
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function detectWindows() {
  const runtime = globalThis as {
    Zotero?: { isWin?: boolean };
    process?: { platform?: string };
  };
  if (typeof runtime.Zotero?.isWin === "boolean") {
    return runtime.Zotero.isWin;
  }
  return runtime.process?.platform === "win32";
}

function readDirectoryServicePath(key: string) {
  const runtime = globalThis as {
    Services?: {
      dirsvc?: {
        get?: (name: string, iface: unknown) => { path?: string };
      };
    };
    Ci?: { nsIFile?: unknown };
  };
  if (!runtime.Services?.dirsvc?.get || !runtime.Ci?.nsIFile) {
    return "";
  }
  try {
    const file = runtime.Services.dirsvc.get(key, runtime.Ci.nsIFile);
    return normalizeString(file?.path);
  } catch {
    return "";
  }
}

function resolveTempRoot() {
  const runtime = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  const env = runtime.process?.env || {};
  return (
    normalizeString(env.TEMP) ||
    normalizeString(env.TMP) ||
    normalizeString(env.TMPDIR) ||
    readDirectoryServicePath("TmpD") ||
    readDirectoryServicePath("ProfD") ||
    "."
  );
}

function getWindowsPowerShellAbsoluteCandidates() {
  if (!detectWindows()) {
    return [] as string[];
  }
  const runtime = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  const env = runtime.process?.env || {};
  const windowsRoot =
    normalizeString(env.SystemRoot) ||
    normalizeString(env.WINDIR) ||
    "C:\\Windows";
  const candidates = [
    joinFsPath(
      windowsRoot,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    ),
    joinFsPath(
      windowsRoot,
      "Sysnative",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    ),
    "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    "C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe",
    "C:\\Program Files\\PowerShell\\6\\pwsh.exe",
  ];
  return Array.from(
    new Set(candidates.map((entry) => normalizeString(entry)).filter(Boolean)),
  );
}

function getWindowsExecutableCandidates(command: string) {
  if (!detectWindows()) {
    return [] as string[];
  }
  const normalized = normalizeString(command);
  if (!normalized) {
    return [] as string[];
  }
  if (/[\\/]/.test(normalized) || /^[A-Za-z]:[\\/]/.test(normalized)) {
    return [] as string[];
  }
  const runtime = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  const env = runtime.process?.env || {};
  const windowsRoot =
    normalizeString(env.SystemRoot) ||
    normalizeString(env.WINDIR) ||
    "C:\\Windows";
  const withoutExt = normalized.replace(/\.(exe|cmd|bat)$/i, "");
  const commandVariants = [
    `${withoutExt}.exe`,
    `${withoutExt}.cmd`,
    `${withoutExt}.bat`,
    normalized,
  ];
  const candidates = commandVariants.flatMap((entry) => [
    joinFsPath(windowsRoot, "System32", entry),
    joinFsPath(windowsRoot, "Sysnative", entry),
  ]);
  return Array.from(
    new Set(candidates.map((entry) => normalizeString(entry)).filter(Boolean)),
  );
}

async function resolveWindowsCommandFromPowerShell(command: string) {
  if (!detectWindows()) {
    return [] as string[];
  }
  const normalized = normalizeString(command);
  if (!normalized || /[\\/]/.test(normalized) || /^[A-Za-z]:[\\/]/.test(normalized)) {
    return [] as string[];
  }
  const runtime = globalThis as {
    Zotero?: {
      Utilities?: {
        Internal?: {
          subprocess?: (command: string, args?: string[]) => Promise<string>;
        };
      };
    };
  };
  const subprocess = runtime.Zotero?.Utilities?.Internal?.subprocess;
  if (typeof subprocess !== "function") {
    return [] as string[];
  }
  const escapedCommand = normalized.replace(/'/g, "''");
  const script = [
    "$ErrorActionPreference='SilentlyContinue'",
    `$cmd=Get-Command '${escapedCommand}'`,
    "if ($cmd -and $cmd.Source) { Write-Output $cmd.Source; exit 0 }",
    "exit 1",
  ].join("; ");
  const powerShellCandidates = Array.from(
    new Set([
      ...getWindowsPowerShellAbsoluteCandidates(),
      "powershell.exe",
      "pwsh.exe",
      "pwsh",
      "powershell",
    ]),
  );
  for (const shellCommand of powerShellCandidates) {
    try {
      const output = await subprocess(shellCommand, [
        "-NoLogo",
        "-NonInteractive",
        "-WindowStyle",
        "Hidden",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ]);
      const lines = String(output || "")
        .split(/\r?\n/)
        .map((entry) => normalizeString(entry))
        .filter(Boolean);
      if (lines.length > 0) {
        return Array.from(new Set(lines));
      }
    } catch {
      continue;
    }
  }
  return [] as string[];
}

function joinFsPath(...segments: string[]) {
  const separator = detectWindows() ? "\\" : "/";
  const normalizedSegments = segments
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  if (normalizedSegments.length === 0) {
    return "";
  }
  const first = normalizedSegments[0];
  const isPosixAbsolute = first.startsWith("/");
  const driveMatch = first.match(/^([A-Za-z]:)[\\/]?/);
  const drivePrefix = driveMatch?.[1] || "";
  const flattened = normalizedSegments
    .flatMap((entry) => entry.split(/[\\/]+/))
    .filter(Boolean);
  if (drivePrefix && flattened[0]?.toLowerCase() === drivePrefix.toLowerCase()) {
    flattened.shift();
  }
  const joined = flattened.join(separator);
  if (drivePrefix) {
    return `${drivePrefix}${separator}${joined}`;
  }
  if (isPosixAbsolute) {
    return `${separator}${joined}`;
  }
  return joined;
}

function isAbsoluteFsPath(pathValue: string) {
  const normalized = normalizeString(pathValue);
  if (!normalized) {
    return false;
  }
  if (detectWindows()) {
    return /^[A-Za-z]:[\\/]/.test(normalized) || /^\\\\/.test(normalized);
  }
  return normalized.startsWith("/");
}

function normalizeSafeLocalRootArg(localRoot: unknown) {
  const normalized = normalizeString(localRoot);
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith("-")) {
    return "";
  }
  if (!isAbsoluteFsPath(normalized)) {
    return "";
  }
  const stripped = normalized.replace(/[\\/]+$/g, "");
  if (!stripped) {
    return "";
  }
  if (detectWindows()) {
    if (/^[A-Za-z]:$/.test(stripped)) {
      return "";
    }
    if (/^\\\\[^\\]+\\[^\\]+$/.test(stripped)) {
      return "";
    }
  } else if (stripped === "/") {
    return "";
  }
  return normalized;
}

async function ensureDirectory(pathValue: string) {
  const normalized = normalizeString(pathValue);
  if (!normalized) {
    return;
  }
  const runtime = globalThis as {
    IOUtils?: {
      makeDirectory?: (
        path: string,
        options?: { createAncestors?: boolean; ignoreExisting?: boolean },
      ) => Promise<void>;
    };
  };
  if (typeof runtime.IOUtils?.makeDirectory === "function") {
    await runtime.IOUtils.makeDirectory(normalized, {
      createAncestors: true,
      ignoreExisting: true,
    });
    return;
  }
  const fs = await dynamicImport("fs/promises");
  await fs.mkdir(normalized, { recursive: true });
}

async function readUtf8File(pathValue: string) {
  const normalized = normalizeString(pathValue);
  if (!normalized) {
    return "";
  }
  const runtime = globalThis as {
    IOUtils?: { readUTF8?: (path: string) => Promise<string> };
  };
  if (typeof runtime.IOUtils?.readUTF8 === "function") {
    return runtime.IOUtils.readUTF8(normalized);
  }
  const fs = await dynamicImport("fs/promises");
  return fs.readFile(normalized, "utf8") as Promise<string>;
}

async function removePath(pathValue: string) {
  const normalized = normalizeString(pathValue);
  if (!normalized) {
    return;
  }
  const runtime = globalThis as {
    IOUtils?: {
      remove?: (
        path: string,
        options?: { ignoreAbsent?: boolean; recursive?: boolean },
      ) => Promise<void>;
    };
  };
  if (typeof runtime.IOUtils?.remove === "function") {
    try {
      await runtime.IOUtils.remove(normalized, {
        ignoreAbsent: true,
        recursive: true,
      });
      return;
    } catch {
      // fall through
    }
  }
  try {
    const fs = await dynamicImport("fs/promises");
    await fs.rm(normalized, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
}

function getMozillaSubprocessModule() {
  const runtime = globalThis as {
    ChromeUtils?: {
      import?: (url: string) => { Subprocess?: unknown };
    };
  };
  if (typeof runtime.ChromeUtils?.import !== "function") {
    return null;
  }
  try {
    const imported = runtime.ChromeUtils.import(
      "resource://gre/modules/Subprocess.jsm",
    ) as { Subprocess?: unknown };
    return imported?.Subprocess || null;
  } catch {
    return null;
  }
}

function isAbsoluteCommand(command: string) {
  const normalized = normalizeString(command);
  return (
    normalized.startsWith("/") ||
    normalized.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/.test(normalized)
  );
}

function hasPathSeparator(command: string) {
  return /[\\/]/.test(command);
}

async function readProcessPipe(stream: unknown) {
  if (typeof stream === "string") {
    return stream;
  }
  if (
    stream &&
    typeof stream === "object" &&
    "text" in (stream as Record<string, unknown>) &&
    typeof (stream as { text?: unknown }).text === "string"
  ) {
    return String((stream as { text?: unknown }).text || "");
  }
  const reader = stream as {
    readString?: () => Promise<string>;
  };
  if (!reader || typeof reader.readString !== "function") {
    return "";
  }
  let text = "";
  while (true) {
    const chunk = await reader.readString();
    if (!chunk) {
      break;
    }
    text += chunk;
  }
  return text;
}

async function waitMozillaProcessExit(proc: unknown) {
  const process = proc as {
    wait?: () => Promise<number>;
    exitCode?: unknown;
  };
  if (typeof process.wait === "function") {
    try {
      const code = await process.wait();
      if (typeof code === "number" && Number.isFinite(code)) {
        return Math.floor(code);
      }
    } catch {
      return 1;
    }
  }
  if (typeof process.exitCode === "number" && Number.isFinite(process.exitCode)) {
    return Math.floor(process.exitCode);
  }
  return 0;
}

async function runWithMozillaSubprocess(args: {
  command: string;
  argv: string[];
}): Promise<CommandOutput> {
  const subprocess = getMozillaSubprocessModule() as
    | {
        pathSearch?: (command: string) => Promise<string>;
        call?: (args: {
          command: string;
          arguments?: string[];
        }) => Promise<{
          stdout?: unknown;
          stderr?: unknown;
          wait?: () => Promise<number>;
          exitCode?: unknown;
        }>;
      }
    | null;
  if (!subprocess?.call) {
    throw new Error("mozilla subprocess unavailable");
  }
  const command = normalizeString(args.command);
  const resolvedCommand =
    !isAbsoluteCommand(command) &&
    !hasPathSeparator(command) &&
    typeof subprocess.pathSearch === "function"
      ? await subprocess.pathSearch(command)
      : command;
  const proc = await subprocess.call({
    command: resolvedCommand,
    arguments: args.argv,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    readProcessPipe(proc.stdout),
    readProcessPipe(proc.stderr),
    waitMozillaProcessExit(proc),
  ]);
  if (
    exitCode !== 0 &&
    (isExecutableNotFoundText(stderr) || isExecutableNotFoundText(stdout))
  ) {
    throw new Error(
      normalizeString(stderr) || normalizeString(stdout) || "executable not found",
    );
  }
  return {
    exitCode,
    stdout,
    stderr,
  };
}

async function runWithZoteroSubprocess(args: {
  command: string;
  argv: string[];
}): Promise<CommandOutput> {
  const runtime = globalThis as {
    Zotero?: {
      Utilities?: {
        Internal?: {
          subprocess?: (command: string, args?: string[]) => Promise<string>;
        };
      };
    };
  };
  const subprocess = runtime.Zotero?.Utilities?.Internal?.subprocess;
  if (typeof subprocess !== "function") {
    throw new Error("zotero subprocess unavailable");
  }
  const normalizeErrorText = (error: unknown) =>
    normalizeString(
      error && typeof error === "object" && "message" in error
        ? (error as { message?: unknown }).message
        : error,
    );
  const commandCandidates = await (async () => {
    if (!detectWindows()) {
      return [args.command];
    }
    const normalized = normalizeString(args.command).toLowerCase();
    const powerShellSet = new Set([
      "powershell",
      "powershell.exe",
      "pwsh",
      "pwsh.exe",
    ]);
    if (!powerShellSet.has(normalized)) {
      const resolvedCandidates =
        await resolveWindowsCommandFromPowerShell(args.command);
      const candidates = [
        args.command,
        ...resolvedCandidates,
        ...getWindowsExecutableCandidates(args.command),
        `${normalized.replace(/\.(exe|cmd|bat)$/i, "")}.exe`,
      ];
      return Array.from(
        new Set(candidates.map((entry) => normalizeString(entry)).filter(Boolean)),
      );
    }
    const candidates = [
      args.command,
      ...getWindowsPowerShellAbsoluteCandidates(),
      "powershell.exe",
      "pwsh.exe",
      "pwsh",
      "powershell",
    ];
    return Array.from(
      new Set(candidates.map((entry) => normalizeString(entry)).filter(Boolean)),
    );
  })();
  let lastErrorText = "";
  for (let i = 0; i < commandCandidates.length; i++) {
    const command = commandCandidates[i];
    try {
      const stdout = await subprocess(command, args.argv);
      return {
        exitCode: 0,
        stdout: String(stdout || ""),
        stderr: "",
      };
    } catch (error) {
      const errorText = normalizeErrorText(error);
      lastErrorText = errorText || lastErrorText;
      if (
        i < commandCandidates.length - 1 &&
        isExecutableNotFoundText(errorText)
      ) {
        continue;
      }
      break;
    }
  }
  return {
    exitCode: 1,
    stdout: "",
    stderr: lastErrorText || "subprocess failed",
  };
}

async function resolveWindowsCommandForNsIProcess(command: string) {
  if (!detectWindows()) {
    return "";
  }
  const normalized = normalizeString(command);
  if (!normalized) {
    return "";
  }
  const powerShellSet = new Set(["powershell", "powershell.exe", "pwsh", "pwsh.exe"]);
  const lower = normalized.toLowerCase();
  const candidates = Array.from(
    new Set([
      ...(isAbsoluteCommand(normalized) || hasPathSeparator(normalized)
        ? [normalized]
        : []),
      ...(powerShellSet.has(lower) ? getWindowsPowerShellAbsoluteCandidates() : []),
      ...(await resolveWindowsCommandFromPowerShell(normalized)),
      ...getWindowsExecutableCandidates(normalized),
    ].map((entry) => normalizeString(entry)).filter(Boolean)),
  );
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return "";
}

type WindowsPowerShellCaptureContext = {
  argv: string[];
  tempDir: string;
  stdoutPath: string;
  stderrPath: string;
};

async function buildWindowsPowerShellCaptureContext(argv: string[]) {
  const commandIndex = argv.findIndex(
    (entry, index) => /^-command$/i.test(entry) && index < argv.length - 1,
  );
  if (commandIndex < 0) {
    return null as WindowsPowerShellCaptureContext | null;
  }
  const originalCommand = String(argv[commandIndex + 1] || "");
  const tempDir = joinFsPath(
    resolveTempRoot(),
    `zotero-skills-ps-capture-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await ensureDirectory(tempDir);
  const stdoutPath = joinFsPath(tempDir, "stdout.log");
  const stderrPath = joinFsPath(tempDir, "stderr.log");
  const wrappedCommand = [
    "$ErrorActionPreference='Stop'",
    `$stdoutPath = ${toPowerShellSingleQuotedLiteral(stdoutPath)}`,
    `$stderrPath = ${toPowerShellSingleQuotedLiteral(stderrPath)}`,
    "& {",
    originalCommand,
    "} 1> $stdoutPath 2> $stderrPath",
    "exit $LASTEXITCODE",
  ].join("; ");
  const nextArgv = [...argv];
  nextArgv[commandIndex + 1] = wrappedCommand;
  return {
    argv: nextArgv,
    tempDir,
    stdoutPath,
    stderrPath,
  } as WindowsPowerShellCaptureContext;
}

async function runWithWindowsNsIProcessHidden(args: {
  command: string;
  argv: string[];
}): Promise<CommandOutput> {
  if (!detectWindows()) {
    throw new Error("nsIProcess hidden execution is only available on Windows");
  }
  const runtime = globalThis as {
    Components?: {
      classes?: Record<string, { createInstance?: (iface: unknown) => unknown }>;
      interfaces?: Record<string, unknown>;
    };
    Cc?: Record<string, { createInstance?: (iface: unknown) => unknown }>;
    Ci?: Record<string, unknown>;
  };
  const classes = runtime.Components?.classes || runtime.Cc;
  const interfaces = runtime.Components?.interfaces || runtime.Ci;
  const localFileFactory = classes?.["@mozilla.org/file/local;1"];
  const processFactory = classes?.["@mozilla.org/process/util;1"];
  const nsIFile = interfaces?.nsIFile;
  const nsIProcess = interfaces?.nsIProcess;
  if (
    !localFileFactory?.createInstance ||
    !processFactory?.createInstance ||
    !nsIFile ||
    !nsIProcess
  ) {
    throw new Error("XPCOM nsIProcess APIs are unavailable");
  }
  const resolvedCommand = await resolveWindowsCommandForNsIProcess(args.command);
  if (!resolvedCommand) {
    throw new Error(`failed to resolve command for nsIProcess: ${args.command}`);
  }
  const captureContext = await buildWindowsPowerShellCaptureContext(args.argv);
  const invocationArgv = captureContext ? captureContext.argv : args.argv;
  const executable = localFileFactory.createInstance(nsIFile) as {
    initWithPath?: (path: string) => void;
  };
  if (typeof executable.initWithPath !== "function") {
    throw new Error("nsIFile.initWithPath is unavailable");
  }
  executable.initWithPath(resolvedCommand);
  const proc = processFactory.createInstance(nsIProcess) as {
    init?: (file: unknown) => void;
    runwAsync?: (args: string[], count: number, observer: unknown) => void;
    runAsync?: (args: string[], count: number, observer: unknown) => void;
    startHidden?: boolean;
    noShell?: boolean;
    exitValue?: number;
  };
  if (typeof proc.init !== "function") {
    throw new Error("nsIProcess.init is unavailable");
  }
  proc.init(executable);
  try {
    proc.startHidden = true;
  } catch {
    // ignore if unsupported
  }
  try {
    proc.noShell = true;
  } catch {
    // ignore if unsupported
  }
  const runAsync = typeof proc.runwAsync === "function"
    ? proc.runwAsync.bind(proc)
    : typeof proc.runAsync === "function"
      ? proc.runAsync.bind(proc)
      : null;
  if (!runAsync) {
    throw new Error("nsIProcess async execution is unavailable");
  }
  await new Promise<void>((resolve, reject) => {
    try {
      runAsync(invocationArgv, invocationArgv.length, {
        observe: (_subject: unknown, topic: string) => {
          if (topic === "process-finished" || topic === "process-failed") {
            resolve();
            return;
          }
          reject(new Error(`unexpected process topic: ${topic}`));
        },
      });
    } catch (error) {
      reject(error);
    }
  });
  const exitCode =
    typeof proc.exitValue === "number" && Number.isFinite(proc.exitValue)
      ? Math.floor(proc.exitValue)
      : 1;
  let stdout = "";
  let stderr = "";
  if (captureContext) {
    try {
      stdout = await readUtf8File(captureContext.stdoutPath);
    } catch {
      stdout = "";
    }
    try {
      stderr = await readUtf8File(captureContext.stderrPath);
    } catch {
      stderr = "";
    }
    await removePath(captureContext.tempDir);
  }
  return {
    exitCode,
    stdout,
    stderr,
  };
}

async function runWithNodeExecFile(args: {
  command: string;
  argv: string[];
  cwd?: string;
  timeoutMs?: number;
}): Promise<CommandOutput> {
  const childProcess = await dynamicImport("child_process");
  const util = await dynamicImport("util");
  const execFileAsync = util.promisify(childProcess.execFile) as (
    command: string,
    argv: string[],
    options: Record<string, unknown>,
  ) => Promise<{ stdout: string; stderr: string }>;
  try {
    const result = await execFileAsync(args.command, args.argv, {
      cwd: args.cwd,
      timeout: args.timeoutMs ?? 600000,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    });
    return {
      exitCode: 0,
      stdout: String(result.stdout || ""),
      stderr: String(result.stderr || ""),
    };
  } catch (error) {
    const typed = (error || {}) as {
      code?: unknown;
      stdout?: unknown;
      stderr?: unknown;
      message?: unknown;
    };
    return {
      exitCode:
        typeof typed.code === "number" && Number.isFinite(typed.code)
          ? Math.floor(typed.code)
          : 1,
      stdout: normalizeString(typed.stdout),
      stderr: normalizeString(typed.stderr) || normalizeString(typed.message),
    };
  }
}

async function runCommand(args: {
  command: string;
  argv: string[];
  cwd?: string;
  timeoutMs?: number;
}) {
  const isWindowsPowerShellCommand =
    detectWindows() &&
    /(^|[\\/])(powershell|pwsh)(\.exe)?$/i.test(normalizeString(args.command));
  if (isWindowsPowerShellCommand) {
    try {
      return await runWithMozillaSubprocess({
        command: args.command,
        argv: args.argv,
      });
    } catch {
      // fallthrough
    }
    try {
      return await runWithZoteroSubprocess({
        command: args.command,
        argv: args.argv,
      });
    } catch {
      // fallthrough
    }
    try {
      return await runWithWindowsNsIProcessHidden({
        command: args.command,
        argv: args.argv,
      });
    } catch {
      // fallthrough
    }
    return runWithNodeExecFile(args);
  }
  try {
    return await runWithMozillaSubprocess({
      command: args.command,
      argv: args.argv,
    });
  } catch {
    // fallthrough
  }
  try {
    return await runWithZoteroSubprocess({
      command: args.command,
      argv: args.argv,
    });
  } catch {
    // fallthrough
  }
  return runWithNodeExecFile(args);
}

async function pathExists(pathValue: string) {
  const targetPath = normalizeString(pathValue);
  if (!targetPath) {
    return false;
  }
  const runtime = globalThis as {
    IOUtils?: { exists?: (path: string) => Promise<boolean> };
    Components?: {
      classes?: Record<string, { createInstance?: (iface: unknown) => unknown }>;
      interfaces?: Record<string, unknown>;
    };
    Cc?: Record<string, { createInstance?: (iface: unknown) => unknown }>;
    Ci?: Record<string, unknown>;
  };
  if (typeof runtime.IOUtils?.exists === "function") {
    try {
      return !!(await runtime.IOUtils.exists(targetPath));
    } catch {
      // continue fallback checks
    }
  }
  try {
    const classes = runtime.Components?.classes || runtime.Cc;
    const interfaces = runtime.Components?.interfaces || runtime.Ci;
    const localFileFactory = classes?.["@mozilla.org/file/local;1"];
    const nsIFile = interfaces?.nsIFile;
    if (localFileFactory?.createInstance && nsIFile) {
      const file = localFileFactory.createInstance(nsIFile) as {
        initWithPath?: (path: string) => void;
        exists?: () => boolean;
      };
      if (typeof file.initWithPath === "function") {
        file.initWithPath(targetPath);
      }
      if (typeof file.exists === "function") {
        return !!file.exists();
      }
    }
  } catch {
    // continue fallback checks
  }
  try {
    const fs = await dynamicImport("fs");
    if (typeof fs?.existsSync === "function") {
      return !!fs.existsSync(targetPath);
    }
  } catch {
    // ignore node fs fallback failure
  }
  return false;
}

function parseJsonObjectCandidate(text: string) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return null;
  }
  const lines = normalized.split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const candidate = lines[i].trim();
    if (!candidate.startsWith("{") || !candidate.endsWith("}")) {
      continue;
    }
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function normalizeCtlResult(args: {
  output: CommandOutput;
  command: string;
  argv: string[];
  fallbackMessage: string;
}) {
  const payload =
    parseJsonObjectCandidate(args.output.stdout) ||
    parseJsonObjectCandidate(args.output.stderr);
  const details = payload || {};
  const exitCode =
    typeof payload?.exit_code === "number" && Number.isFinite(payload.exit_code)
      ? Math.floor(payload.exit_code)
      : args.output.exitCode;
  const ok =
    typeof payload?.ok === "boolean" ? payload.ok : exitCode === 0;
  const message =
    normalizeString(payload?.message) ||
    normalizeString(args.output.stderr) ||
    normalizeString(args.output.stdout) ||
    args.fallbackMessage;
  return {
    ok,
    exitCode,
    message,
    stdout: args.output.stdout,
    stderr: args.output.stderr,
    details,
    command: args.command,
    args: args.argv,
  } as SkillRunnerCtlCommandResult;
}

function toPowerShellSingleQuotedLiteral(raw: string) {
  const normalized = String(raw || "");
  return `'${normalized.replace(/'/g, "''")}'`;
}

function toPowerShellInvocationToken(raw: string) {
  const normalized = String(raw || "");
  if (/^-{1,2}[A-Za-z][A-Za-z0-9-]*$/.test(normalized)) {
    return normalized;
  }
  return toPowerShellSingleQuotedLiteral(normalized);
}

function buildWindowsPowerShellScriptInvocation(args: {
  scriptPath: string;
  scriptArgs: string[];
}): ScriptCommandInvocation {
  const scriptPath = normalizeString(args.scriptPath);
  const scriptArgList = args.scriptArgs.map((entry) =>
    toPowerShellInvocationToken(entry),
  );
  const inlineScriptArgs = scriptArgList.join(" ");
  const commandScript = [
    "$ErrorActionPreference='Stop'",
    "if ([string]::IsNullOrWhiteSpace($env:PATH) -and -not [string]::IsNullOrWhiteSpace($env:Path)) { $env:PATH = $env:Path }",
    "$npmCommand = Get-Command npm -ErrorAction SilentlyContinue",
    "if ($npmCommand -and $npmCommand.Source) { $npmDir = Split-Path -Parent $npmCommand.Source; if ($npmDir -and ($env:PATH -notlike \"*${npmDir}*\")) { $env:PATH = \"$npmDir;$env:PATH\" } }",
    `& ${toPowerShellSingleQuotedLiteral(scriptPath)}${inlineScriptArgs ? ` ${inlineScriptArgs}` : ""}`,
    "exit $LASTEXITCODE",
  ].join("; ");
  return {
    command: "powershell.exe",
    argv: [
      "-NoLogo",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      commandScript,
    ],
    scriptPath,
  };
}

function buildCtlInvocation(args: CtlArgs): ScriptCommandInvocation {
  const isWin = detectWindows();
  const commandArgs: string[] = [args.command];
  if (args.command === "preflight") {
    if (args.host) {
      commandArgs.push("--host", args.host);
    }
    if (typeof args.port === "number" && Number.isFinite(args.port)) {
      commandArgs.push("--port", String(Math.floor(args.port)));
    }
    if (
      typeof args.portFallbackSpan === "number" &&
      Number.isFinite(args.portFallbackSpan) &&
      args.portFallbackSpan >= 0
    ) {
      commandArgs.push("--port-fallback-span", String(Math.floor(args.portFallbackSpan)));
    }
  } else if (args.command === "up") {
    commandArgs.push("--mode", args.mode || "local");
    if (args.host) {
      commandArgs.push("--host", args.host);
    }
    if (typeof args.port === "number" && Number.isFinite(args.port)) {
      commandArgs.push("--port", String(Math.floor(args.port)));
    }
    if (
      typeof args.waitSeconds === "number" &&
      Number.isFinite(args.waitSeconds) &&
      args.waitSeconds > 0
    ) {
      commandArgs.push("--wait-seconds", String(Math.floor(args.waitSeconds)));
    }
    if (
      typeof args.portFallbackSpan === "number" &&
      Number.isFinite(args.portFallbackSpan) &&
      args.portFallbackSpan >= 0
    ) {
      commandArgs.push("--port-fallback-span", String(Math.floor(args.portFallbackSpan)));
    }
  } else if (args.command === "down" || args.command === "status") {
    commandArgs.push("--mode", args.mode || "local");
    if (
      args.command === "status" &&
      typeof args.port === "number" &&
      Number.isFinite(args.port)
    ) {
      commandArgs.push("--port", String(Math.floor(args.port)));
    }
  }
  commandArgs.push("--json");
  if (isWin) {
    return buildWindowsPowerShellScriptInvocation({
      scriptPath: args.ctlPath,
      scriptArgs: commandArgs,
    });
  }
  return {
    command: "sh",
    argv: [args.ctlPath, ...commandArgs],
    scriptPath: args.ctlPath,
  };
}

function buildUninstallInvocation(args: UninstallArgs): ScriptCommandInvocation {
  const safeLocalRoot = normalizeSafeLocalRootArg(args.localRoot);
  if (detectWindows()) {
    const scriptArgs: string[] = ["-Json"];
    if (args.clearData === true) {
      scriptArgs.push("-ClearData");
    }
    if (args.clearAgentHome === true) {
      scriptArgs.push("-ClearAgentHome");
    }
    if (safeLocalRoot) {
      scriptArgs.push("-LocalRoot", safeLocalRoot);
    }
    return buildWindowsPowerShellScriptInvocation({
      scriptPath: args.uninstallPath,
      scriptArgs,
    });
  }
  const scriptArgs: string[] = ["--json"];
  if (args.clearData === true) {
    scriptArgs.push("--clear-data");
  }
  if (args.clearAgentHome === true) {
    scriptArgs.push("--clear-agent-home");
  }
  if (safeLocalRoot) {
    scriptArgs.push("--local-root", safeLocalRoot);
  }
  return {
    command: "sh",
    argv: [args.uninstallPath, ...scriptArgs],
    scriptPath: args.uninstallPath,
  };
}

function previewText(text: string, limit = 240) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit)}...`;
}

const STREAM_CHUNK_SIZE = 1800;

function appendCtlStreamChunks(args: {
  operation: string;
  stream: "stdout" | "stderr";
  text: string;
  level: "info" | "warn" | "error";
}) {
  const normalized = String(args.text || "");
  if (!normalized) {
    return;
  }
  const chunks: string[] = [];
  for (let offset = 0; offset < normalized.length; offset += STREAM_CHUNK_SIZE) {
    chunks.push(normalized.slice(offset, offset + STREAM_CHUNK_SIZE));
  }
  const total = chunks.length;
  for (let i = 0; i < chunks.length; i++) {
    appendSkillRunnerLocalDeployDebugLog({
      level: args.level,
      operation: `${args.operation}-${args.stream}-chunk`,
      stage: `${args.operation}-${args.stream}-chunk`,
      message: `${args.operation} ${args.stream} chunk ${i + 1}/${total}`,
      details: {
        stream: args.stream,
        chunkIndex: i + 1,
        chunkCount: total,
        streamChunk: chunks[i],
      },
    });
  }
}

function appendCtlLog(args: {
  level: "info" | "warn" | "error";
  operation: string;
  message: string;
  result?: SkillRunnerCtlCommandResult;
}) {
  appendSkillRunnerLocalDeployDebugLog({
    level: args.level,
    operation: args.operation,
    stage: args.operation,
    message: args.message,
    details: args.result
      ? {
          ok: args.result.ok,
          exitCode: args.result.exitCode,
          command: args.result.command,
          args: args.result.args,
          message: args.result.message,
          stdoutPreview: previewText(args.result.stdout),
          stderrPreview: previewText(args.result.stderr),
          stdoutBytes: args.result.stdout.length,
          stderrBytes: args.result.stderr.length,
          details: args.result.details,
        }
      : undefined,
  });
  if (!args.result) {
    return;
  }
  appendCtlStreamChunks({
    operation: args.operation,
    stream: "stdout",
    text: args.result.stdout,
    level: "info",
  });
  appendCtlStreamChunks({
    operation: args.operation,
    stream: "stderr",
    text: args.result.stderr,
    level: args.result.ok ? "info" : "warn",
  });
}

export class SkillRunnerCtlBridge {
  private readonly runCommandImpl: NonNullable<SkillRunnerCtlBridgeDeps["runCommand"]>;

  private readonly shouldPreflightScripts: boolean;

  constructor(deps: SkillRunnerCtlBridgeDeps = {}) {
    this.runCommandImpl =
      deps.runCommand ||
      (async (args) =>
        runCommand({
          command: args.command,
          argv: args.args,
          cwd: args.cwd,
          timeoutMs: args.timeoutMs,
        }));
    this.shouldPreflightScripts = !deps.runCommand;
  }

  resolveCtlPathFromInstallDir(installDir: string) {
    const normalizedInstallDir = normalizeString(installDir);
    if (!normalizedInstallDir) {
      return "";
    }
    return joinFsPath(
      normalizedInstallDir,
      "scripts",
      detectWindows() ? "skill-runnerctl.ps1" : "skill-runnerctl",
    );
  }

  async runSystemCommand(args: {
    command: string;
    args: string[];
    cwd?: string;
    timeoutMs?: number;
  }): Promise<SkillRunnerCtlCommandResult> {
    const output = await this.runCommandImpl({
      command: args.command,
      args: args.args,
      cwd: args.cwd,
      timeoutMs: args.timeoutMs,
    });
    const ok = output.exitCode === 0;
    return {
      ok,
      exitCode: output.exitCode,
      message:
        normalizeString(output.stderr) ||
        normalizeString(output.stdout) ||
        `${args.command} exited with code ${output.exitCode}`,
      stdout: output.stdout,
      stderr: output.stderr,
      details: {},
      command: args.command,
      args: args.args,
    };
  }

  async runCtlCommand(args: CtlArgs): Promise<SkillRunnerCtlCommandResult> {
    const invocation = buildCtlInvocation(args);
    if (this.shouldPreflightScripts) {
      if (!(await pathExists(args.ctlPath))) {
        return {
          ok: false,
          exitCode: 2,
          message: `ctl script not found: ${normalizeString(args.ctlPath)}`,
          stdout: "",
          stderr: "",
          details: {
            ctlPath: normalizeString(args.ctlPath),
          },
          command: invocation.command,
          args: invocation.argv,
        };
      }
    }
    const output = await this.runCommandImpl({
      command: invocation.command,
      args: invocation.argv,
      timeoutMs: 10 * 60 * 1000,
    });
    const result = normalizeCtlResult({
      output,
      command: invocation.command,
      argv: invocation.argv,
      fallbackMessage: `ctl ${args.command} finished`,
    });
    appendCtlLog({
      level: result.ok ? "info" : "warn",
      operation: `local-ctl-${args.command}`,
      message: result.ok
        ? `skill-runner ctl ${args.command} succeeded`
        : `skill-runner ctl ${args.command} failed`,
      result,
    });
    return result;
  }

  async runUninstallCommand(args: UninstallArgs): Promise<SkillRunnerCtlCommandResult> {
    const invocation = buildUninstallInvocation(args);
    if (this.shouldPreflightScripts) {
      if (!(await pathExists(args.uninstallPath))) {
        return {
          ok: false,
          exitCode: 2,
          message: `uninstall script not found: ${normalizeString(args.uninstallPath)}`,
          stdout: "",
          stderr: "",
          details: {
            uninstallPath: normalizeString(args.uninstallPath),
          },
          command: invocation.command,
          args: invocation.argv,
        };
      }
    }
    const output = await this.runCommandImpl({
      command: invocation.command,
      args: invocation.argv,
      timeoutMs: 10 * 60 * 1000,
    });
    const result = normalizeCtlResult({
      output,
      command: invocation.command,
      argv: invocation.argv,
      fallbackMessage: "uninstall finished",
    });
    appendCtlLog({
      level: result.ok ? "info" : "warn",
      operation: "local-uninstall",
      message: result.ok
        ? "skill-runner uninstall succeeded"
        : "skill-runner uninstall failed",
      result,
    });
    return result;
  }

}
