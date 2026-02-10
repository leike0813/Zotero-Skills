import { spawn } from "child_process";
import path from "path";

type Child = ReturnType<typeof spawn>;
type SpawnOptions = Parameters<typeof spawn>[2];

const MOCK_PORT = "8030";
const MOCK_HOST = "127.0.0.1";
const TARGET_TEST_SCRIPT = process.argv[2] || "test:zotero:raw";
const REQUESTED_TEST_MODE = process.argv[3] || process.env.ZOTERO_TEST_MODE || "lite";
const TEST_WORKFLOW_DIR = path.join(process.cwd(), "workflows");

function normalizeTestMode(value: string) {
  return value.trim().toLowerCase() === "full" ? "full" : "lite";
}

const TEST_MODE = normalizeTestMode(REQUESTED_TEST_MODE);

function spawnNpm(args: string[], options?: SpawnOptions) {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", "npm", ...args], {
      ...options,
      windowsHide: true,
    });
  }
  return spawn("npm", args, options);
}

function waitForMockReady(mock: Child, timeoutMs = 8000) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(`mock skillrunner did not become ready within ${timeoutMs}ms`));
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

function runTargetTests(env: NodeJS.ProcessEnv) {
  return new Promise<number>((resolve) => {
    const proc = spawnNpm(["run", TARGET_TEST_SCRIPT], {
      stdio: "inherit",
      env,
    });
    proc.on("exit", (code, signal) => {
      if (typeof code === "number") {
        resolve(code);
        return;
      }
      if (signal === "SIGINT") {
        resolve(130);
        return;
      }
      if (signal === "SIGTERM") {
        resolve(143);
        return;
      }
      resolve(1);
    });
  });
}

function terminateMock(mock: Child) {
  return new Promise<void>((resolve) => {
    if (!mock.pid) {
      resolve();
      return;
    }
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/PID", String(mock.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.on("exit", () => resolve());
      return;
    }
    try {
      process.kill(-mock.pid, "SIGTERM");
      resolve();
    } catch {
      try {
        mock.kill("SIGTERM");
      } catch {
        // ignore
      }
      resolve();
    }
  });
}

async function main() {
  const testEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ZOTERO_TEST_MODE: TEST_MODE,
    ZOTERO_TEST_WORKFLOW_DIR: TEST_WORKFLOW_DIR,
  };
  console.log(`[test-mode] ${TEST_MODE}`);
  console.log(`[test-workflow-dir] ${TEST_WORKFLOW_DIR}`);

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
      env: testEnv,
      detached: process.platform !== "win32",
    },
  );

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    await terminateMock(mock);
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
    const code = await runTargetTests(testEnv);
    await cleanup();
    process.exit(code);
  } catch (error) {
    console.error(error);
    await cleanup();
    process.exit(1);
  }
}

void main();
