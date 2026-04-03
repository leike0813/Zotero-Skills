import { handlers } from "../handlers";
import {
  openWorkflowEditorSession,
  registerWorkflowEditorRenderer,
  unregisterWorkflowEditorRenderer,
} from "../modules/workflowEditorHost";
import { appendRuntimeLog } from "../modules/runtimeLogManager";
import { showWorkflowToast } from "../modules/workflowExecution/feedbackSeam";
import type { WorkflowHostApi } from "./types";

export const WORKFLOW_HOST_API_VERSION = 2;

type DynamicImport = (specifier: string) => Promise<any>;

const dynamicImport: DynamicImport = new Function(
  "specifier",
  "return import(specifier)",
) as DynamicImport;

function resolveHostAddonConfig() {
  const addonConfig =
    typeof addon !== "undefined" && addon?.data?.config
      ? addon.data.config
      : null;
  return {
    addonName: String(addonConfig?.addonName || "Zotero Skills").trim(),
    addonRef: String(addonConfig?.addonRef || "").trim(),
    prefsPrefix: String(addonConfig?.prefsPrefix || "extensions.zotero.zotero-skills")
      .trim(),
  };
}

function resolveHostItem(ref: Zotero.Item | number | string) {
  if (ref && typeof ref === "object") {
    return ref;
  }
  if (typeof ref === "number") {
    return Zotero.Items.get(ref) || null;
  }
  const key = String(ref || "").trim();
  if (!key) {
    return null;
  }
  return Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID, key) || null;
}

async function scanAllRegularItems() {
  const results: Zotero.Item[] = [];
  let misses = 0;
  for (let id = 1; id <= 50000; id += 1) {
    const item = Zotero.Items.get(id);
    if (!item) {
      misses += 1;
      if (misses >= 200) {
        break;
      }
      continue;
    }
    misses = 0;
    const regular =
      typeof item.isRegularItem === "function"
        ? item.isRegularItem()
        : !item.isNote?.() && !item.isAttachment?.();
    if (!regular) {
      continue;
    }
    const deleted =
      typeof (item as any).isDeleted === "function"
        ? (item as any).isDeleted()
        : Boolean((item as any).deleted);
    if (deleted) {
      continue;
    }
    results.push(item);
  }
  return results;
}

function resolveIOUtils() {
  const runtime = globalThis as typeof globalThis & {
    IOUtils?: {
      readUTF8?: (path: string) => Promise<string>;
      writeUTF8?: (path: string, content: string) => Promise<void>;
      exists?: (path: string) => Promise<boolean>;
      makeDirectory?: (
        path: string,
        options?: { createAncestors?: boolean },
      ) => Promise<void>;
    };
  };
  return runtime.IOUtils || null;
}

async function readText(path: string) {
  const io = resolveIOUtils();
  if (typeof io?.readUTF8 === "function") {
    return io.readUTF8(path);
  }
  const fs = await dynamicImport("fs/promises");
  return fs.readFile(path, "utf8");
}

async function writeText(path: string, content: string) {
  const io = resolveIOUtils();
  if (typeof io?.writeUTF8 === "function") {
    await io.writeUTF8(path, String(content || ""));
    return;
  }
  const fs = await dynamicImport("fs/promises");
  await fs.writeFile(path, String(content || ""), "utf8");
}

async function pathExists(path: string) {
  const io = resolveIOUtils();
  if (typeof io?.exists === "function") {
    return io.exists(path);
  }
  const fs = await dynamicImport("fs/promises");
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function makeDirectory(path: string) {
  const io = resolveIOUtils();
  if (typeof io?.makeDirectory === "function") {
    await io.makeDirectory(path, { createAncestors: true });
    return;
  }
  const fs = await dynamicImport("fs/promises");
  await fs.mkdir(path, { recursive: true });
}

let cachedHostApi: WorkflowHostApi | null = null;

export function createWorkflowHostApi(): WorkflowHostApi {
  if (cachedHostApi) {
    return cachedHostApi;
  }
  cachedHostApi = {
    version: WORKFLOW_HOST_API_VERSION,
    addon: {
      getConfig: resolveHostAddonConfig,
    },
    items: {
      get(ref) {
        return resolveHostItem(ref);
      },
      resolve(ref) {
        const item = resolveHostItem(ref);
        if (!item) {
          throw new Error(`Item not found: ${String(ref)}`);
        }
        return item;
      },
      getByLibraryAndKey(libraryID, key) {
        return Zotero.Items.getByLibraryAndKey(libraryID, String(key || "").trim()) || null;
      },
      async getAll() {
        if (typeof (Zotero.Items as any).getAll === "function") {
          try {
            const loaded = await (Zotero.Items as any).getAll();
            if (Array.isArray(loaded)) {
              return loaded;
            }
          } catch {
            // fall through to deterministic scan
          }
        }
        return scanAllRegularItems();
      },
    },
    prefs: {
      get(key, global = true) {
        return Zotero.Prefs.get(String(key || "").trim(), Boolean(global));
      },
      set(key, value, global = true) {
        Zotero.Prefs.set(String(key || "").trim(), value as any, Boolean(global));
      },
      clear(key, global = true) {
        Zotero.Prefs.clear(String(key || "").trim(), Boolean(global));
      },
    },
    parents: handlers.parent,
    notes: handlers.note,
    attachments: handlers.attachment,
    tags: handlers.tag,
    collections: handlers.collection,
    command: handlers.command,
    editor: {
      openSession: openWorkflowEditorSession,
      registerRenderer: registerWorkflowEditorRenderer,
      unregisterRenderer: unregisterWorkflowEditorRenderer,
    },
    notifications: {
      toast(args) {
        showWorkflowToast({
          text: String(args?.text || "").trim(),
          type: args?.type || "default",
        });
      },
    },
    logging: {
      appendRuntimeLog,
    },
    file: {
      pathToFile(path: string) {
        return Zotero.File.pathToFile(path);
      },
      readText,
      writeText,
      exists: pathExists,
      makeDirectory,
      getTempDirectoryPath() {
        const tempDir = Zotero.getTempDirectory?.();
        return String(tempDir?.path || "").trim();
      },
    },
  };
  return cachedHostApi;
}

export function summarizeWorkflowHostApiCapabilities(hostApi?: WorkflowHostApi | null) {
  return {
    items: !!hostApi?.items,
    prefs: !!hostApi?.prefs,
    parents: !!hostApi?.parents,
    notes: !!hostApi?.notes,
    attachments: !!hostApi?.attachments,
    tags: !!hostApi?.tags,
    collections: !!hostApi?.collections,
    editor: !!hostApi?.editor,
    notifications: !!hostApi?.notifications,
    logging: !!hostApi?.logging,
    file: !!hostApi?.file,
    addon: !!hostApi?.addon,
  };
}

export function resetWorkflowHostApiForTests() {
  cachedHostApi = null;
}
