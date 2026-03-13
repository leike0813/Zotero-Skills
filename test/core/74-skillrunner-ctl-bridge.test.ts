import { assert } from "chai";
import { SkillRunnerCtlBridge } from "../../src/modules/skillRunnerCtlBridge";

describe("skillrunner ctl bridge", function () {
  it("normalizes ctl --json response payload", async function () {
    const bridge = new SkillRunnerCtlBridge({
      runCommand: async () => ({
        exitCode: 0,
        stdout: JSON.stringify({
          ok: true,
          exit_code: 0,
          status: "running",
          message: "Local runtime status: running.",
        }),
        stderr: "",
      }),
    });

    const result = await bridge.runCtlCommand({
      ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
      command: "status",
      mode: "local",
      port: 8000,
    });

    assert.isTrue(result.ok);
    assert.equal(result.exitCode, 0);
    assert.equal(result.details?.status, "running");
    assert.equal(result.message, "Local runtime status: running.");
  });

  it("treats non-zero exit as failed when payload does not override ok", async function () {
    const bridge = new SkillRunnerCtlBridge({
      runCommand: async () => ({
        exitCode: 5,
        stdout: "runtime failed",
        stderr: "stderr detail",
      }),
    });

    const result = await bridge.runCtlCommand({
      ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
      command: "status",
      mode: "local",
      port: 8000,
    });

    assert.isFalse(result.ok);
    assert.equal(result.exitCode, 5);
    assert.include(result.message, "stderr detail");
  });

  it("supports bootstrap command with json mode", async function () {
    const commands: Array<{ command: string; args: string[] }> = [];
    const bridge = new SkillRunnerCtlBridge({
      runCommand: async (args) => {
        commands.push({ command: args.command, args: args.args });
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            ok: true,
            exit_code: 0,
            message: "Bootstrap completed.",
          }),
          stderr: "",
        };
      },
    });

    const result = await bridge.runCtlCommand({
      ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
      command: "bootstrap",
    });

    assert.isTrue(result.ok);
    assert.equal(commands.length, 1);
    const commandScript = commands[0].args[commands[0].args.length - 1] || "";
    assert.include(commandScript, "bootstrap");
    assert.include(commandScript, "--json");
  });

  it("supports preflight command with host/port/fallback args", async function () {
    const commands: Array<{ command: string; args: string[] }> = [];
    const bridge = new SkillRunnerCtlBridge({
      runCommand: async (args) => {
        commands.push({ command: args.command, args: args.args });
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            ok: true,
            exit_code: 0,
            message: "Preflight completed.",
          }),
          stderr: "",
        };
      },
    });

    const result = await bridge.runCtlCommand({
      ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
      command: "preflight",
      host: "127.0.0.1",
      port: 29813,
      portFallbackSpan: 10,
    });

    assert.isTrue(result.ok);
    assert.equal(commands.length, 1);
    const commandScript = commands[0].args[commands[0].args.length - 1] || "";
    assert.include(commandScript, "preflight");
    assert.include(commandScript, "--host");
    assert.include(commandScript, "127.0.0.1");
    assert.include(commandScript, "--port");
    assert.include(commandScript, "29813");
    assert.include(commandScript, "--port-fallback-span");
    assert.include(commandScript, "10");
    assert.include(commandScript, "--json");
  });

  it("passes --port-fallback-span when running ctl up", async function () {
    const commands: Array<{ command: string; args: string[] }> = [];
    const bridge = new SkillRunnerCtlBridge({
      runCommand: async (args) => {
        commands.push({ command: args.command, args: args.args });
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            ok: true,
            exit_code: 0,
            message: "Local runtime started.",
          }),
          stderr: "",
        };
      },
    });

    const result = await bridge.runCtlCommand({
      ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
      command: "up",
      mode: "local",
      host: "127.0.0.1",
      port: 29813,
      portFallbackSpan: 10,
    });

    assert.isTrue(result.ok);
    assert.equal(commands.length, 1);
    const commandScript = commands[0].args[commands[0].args.length - 1] || "";
    assert.include(commandScript, "--port-fallback-span");
    assert.include(commandScript, "10");
  });

  it("prefers mozilla subprocess execution for windows powershell ctl commands", async function () {
    const runtime = globalThis as {
      Zotero?: {
        isWin?: boolean;
        Utilities?: {
          Internal?: {
            subprocess?: (command: string, args?: string[]) => Promise<string>;
          };
        };
      };
      ChromeUtils?: {
        import?: (
          url: string,
        ) => {
          Subprocess?: {
            call?: (args: {
              command: string;
              arguments?: string[];
            }) => Promise<{
              stdout?: unknown;
              stderr?: unknown;
              wait?: () => Promise<number>;
            }>;
          };
        };
      };
      IOUtils?: {
        exists?: (path: string) => Promise<boolean>;
      };
    };
    const zoteroRuntime = runtime.Zotero as {
      isWin?: boolean;
      Utilities?: {
        Internal?: {
          subprocess?: (command: string, args?: string[]) => Promise<string>;
        };
      };
    };
    const prevIsWin = zoteroRuntime?.isWin;
    const prevSubprocess = zoteroRuntime?.Utilities?.Internal?.subprocess;
    const prevChromeUtils = runtime.ChromeUtils;
    const prevIOUtils = runtime.IOUtils;
    let zoteroCallCount = 0;
    let mozillaCallCount = 0;
    runtime.ChromeUtils = {
      import: () => ({
        Subprocess: {
          call: async () => {
            mozillaCallCount += 1;
            return {
              stdout: {
                text: JSON.stringify({
                  ok: true,
                  exit_code: 0,
                  message: "Local runtime status: running.",
                  status: "running",
                }),
              },
              stderr: { text: "" },
              wait: async () => 0,
            };
          },
        },
      }),
    };
    runtime.IOUtils = {
      exists: async (path: string) =>
        /skill-runnerctl\.ps1$/i.test(String(path || "")),
    };
    if (!zoteroRuntime) {
      throw new Error("zotero runtime unavailable");
    }
    zoteroRuntime.isWin = true;
    zoteroRuntime.Utilities = zoteroRuntime.Utilities || {};
    zoteroRuntime.Utilities.Internal = zoteroRuntime.Utilities.Internal || {};
    zoteroRuntime.Utilities.Internal.subprocess = async () => {
      zoteroCallCount += 1;
      throw new Error("zotero subprocess should not be used");
    };
    try {
      const bridge = new SkillRunnerCtlBridge();
      const result = await bridge.runCtlCommand({
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
        command: "status",
        mode: "local",
        port: 8000,
      });
      assert.isTrue(result.ok);
      assert.equal(String(result.details?.status || ""), "running");
      assert.equal(mozillaCallCount, 1);
      assert.equal(zoteroCallCount, 0);
    } finally {
      if (zoteroRuntime) {
        zoteroRuntime.isWin = prevIsWin;
        if (!zoteroRuntime.Utilities) {
          zoteroRuntime.Utilities = {};
        }
        if (!zoteroRuntime.Utilities.Internal) {
          zoteroRuntime.Utilities.Internal = {};
        }
        if (typeof prevSubprocess === "undefined") {
          delete zoteroRuntime.Utilities.Internal.subprocess;
        } else {
          zoteroRuntime.Utilities.Internal.subprocess = prevSubprocess;
        }
      }
      if (typeof prevChromeUtils === "undefined") {
        delete runtime.ChromeUtils;
      } else {
        runtime.ChromeUtils = prevChromeUtils;
      }
      if (typeof prevIOUtils === "undefined") {
        delete runtime.IOUtils;
      } else {
        runtime.IOUtils = prevIOUtils;
      }
    }
  });

  it("wraps windows powershell script execution with PATH/npm bootstrap command", async function () {
    const runtime = globalThis as {
      Zotero?: { isWin?: boolean };
    };
    const prevZotero = runtime.Zotero;
    runtime.Zotero = {
      ...(prevZotero || {}),
      isWin: true,
    };
    const commands: Array<{ command: string; args: string[] }> = [];
    try {
      const bridge = new SkillRunnerCtlBridge({
        runCommand: async (args) => {
          commands.push({
            command: args.command,
            args: args.args,
          });
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              ok: true,
              exit_code: 0,
              status: "running",
            }),
            stderr: "",
          };
        },
      });
      await bridge.runCtlCommand({
        ctlPath: "C:\\SkillRunner\\scripts\\skill-runnerctl.ps1",
        command: "status",
        mode: "local",
        port: 8000,
      });
    } finally {
      if (typeof prevZotero === "undefined") {
        delete runtime.Zotero;
      } else {
        runtime.Zotero = prevZotero;
      }
    }

    assert.equal(commands.length, 1);
    const first = commands[0];
    assert.equal(first.command, "powershell.exe");
    assert.include(first.args, "-Command");
    const commandScript = first.args[first.args.length - 1] || "";
    assert.include(commandScript, "Get-Command npm");
    assert.include(commandScript, "$env:PATH");
    assert.include(commandScript, "skill-runnerctl.ps1");
  });

  it("runs generic system command for release extraction", async function () {
    const bridge = new SkillRunnerCtlBridge({
      runCommand: async () => ({
        exitCode: 0,
        stdout: "ok",
        stderr: "",
      }),
    });

    const result = await bridge.runSystemCommand({
      command: "tar",
      args: ["-xzf", "artifact.tar.gz", "-C", "/tmp/release"],
    });

    assert.isTrue(result.ok);
    assert.equal(result.command, "tar");
    assert.equal(result.exitCode, 0);
  });

  it("falls through to zotero subprocess when mozilla subprocess returns executable-not-found stderr", async function () {
    const runtime = globalThis as {
      Zotero?: {
        isWin?: boolean;
        Utilities?: {
          Internal?: {
            subprocess?: (command: string, args?: string[]) => Promise<string>;
          };
        };
      };
      ChromeUtils?: {
        import?: (
          url: string,
        ) => {
          Subprocess?: {
            call?: (args: {
              command: string;
              arguments?: string[];
            }) => Promise<{
              stdout?: unknown;
              stderr?: unknown;
              wait?: () => Promise<number>;
            }>;
          };
        };
      };
    };
    const zoteroRuntime = runtime.Zotero as {
      isWin?: boolean;
      Utilities?: {
        Internal?: {
          subprocess?: (command: string, args?: string[]) => Promise<string>;
        };
      };
    };
    const prevIsWin = zoteroRuntime?.isWin;
    const prevSubprocess = zoteroRuntime?.Utilities?.Internal?.subprocess;
    const prevChromeUtils = runtime.ChromeUtils;
    const calls: string[] = [];
    runtime.ChromeUtils = {
      import: () => ({
        Subprocess: {
          call: async () => ({
            stdout: { text: "" },
            stderr: { text: "Executable not found: tar" },
            wait: async () => 1,
          }),
        },
      }),
    };
    if (!zoteroRuntime) {
      throw new Error("zotero runtime unavailable");
    }
    zoteroRuntime.isWin = true;
    zoteroRuntime.Utilities = zoteroRuntime.Utilities || {};
    zoteroRuntime.Utilities.Internal = zoteroRuntime.Utilities.Internal || {};
    zoteroRuntime.Utilities.Internal.subprocess = async (command: string) => {
      calls.push(command);
      if (command === "tar") {
        throw new Error("Executable not found: tar");
      }
      if (/(^|[\\/])tar$/i.test(command)) {
        throw new Error(
          `File at path "${command}" does not exist, or is not executable`,
        );
      }
      if (/(^|[\\/])tar\.exe$/i.test(command)) {
        return "";
      }
      throw new Error(`Executable not found: ${command}`);
    };
    try {
      const bridge = new SkillRunnerCtlBridge();
      const result = await bridge.runSystemCommand({
        command: "tar",
        args: ["-xzf", "a.tar.gz", "-C", "C:\\tmp\\release"],
      });
      assert.isTrue(result.ok);
      assert.isAtLeast(calls.length, 2);
      assert.isTrue(calls.includes("tar"));
      assert.isTrue(
        calls.some((entry) => /(^|[\\/])tar\.exe$/i.test(entry)),
      );
    } finally {
      if (zoteroRuntime) {
        zoteroRuntime.isWin = prevIsWin;
        if (!zoteroRuntime.Utilities) {
          zoteroRuntime.Utilities = {};
        }
        if (!zoteroRuntime.Utilities.Internal) {
          zoteroRuntime.Utilities.Internal = {};
        }
        if (typeof prevSubprocess === "undefined") {
          delete zoteroRuntime.Utilities.Internal.subprocess;
        } else {
          zoteroRuntime.Utilities.Internal.subprocess = prevSubprocess;
        }
      }
      if (typeof prevChromeUtils === "undefined") {
        delete runtime.ChromeUtils;
      } else {
        runtime.ChromeUtils = prevChromeUtils;
      }
    }
  });

  it("falls back to absolute windows tar path when bare tar is not found in zotero subprocess", async function () {
    const runtime = globalThis as {
      Zotero?: {
        isWin?: boolean;
        Utilities?: {
          Internal?: {
            subprocess?: (command: string, args?: string[]) => Promise<string>;
          };
        };
      };
      ChromeUtils?: {
        import?: (url: string) => { Subprocess?: unknown };
      };
    };
    const zoteroRuntime = runtime.Zotero as {
      isWin?: boolean;
      Utilities?: {
        Internal?: {
          subprocess?: (command: string, args?: string[]) => Promise<string>;
        };
      };
    };
    const prevIsWin = zoteroRuntime?.isWin;
    const prevSubprocess = zoteroRuntime?.Utilities?.Internal?.subprocess;
    const prevChromeUtils = runtime.ChromeUtils;
    const calls: string[] = [];
    runtime.ChromeUtils = {
      import: () => {
        throw new Error("mozilla subprocess unavailable");
      },
    };
    if (!zoteroRuntime) {
      throw new Error("zotero runtime unavailable");
    }
    zoteroRuntime.isWin = true;
    zoteroRuntime.Utilities = zoteroRuntime.Utilities || {};
    zoteroRuntime.Utilities.Internal = zoteroRuntime.Utilities.Internal || {};
    zoteroRuntime.Utilities.Internal.subprocess = async (command: string) => {
      calls.push(command);
      if (command === "tar") {
        throw new Error("Executable not found: tar");
      }
      if (/(^|[\\/])tar\.exe$/i.test(command)) {
        return "";
      }
      throw new Error(`Executable not found: ${command}`);
    };
    try {
      const bridge = new SkillRunnerCtlBridge();
      const result = await bridge.runSystemCommand({
        command: "tar",
        args: ["-xzf", "a.tar.gz", "-C", "C:\\tmp\\release"],
      });
      assert.isTrue(result.ok);
      assert.isAtLeast(calls.length, 2);
      assert.isTrue(calls.includes("tar"));
      assert.isTrue(
        calls.some((entry) => /(^|[\\/])tar\.exe$/i.test(entry)),
      );
    } finally {
      if (!zoteroRuntime) {
        // no-op
      } else {
        zoteroRuntime.isWin = prevIsWin;
        if (!zoteroRuntime.Utilities) {
          zoteroRuntime.Utilities = {};
        }
        if (!zoteroRuntime.Utilities.Internal) {
          zoteroRuntime.Utilities.Internal = {};
        }
        if (typeof prevSubprocess === "undefined") {
          delete zoteroRuntime.Utilities.Internal.subprocess;
        } else {
          zoteroRuntime.Utilities.Internal.subprocess = prevSubprocess;
        }
      }
      if (typeof prevChromeUtils === "undefined") {
        delete runtime.ChromeUtils;
      } else {
        runtime.ChromeUtils = prevChromeUtils;
      }
    }
  });

  it("resolves command path via windows Get-Command before fallback candidates", async function () {
    const runtime = globalThis as {
      Zotero?: {
        isWin?: boolean;
        Utilities?: {
          Internal?: {
            subprocess?: (command: string, args?: string[]) => Promise<string>;
          };
        };
      };
      ChromeUtils?: {
        import?: (url: string) => { Subprocess?: unknown };
      };
    };
    const zoteroRuntime = runtime.Zotero as {
      isWin?: boolean;
      Utilities?: {
        Internal?: {
          subprocess?: (command: string, args?: string[]) => Promise<string>;
        };
      };
    };
    const prevIsWin = zoteroRuntime?.isWin;
    const prevSubprocess = zoteroRuntime?.Utilities?.Internal?.subprocess;
    const prevChromeUtils = runtime.ChromeUtils;
    const calls: string[] = [];
    runtime.ChromeUtils = {
      import: () => {
        throw new Error("mozilla subprocess unavailable");
      },
    };
    if (!zoteroRuntime) {
      throw new Error("zotero runtime unavailable");
    }
    zoteroRuntime.isWin = true;
    zoteroRuntime.Utilities = zoteroRuntime.Utilities || {};
    zoteroRuntime.Utilities.Internal = zoteroRuntime.Utilities.Internal || {};
    zoteroRuntime.Utilities.Internal.subprocess = async (
      command: string,
      args?: string[],
    ) => {
      calls.push(command);
      if (command.toLowerCase().includes("powershell")) {
        const joinedArgs = (args || []).join(" ");
        if (joinedArgs.includes("Get-Command")) {
          return "C:\\Windows\\System32\\tar.exe\n";
        }
      }
      if (/(^|[\\/])tar\.exe$/i.test(command)) {
        return "";
      }
      throw new Error(`Executable not found: ${command}`);
    };
    try {
      const bridge = new SkillRunnerCtlBridge();
      const result = await bridge.runSystemCommand({
        command: "tar",
        args: ["-xzf", "a.tar.gz", "-C", "C:\\tmp\\release"],
      });
      assert.isTrue(result.ok);
      assert.isTrue(
        calls.some((entry) => entry.toLowerCase().includes("powershell")),
      );
      assert.isTrue(
        calls.some((entry) => /(^|[\\/])tar\.exe$/i.test(entry)),
      );
    } finally {
      if (zoteroRuntime) {
        zoteroRuntime.isWin = prevIsWin;
        if (!zoteroRuntime.Utilities) {
          zoteroRuntime.Utilities = {};
        }
        if (!zoteroRuntime.Utilities.Internal) {
          zoteroRuntime.Utilities.Internal = {};
        }
        if (typeof prevSubprocess === "undefined") {
          delete zoteroRuntime.Utilities.Internal.subprocess;
        } else {
          zoteroRuntime.Utilities.Internal.subprocess = prevSubprocess;
        }
      }
      if (typeof prevChromeUtils === "undefined") {
        delete runtime.ChromeUtils;
      } else {
        runtime.ChromeUtils = prevChromeUtils;
      }
    }
  });

  it("keeps legacy windows uninstall script invocation available for compatibility", async function () {
    const runtime = globalThis as {
      Zotero?: { isWin?: boolean };
    };
    const previousZotero = runtime.Zotero;
    runtime.Zotero = {
      ...(runtime.Zotero || {}),
      isWin: true,
    };
    const commands: Array<{ command: string; args: string[] }> = [];
    try {
      const bridge = new SkillRunnerCtlBridge({
        runCommand: async (args) => {
          commands.push({
            command: args.command,
            args: args.args,
          });
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              ok: true,
              exit_code: 0,
              message: "Uninstall completed.",
            }),
            stderr: "",
          };
        },
      });
      const result = await bridge.runUninstallCommand({
        uninstallPath: "C:\\SkillRunner\\scripts\\skill-runner-uninstall.ps1",
        localRoot: "C:\\SkillRunner",
      });
      assert.isTrue(result.ok);
      assert.equal(commands.length, 1);
      assert.equal(commands[0].command, "powershell.exe");
      const script = commands[0].args[commands[0].args.length - 1] || "";
      assert.include(script, "skill-runner-uninstall.ps1");
      assert.include(script, "-Json");
      assert.include(script, "-LocalRoot");
      assert.include(script, "C:\\SkillRunner");
      assert.notInclude(script, "'-Json'");
      assert.notInclude(script, "'-LocalRoot'");
      assert.notInclude(script, "@scriptArgs");
    } finally {
      if (typeof previousZotero === "undefined") {
        delete runtime.Zotero;
      } else {
        runtime.Zotero = previousZotero;
      }
    }
  });

  it("keeps sanitizing suspicious windows uninstall localRoot argument", async function () {
    const runtime = globalThis as {
      Zotero?: { isWin?: boolean };
    };
    const previousZotero = runtime.Zotero;
    runtime.Zotero = {
      ...(runtime.Zotero || {}),
      isWin: true,
    };
    const commands: Array<{ command: string; args: string[] }> = [];
    try {
      const bridge = new SkillRunnerCtlBridge({
        runCommand: async (args) => {
          commands.push({
            command: args.command,
            args: args.args,
          });
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              ok: true,
              exit_code: 0,
              message: "Uninstall completed.",
            }),
            stderr: "",
          };
        },
      });
      const result = await bridge.runUninstallCommand({
        uninstallPath: "C:\\SkillRunner\\scripts\\skill-runner-uninstall.ps1",
        localRoot: "-Json",
      });
      assert.isTrue(result.ok);
      assert.equal(commands.length, 1);
      const script = commands[0].args[commands[0].args.length - 1] || "";
      assert.include(script, "-Json");
      assert.notInclude(script, "-LocalRoot");
      assert.notInclude(script, "@scriptArgs");
    } finally {
      if (typeof previousZotero === "undefined") {
        delete runtime.Zotero;
      } else {
        runtime.Zotero = previousZotero;
      }
    }
  });

  it("keeps legacy non-windows uninstall script invocation available for compatibility", async function () {
    const runtime = globalThis as {
      Zotero?: { isWin?: boolean };
    };
    const previousZotero = runtime.Zotero;
    if (!runtime.Zotero) {
      runtime.Zotero = {};
    }
    const previousIsWin = runtime.Zotero.isWin;
    runtime.Zotero.isWin = false;
    const commands: Array<{ command: string; args: string[] }> = [];
    try {
      const bridge = new SkillRunnerCtlBridge({
        runCommand: async (args) => {
          commands.push({
            command: args.command,
            args: args.args,
          });
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              ok: true,
              exit_code: 0,
              message: "Uninstall completed.",
            }),
            stderr: "",
          };
        },
      });
      const result = await bridge.runUninstallCommand({
        uninstallPath: "/tmp/skill-runner-uninstall.sh",
        clearData: false,
        clearAgentHome: false,
      });
      assert.isTrue(result.ok);
      assert.equal(commands.length, 1);
      assert.equal(commands[0].command, "sh");
      assert.equal(commands[0].args[0], "/tmp/skill-runner-uninstall.sh");
      assert.include(commands[0].args, "--json");
    } finally {
      if (typeof previousZotero === "undefined") {
        delete runtime.Zotero;
      } else {
        runtime.Zotero = previousZotero;
        runtime.Zotero.isWin = previousIsWin;
      }
    }
  });
});
