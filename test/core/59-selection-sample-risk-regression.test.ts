import { assert } from "chai";
import { config } from "../../package.json";
import { sampleSelectionContext } from "../../src/modules/selectionSample";

describe("selection sample risk regression", function () {
  let previousAddon: unknown;
  let previousGetMainWindow: unknown;
  let previousOutputDirPref: unknown;
  const prefKey = `${config.prefsPrefix}.sampleOutputDir`;

  beforeEach(function () {
    const runtime = globalThis as { addon?: Record<string, unknown> };
    previousAddon = runtime.addon;
    runtime.addon = runtime.addon || {};
    runtime.addon.data = (runtime.addon.data as Record<string, unknown>) || {};

    previousGetMainWindow = Zotero.getMainWindow;
    previousOutputDirPref = Zotero.Prefs.get(prefKey, true);
  });

  afterEach(function () {
    const runtime = globalThis as { addon?: unknown };
    runtime.addon = previousAddon;
    Zotero.getMainWindow = previousGetMainWindow as typeof Zotero.getMainWindow;

    if (typeof previousOutputDirPref === "undefined") {
      Zotero.Prefs.clear(prefKey, true);
    } else {
      Zotero.Prefs.set(prefKey, previousOutputDirPref, true);
    }
  });

  it("Risk: MR-03 alerts when sample output directory is missing", async function () {
    const alerts: string[] = [];
    Zotero.Prefs.clear(prefKey, true);
    Zotero.getMainWindow = (() =>
      ({
        alert: (message: unknown) => {
          alerts.push(String(message || ""));
        },
        ZoteroPane: {
          getSelectedItems: () => [],
        },
      }) as _ZoteroTypes.MainWindow) as typeof Zotero.getMainWindow;

    await sampleSelectionContext();

    assert.lengthOf(alerts, 1);
    assert.match(alerts[0], /sample-output-dir-missing|采样输出目录|输出目录/i);
  });

  it("Risk: MR-03 surfaces filesystem errors from sample export path", async function () {
    const alerts: string[] = [];
    Zotero.Prefs.set(prefKey, "D:/tmp/zotero-skills-sample", true);
    Zotero.getMainWindow = (() =>
      ({
        alert: (message: unknown) => {
          alerts.push(String(message || ""));
        },
        ZoteroPane: {
          getSelectedItems: () => [],
        },
      }) as _ZoteroTypes.MainWindow) as typeof Zotero.getMainWindow;

    const originalCreateDir = Zotero.File.createDirectoryIfMissingAsync;
    Zotero.File.createDirectoryIfMissingAsync = (async () => {
      throw new Error("mkdir blocked");
    }) as typeof Zotero.File.createDirectoryIfMissingAsync;

    try {
      await sampleSelectionContext();
    } finally {
      Zotero.File.createDirectoryIfMissingAsync = originalCreateDir;
    }

    assert.lengthOf(alerts, 1);
    assert.match(alerts[0], /sample failed/i);
    assert.match(alerts[0], /mkdir blocked/i);
  });
});
