import { spawn } from "child_process";

type GateName = "pr" | "release";

function spawnNpm(args: string[]) {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", "npm", ...args], {
      stdio: "inherit",
      windowsHide: true,
    });
  }
  return spawn("npm", args, { stdio: "inherit" });
}

function normalizeGateName(value: string): GateName {
  return value.trim().toLowerCase() === "release" ? "release" : "pr";
}

function getSuiteCommand(gate: GateName) {
  if (gate === "release") {
    return "test:full";
  }
  return "test:lite";
}

async function main() {
  const gate = normalizeGateName(process.argv[2] || "pr");
  const suiteCommand = getSuiteCommand(gate);
  console.log(
    `[ci-gate] gate=${gate} suite=${suiteCommand} blocking=true start=${new Date().toISOString()}`,
  );
  const child = spawnNpm(["run", suiteCommand]);
  const exitCode = await new Promise<number>((resolve) => {
    child.on("exit", (code) => {
      resolve(typeof code === "number" ? code : 1);
    });
  });
  if (exitCode !== 0) {
    console.error(
      `[ci-gate] gate=${gate} result=failed exitCode=${exitCode} blocking=true`,
    );
    process.exit(exitCode);
    return;
  }
  console.log(`[ci-gate] gate=${gate} result=passed blocking=true`);
}

void main();
