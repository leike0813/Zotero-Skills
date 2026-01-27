import Ajv, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { config } from "../../package.json";
import selectionContextSchema from "../schemas/selectionContextSchema";
import { buildSelectionContext, type SelectionContext } from "./selectionContext";
import { getString } from "../utils/locale";
import { getPref } from "../utils/prefs";

const ajvLogger = {
  log: () => {},
  warn: () => {},
  error: () => {},
};
let validateSelectionSchema: ValidateFunction<SelectionContext> | null = null;

function getSelectionValidator() {
  if (!validateSelectionSchema) {
    const ajv = new Ajv({ allErrors: true, strict: true, logger: ajvLogger });
    addFormats(ajv);
    validateSelectionSchema = ajv.compile(selectionContextSchema);
  }
  return validateSelectionSchema;
}

export function registerSelectionSampleMenu() {
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: `${config.addonRef}-sample-selection`,
    label: getString("menuitem-sample-selection"),
    commandListener: () => {
      void sampleSelectionContext();
    },
  });
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: `${config.addonRef}-validate-selection`,
    label: getString("menuitem-validate-selection"),
    commandListener: () => {
      void validateSelectionContext();
    },
  });
}

export async function sampleSelectionContext() {
  try {
    const outputDir = getPref("sampleOutputDir");
    if (!outputDir) {
      showAlert(getString("sample-output-dir-missing"));
      return;
    }

    const zoteroPane = Zotero.getMainWindow?.()?.ZoteroPane || null;
    const items = zoteroPane?.getSelectedItems?.() || [];
    const context = await buildSelectionContext(items);
    await Zotero.File.createDirectoryIfMissingAsync(outputDir);
    const filename = `selection-context-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    const filePath = joinPath(outputDir, filename);
    await Zotero.File.putContentsAsync(
      filePath,
      JSON.stringify(context, null, 2),
    );
    new ztoolkit.ProgressWindow(config.addonName)
      .createLine({
        text: getString("sample-output-saved", { args: { path: filePath } }),
        type: "success",
        progress: 100,
      })
      .show();
  } catch (error) {
    showAlert(`${config.addonName} sample failed: ${String(error)}`);
  }
}

function showAlert(message: string) {
  const win = Zotero.getMainWindow?.();
  if (win?.alert) {
    win.alert(message);
    return;
  }
  if (typeof ztoolkit !== "undefined" && ztoolkit.getGlobal) {
    ztoolkit.getGlobal("alert")?.(message);
  }
}

function joinPath(dir: string, filename: string) {
  if (typeof PathUtils !== "undefined") {
    return PathUtils.join(dir, filename);
  }
  if (typeof OS !== "undefined" && OS.Path?.join) {
    return OS.Path.join(dir, filename);
  }
  const sep = Zotero.isWin ? "\\" : "/";
  return dir.endsWith(sep) ? `${dir}${filename}` : `${dir}${sep}${filename}`;
}

async function validateSelectionContext() {
  try {
    const zoteroPane = Zotero.getMainWindow?.()?.ZoteroPane || null;
    const items = zoteroPane?.getSelectedItems?.() || [];
    const context = await buildSelectionContext(items);
    const validate = getSelectionValidator();
    const valid = validate(context);
    if (valid) {
      new ztoolkit.ProgressWindow(config.addonName)
        .createLine({
          text: getString("validate-selection-ok"),
          type: "success",
          progress: 100,
        })
        .show();
      return;
    }
    const errors = (validate.errors || [])
      .map((error: ErrorObject) => `${error.instancePath || "/"} ${error.message || ""}`)
      .join("; ");
    showAlert(`${getString("validate-selection-failed")}: ${errors}`);
  } catch (error) {
    showAlert(`${config.addonName} validate failed: ${String(error)}`);
  }
}
