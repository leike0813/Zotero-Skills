const dynamicImport = new Function("specifier", "return import(specifier)");

const DEFAULT_PREFS_PREFIX = "extensions.zotero.zotero-skills";
const TAG_VOCAB_PREF_SUFFIX = "tagVocabularyJson";
const ALLOWED_VALID_TAGS_FORMATS = new Set(["yaml", "json", "auto"]);
const DEFAULT_TAG_NOTE_LANGUAGE = "zh-CN";

function normalizePath(value) {
  return String(value || "").replace(/[\\/]+/g, "/").trim();
}

function toNativePath(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (/^[A-Za-z]:\//.test(text)) {
    return text.replace(/\//g, "\\");
  }
  return text;
}

function joinPath(...segments) {
  const clean = segments
    .map((entry) => String(entry || ""))
    .filter(Boolean)
    .flatMap((entry) => entry.split(/[\\/]+/))
    .filter(Boolean);
  if (clean.length === 0) {
    return "";
  }
  const first = String(segments[0] || "");
  const hasDrive = /^[A-Za-z]:/.test(first);
  const isPosixAbs = first.startsWith("/");
  const separator = hasDrive || first.includes("\\") ? "\\" : "/";
  if (hasDrive) {
    const drive = first.slice(0, 2);
    const withoutDrive =
      clean.length > 0 && clean[0].toLowerCase() === drive.toLowerCase()
        ? clean.slice(1)
        : clean;
    return toNativePath(
      `${drive}${separator}${withoutDrive.join(separator)}`,
    );
  }
  const body = clean.join(separator);
  if (isPosixAbs) {
    return `${separator}${body}`;
  }
  return toNativePath(body);
}

function resolveIOUtils() {
  const runtime = globalThis;
  const io = runtime.IOUtils;
  if (!io || typeof io !== "object") {
    return null;
  }
  return io;
}

async function ensureDirectory(targetPath) {
  const nativePath = toNativePath(targetPath);
  const io = resolveIOUtils();
  if (io?.makeDirectory) {
    await io.makeDirectory(nativePath, { createAncestors: true });
    return;
  }
  const fs = await dynamicImport("fs/promises");
  await fs.mkdir(nativePath, { recursive: true });
}

async function writeText(targetPath, content) {
  const nativePath = toNativePath(targetPath);
  const dirPath = nativePath.replace(/[\\/][^\\/]+$/, "");
  if (dirPath) {
    await ensureDirectory(dirPath);
  }
  const io = resolveIOUtils();
  if (io?.writeUTF8) {
    await io.writeUTF8(nativePath, String(content || ""));
    return;
  }
  const fs = await dynamicImport("fs/promises");
  await fs.writeFile(nativePath, String(content || ""), "utf8");
}

function resolvePrefsPrefix() {
  if (
    typeof addon !== "undefined" &&
    addon &&
    addon.data &&
    addon.data.config &&
    typeof addon.data.config.prefsPrefix === "string" &&
    addon.data.config.prefsPrefix.trim()
  ) {
    return addon.data.config.prefsPrefix.trim();
  }
  const globalAddon = globalThis?.addon;
  if (
    globalAddon &&
    globalAddon.data &&
    globalAddon.data.config &&
    typeof globalAddon.data.config.prefsPrefix === "string" &&
    globalAddon.data.config.prefsPrefix.trim()
  ) {
    return globalAddon.data.config.prefsPrefix.trim();
  }
  return DEFAULT_PREFS_PREFIX;
}

function resolveTagVocabularyPrefsKey() {
  return `${resolvePrefsPrefix()}.${TAG_VOCAB_PREF_SUFFIX}`;
}

function parsePersistedVocabularyPayload(rawText) {
  let parsed = null;
  try {
    parsed = JSON.parse(String(rawText || ""));
  } catch (error) {
    throw new Error(`tag-regulator vocabulary invalid JSON: ${String(error)}`);
  }
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.entries)) {
    return parsed.entries;
  }
  throw new Error("tag-regulator vocabulary payload must contain entries array");
}

function normalizeVocabularyTags(entries) {
  const normalized = [];
  const seen = new Set();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (typeof entry === "string") {
      const tag = entry.trim();
      if (!tag) {
        throw new Error(`tag-regulator vocabulary entry[${i}] is empty`);
      }
      if (!seen.has(tag)) {
        seen.add(tag);
        normalized.push(tag);
      }
      continue;
    }
    if (!entry || typeof entry !== "object") {
      throw new Error(`tag-regulator vocabulary entry[${i}] is invalid object`);
    }
    const tag = String(entry.tag || "").trim();
    if (!tag) {
      throw new Error(`tag-regulator vocabulary entry[${i}] missing field 'tag'`);
    }
    if (Boolean(entry.deprecated)) {
      continue;
    }
    if (!seen.has(tag)) {
      seen.add(tag);
      normalized.push(tag);
    }
  }
  return normalized.sort((left, right) =>
    left.localeCompare(right, "en", { sensitivity: "base" }),
  );
}

function loadControlledVocabularyTagsOrThrow() {
  const prefsKey = resolveTagVocabularyPrefsKey();
  const raw = Zotero.Prefs.get(prefsKey, true);
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error(`tag-regulator vocabulary missing: key='${prefsKey}'`);
  }
  const entries = parsePersistedVocabularyPayload(raw);
  const tags = normalizeVocabularyTags(entries);
  if (tags.length === 0) {
    throw new Error("tag-regulator vocabulary missing usable tags");
  }
  return tags;
}

function renderYamlTagList(tags) {
  return `${tags.map((tag) => `- ${tag}`).join("\n")}\n`;
}

async function resolveTempDirectoryPath() {
  const runtime = globalThis;
  const zoteroTemp = runtime?.Zotero?.getTempDirectory?.();
  if (zoteroTemp && typeof zoteroTemp.path === "string" && zoteroTemp.path.trim()) {
    return joinPath(zoteroTemp.path, "zotero-skills", "tag-regulator");
  }
  const os = await dynamicImport("os");
  return joinPath(os.tmpdir(), "zotero-skills", "tag-regulator");
}

async function materializeValidTagsYaml(tags, parentId) {
  const tempDir = await resolveTempDirectoryPath();
  await ensureDirectory(tempDir);
  const nonce = Math.random().toString(36).slice(2, 10);
  const fileName = `valid_tags-parent-${String(parentId || "unknown")}-${Date.now()}-${nonce}.yaml`;
  const filePath = joinPath(tempDir, fileName);
  await writeText(filePath, renderYamlTagList(tags));
  return toNativePath(filePath);
}

function resolveParentItemFromSelection(selectionContext, runtime) {
  const parentFromSelection = Number(
    selectionContext?.items?.parents?.[0]?.item?.id || 0,
  );
  if (Number.isFinite(parentFromSelection) && parentFromSelection > 0) {
    return runtime.helpers.resolveItemRef(parentFromSelection);
  }
  const parentFromAttachment = Number(
    selectionContext?.items?.attachments?.[0]?.parent?.id || 0,
  );
  if (Number.isFinite(parentFromAttachment) && parentFromAttachment > 0) {
    return runtime.helpers.resolveItemRef(parentFromAttachment);
  }
  const parentFromNote = Number(
    selectionContext?.items?.notes?.[0]?.parent?.id || 0,
  );
  if (Number.isFinite(parentFromNote) && parentFromNote > 0) {
    return runtime.helpers.resolveItemRef(parentFromNote);
  }
  throw new Error("tag-regulator buildRequest cannot resolve parent item");
}

function normalizeCreatorName(entry) {
  const raw = entry && typeof entry === "object" ? entry : {};
  const first = String(raw.firstName || "").trim();
  const last = String(raw.lastName || "").trim();
  const name = String(raw.name || "").trim();
  if (name) {
    return name;
  }
  return [first, last].filter(Boolean).join(" ").trim();
}

function collectMetadataFromParent(item) {
  const creators = Array.isArray(item.getCreators?.()) ? item.getCreators() : [];
  const creatorNames = creators
    .map((entry) => normalizeCreatorName(entry))
    .filter(Boolean);
  return {
    id: item.id,
    key: item.key,
    itemType: String(item.itemType || "").trim(),
    libraryID: item.libraryID,
    title: String(item.getField?.("title") || "").trim(),
    abstract: String(item.getField?.("abstractNote") || "").trim(),
    publication_title: String(item.getField?.("publicationTitle") || "").trim(),
    conference_name: String(item.getField?.("conferenceName") || "").trim(),
    university: String(item.getField?.("university") || "").trim(),
    date: String(item.getField?.("date") || "").trim(),
    creators: creatorNames,
  };
}

function collectInputTagsFromParent(item) {
  const tags = Array.isArray(item.getTags?.()) ? item.getTags() : [];
  const seen = new Set();
  const normalized = [];
  for (const entry of tags) {
    const text = String(entry?.tag || "").trim();
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    normalized.push(text);
  }
  return normalized;
}

function parseBooleanLike(value, fallbackValue) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const lowered = String(value || "")
    .trim()
    .toLowerCase();
  if (lowered === "true" || lowered === "1" || lowered === "yes") {
    return true;
  }
  if (lowered === "false" || lowered === "0" || lowered === "no") {
    return false;
  }
  return fallbackValue;
}

function normalizeValidTagsFormat(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (ALLOWED_VALID_TAGS_FORMATS.has(normalized)) {
    return normalized;
  }
  return "yaml";
}

function resolveRequestParameters(executionOptions) {
  const workflowParams = executionOptions?.workflowParams || {};
  const tagNoteLanguage = String(
    workflowParams.tag_note_language || DEFAULT_TAG_NOTE_LANGUAGE,
  ).trim();
  return {
    infer_tag: parseBooleanLike(workflowParams.infer_tag, true),
    valid_tags_format: normalizeValidTagsFormat(
      workflowParams.valid_tags_format || "yaml",
    ),
    tag_note_language: tagNoteLanguage || DEFAULT_TAG_NOTE_LANGUAGE,
  };
}

export async function buildRequest({
  selectionContext,
  executionOptions,
  runtime,
}) {
  try {
    const parentItem = resolveParentItemFromSelection(selectionContext, runtime);
    const metadata = collectMetadataFromParent(parentItem);
    const inputTags = collectInputTagsFromParent(parentItem);
    const controlledTags = loadControlledVocabularyTagsOrThrow();
    const validTagsPath = await materializeValidTagsYaml(
      controlledTags,
      parentItem.id,
    );
    return {
      kind: "skillrunner.job.v1",
      skill_id: "tag-regulator",
      targetParentID: parentItem.id,
      input: {
        metadata,
        input_tags: inputTags,
      },
      parameter: resolveRequestParameters(executionOptions),
      upload_files: [
        {
          key: "valid_tags",
          path: validTagsPath,
        },
      ],
      fetch_type: "result",
    };
  } catch (error) {
    throw new Error(`tag-regulator buildRequest failed: ${String(error)}`);
  }
}

export const __tagRegulatorBuildRequestTestOnly = {
  normalizePath,
  resolveTagVocabularyPrefsKey,
  parsePersistedVocabularyPayload,
  normalizeVocabularyTags,
};
