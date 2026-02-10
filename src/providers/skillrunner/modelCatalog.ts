type SkillRunnerManifestSnapshot = {
  version: string;
  file: string;
};

type SkillRunnerManifest = {
  engine: string;
  snapshots: SkillRunnerManifestSnapshot[];
};

type SkillRunnerModelEntry = {
  id: string;
  display_name: string;
  deprecated?: boolean;
};

type SkillRunnerModelsSnapshot = {
  engine: string;
  version: string;
  models: SkillRunnerModelEntry[];
};

type SkillRunnerModelOption = {
  value: string;
  label: string;
};

const MODEL_MANIFESTS: SkillRunnerManifest[] = [
  {
    engine: "codex",
    snapshots: [
      { version: "0.0.0", file: "models_0.0.0.json" },
      { version: "0.89.0", file: "models_0.89.0.json" },
    ],
  },
  {
    engine: "gemini",
    snapshots: [
      { version: "0.0.0", file: "models_0.0.0.json" },
      { version: "0.25.2", file: "models_0.25.2.json" },
    ],
  },
  {
    engine: "iflow",
    snapshots: [
      { version: "0.0.0", file: "models_0.0.0.json" },
      { version: "0.5.2", file: "models_0.5.2.json" },
    ],
  },
];

const MODEL_SNAPSHOTS: SkillRunnerModelsSnapshot[] = [
  {
    engine: "codex",
    version: "0.0.0",
    models: [{ id: "gpt-5-codex", display_name: "GPT-5 Codex" }],
  },
  {
    engine: "codex",
    version: "0.89.0",
    models: [
      { id: "gpt-5.1-codex-mini", display_name: "GPT-5.1 Codex Mini" },
      { id: "gpt-5.1-codex-max", display_name: "GPT-5.1 Codex Max" },
      { id: "gpt-5.2", display_name: "GPT-5.2" },
      { id: "gpt-5.2-codex", display_name: "GPT-5.2 Codex" },
    ],
  },
  {
    engine: "gemini",
    version: "0.0.0",
    models: [{ id: "gemini-3-pro-preview", display_name: "Gemini 3 Pro Preview" }],
  },
  {
    engine: "gemini",
    version: "0.25.2",
    models: [
      { id: "gemini-3-pro-preview", display_name: "Gemini 3 Pro Preview" },
      { id: "gemini-3-flash-preview", display_name: "Gemini 3 Flash Preview" },
      { id: "gemini-2.5-pro", display_name: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", display_name: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-flash-lite", display_name: "Gemini 2.5 Flash Lite" },
    ],
  },
  {
    engine: "iflow",
    version: "0.0.0",
    models: [{ id: "gpt-4", display_name: "GPT-4" }],
  },
  {
    engine: "iflow",
    version: "0.5.2",
    models: [
      { id: "glm-4.7", display_name: "GLM 4.7" },
      { id: "iflow-rome-30ba3b", display_name: "iFlow ROME 30BA3B" },
      { id: "deepseek-v3.2", display_name: "DeepSeek V3.2" },
      { id: "qwen3-coder-plus", display_name: "Qwen3 Coder Plus" },
      { id: "kimi-k2-thinking", display_name: "Kimi K2 Thinking" },
      { id: "minimax-m2.1", display_name: "MiniMax M2.1" },
      { id: "kimi-k2-0905", display_name: "Kimi K2 0905" },
    ],
  },
];

function compareSemver(a: string, b: string) {
  const aParts = String(a || "")
    .split(".")
    .map((entry) => Number(entry));
  const bParts = String(b || "")
    .split(".")
    .map((entry) => Number(entry));
  const maxLength = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLength; i++) {
    const aPart = Number.isFinite(aParts[i]) ? aParts[i] : 0;
    const bPart = Number.isFinite(bParts[i]) ? bParts[i] : 0;
    if (aPart === bPart) {
      continue;
    }
    return aPart > bPart ? 1 : -1;
  }
  return 0;
}

function toModelOptions(models: SkillRunnerModelEntry[]) {
  return models.map((entry) => ({
    value: entry.id,
    label: entry.display_name || entry.id,
  }));
}

function getLatestSnapshot(engine: string) {
  const manifest = MODEL_MANIFESTS.find((entry) => entry.engine === engine);
  if (!manifest || manifest.snapshots.length === 0) {
    return null;
  }
  const sorted = [...manifest.snapshots].sort((left, right) =>
    compareSemver(left.version, right.version),
  );
  const latest = sorted[sorted.length - 1];
  return (
    MODEL_SNAPSHOTS.find(
      (entry) =>
        entry.engine === engine && entry.version === latest.version,
    ) || null
  );
}

export function listSkillRunnerEngines() {
  return MODEL_MANIFESTS.map((entry) => entry.engine);
}

export function getDefaultSkillRunnerEngine() {
  const engines = listSkillRunnerEngines();
  if (engines.includes("gemini")) {
    return "gemini";
  }
  return engines[0] || "";
}

export function listSkillRunnerModelOptions(engine: string): SkillRunnerModelOption[] {
  const normalizedEngine = String(engine || "").trim();
  if (!normalizedEngine) {
    return [];
  }
  const snapshot = getLatestSnapshot(normalizedEngine);
  if (!snapshot) {
    return [];
  }
  return toModelOptions(snapshot.models).filter((entry) => String(entry.value || "").trim());
}

export function normalizeSkillRunnerModel(engine: string, model: unknown) {
  const value = typeof model === "string" ? model.trim() : "";
  if (!value) {
    return "";
  }
  const options = listSkillRunnerModelOptions(engine);
  if (!options.some((entry) => entry.value === value)) {
    return "";
  }
  return value;
}
