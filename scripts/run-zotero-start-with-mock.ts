import { spawn } from "child_process";

type Child = ReturnType<typeof spawn>;
type SpawnOptions = Parameters<typeof spawn>[2];

const MOCK_PORT = process.env.ZOTERO_MOCK_SKILLRUNNER_PORT || "8030";
const MOCK_HOST = process.env.ZOTERO_MOCK_SKILLRUNNER_HOST || "127.0.0.1";
const TARGET_START_SCRIPT = process.argv[2] || "start:raw";
const TARGET_START_ARGS = process.argv.slice(3);

function spawnNpm(args: string[], options?: SpawnOptions) {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", "npm", ...args], {
      ...options,
      windowsHide: true,
    });
  }
  return spawn("npm", args, options);
}

function toExitCode(code: number | null, signal: NodeJS.Signals | null) {
  if (typeof code === "number") {
    return code;
  }
  if (signal === "SIGINT") {
    return 130;
  }
  if (signal === "SIGTERM") {
    return 143;
  }
  return 1;
}

function waitForMockReady(mock: Child, timeoutMs = 8000) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(
        new Error(
          `mock skillrunner did not become ready within ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      process.stdout.write(text);
      if (text.includes("mock skillrunner started") || text.includes("baseUrl=")) {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    };

    mock.stdout?.on("data", onData);
    mock.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk.toString("utf8"));
    });
    mock.on("exit", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(
        new Error(
          `mock skillrunner exited before ready (code=${String(code)} signal=${String(signal)})`,
        ),
      );
    });
  });
}

function runTargetStart(env: NodeJS.ProcessEnv) {
  return new Promise<{ proc: Child; exit: Promise<number> }>((resolve) => {
    const args = ["run", TARGET_START_SCRIPT];
    if (TARGET_START_ARGS.length > 0) {
      args.push("--", ...TARGET_START_ARGS);
    }
    const proc = spawnNpm(args, {
      stdio: "inherit",
      env,
      detached: process.platform !== "win32",
    });
    const exit = new Promise<number>((done) => {
      proc.on("exit", (code, signal) => {
        done(toExitCode(code, signal));
      });
    });
    resolve({ proc, exit });
  });
}

function terminateChild(child: Child | null, detached = false) {
  return new Promise<void>((resolve) => {
    if (!child || !child.pid || child.exitCode !== null) {
      resolve();
      return;
    }

    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.on("exit", () => resolve());
      return;
    }

    try {
      if (detached) {
        process.kill(-child.pid, "SIGTERM");
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      // ignore
    }
    resolve();
  });
}

async function main() {
  const env: NodeJS.ProcessEnv = { ...process.env };
  console.log(`[mock-skillrunner] ${MOCK_HOST}:${MOCK_PORT}`);
  if (TARGET_START_ARGS.length > 0) {
    console.log(`[start-args] ${TARGET_START_ARGS.join(" ")}`);
  }

  const mock = spawnNpm(
    [
      "run",
      "mock:skillrunner",
      "--",
      "--host",
      MOCK_HOST,
      "--port",
      MOCK_PORT,
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env,
      detached: process.platform !== "win32",
    },
  );

  let target: Child | null = null;
  let cleaned = false;

  const cleanup = async () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    await terminateChild(target, process.platform !== "win32");
    await terminateChild(mock, process.platform !== "win32");
  };

  const trap = async (exitCode: number) => {
    await cleanup();
    process.exit(exitCode);
  };

  process.on("SIGINT", () => {
    void trap(130);
  });
  process.on("SIGTERM", () => {
    void trap(143);
  });
  process.on("uncaughtException", (error) => {
    console.error(error);
    void trap(1);
  });
  process.on("unhandledRejection", (reason) => {
    console.error(reason);
    void trap(1);
  });

  try {
    await waitForMockReady(mock);
    const { proc, exit } = await runTargetStart(env);
    target = proc;
    const code = await exit;
    await cleanup();
    process.exit(code);
  } catch (error) {
    console.error(error);
    await cleanup();
    process.exit(1);
  }
}

void main();
