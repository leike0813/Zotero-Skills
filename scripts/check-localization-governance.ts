import { readFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const LOCALES = ["en-US", "zh-CN"] as const;
const FTL_FILES = ["addon.ftl", "preferences.ftl", "mainWindow.ftl"] as const;
const REQUIRED_ADDON_KEYS = [
  "backend-display-local-skillrunner",
  "skillrunner-local-runtime-toast-up",
  "skillrunner-local-runtime-toast-down",
  "skillrunner-local-runtime-toast-abnormal-stop",
];
const ALLOWED_CROSS_FILE_DUPLICATES = new Set([
  "pref-skillrunner-local-status-idle",
  "pref-skillrunner-local-status-working",
  "pref-skillrunner-local-status-ok-prefix",
  "pref-skillrunner-local-status-failed-prefix",
  "pref-skillrunner-local-status-conflict-prefix",
  "pref-skillrunner-local-copy-commands-copied",
]);

function readText(relPath: string) {
  const absPath = path.join(ROOT, relPath);
  return readFileSync(absPath, "utf8");
}

function parseFluentKeys(content: string) {
  return content
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => !!line && !line.startsWith("#"))
    .map((line) => {
      const match = line.match(/^([a-z0-9][a-z0-9-]*)\s*=/);
      return match ? match[1] : "";
    })
    .filter((key) => !!key);
}

function diffKeys(a: Set<string>, b: Set<string>) {
  const onlyInA: string[] = [];
  const onlyInB: string[] = [];
  for (const key of a) {
    if (!b.has(key)) {
      onlyInA.push(key);
    }
  }
  for (const key of b) {
    if (!a.has(key)) {
      onlyInB.push(key);
    }
  }
  return { onlyInA, onlyInB };
}

function hasAny(content: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      return true;
    }
  }
  return false;
}

function main() {
  const errors: string[] = [];

  for (const file of FTL_FILES) {
    const enKeys = new Set(parseFluentKeys(readText(`addon/locale/en-US/${file}`)));
    const zhKeys = new Set(parseFluentKeys(readText(`addon/locale/zh-CN/${file}`)));
    const { onlyInA, onlyInB } = diffKeys(enKeys, zhKeys);
    if (onlyInA.length > 0 || onlyInB.length > 0) {
      errors.push(
        `[locale-parity] ${file}: en-only=[${onlyInA.join(", ")}], zh-only=[${onlyInB.join(", ")}]`,
      );
    }
  }

  const addonKeys = new Set(
    parseFluentKeys(readText("addon/locale/en-US/addon.ftl")),
  );
  for (const key of REQUIRED_ADDON_KEYS) {
    if (!addonKeys.has(key)) {
      errors.push(`[required-key] addon.ftl missing required key: ${key}`);
    }
  }

  for (const locale of LOCALES) {
    const sources = FTL_FILES.map((file) => {
      const keys = parseFluentKeys(readText(`addon/locale/${locale}/${file}`));
      return { file, keys };
    });
    const ownerByKey = new Map<string, string[]>();
    for (const source of sources) {
      for (const key of source.keys) {
        const owners = ownerByKey.get(key) || [];
        owners.push(source.file);
        ownerByKey.set(key, owners);
      }
    }
    for (const [key, owners] of ownerByKey.entries()) {
      if (owners.length <= 1) {
        continue;
      }
      if (!ALLOWED_CROSS_FILE_DUPLICATES.has(key)) {
        errors.push(
          `[duplicate-key] locale=${locale} key=${key} owners=${owners.join(",")}`,
        );
      }
    }
  }

  const displayNameModule = readText("src/backends/displayName.ts");
  const runtimeToastModule = readText(
    "src/modules/skillRunnerLocalRuntimeManager.ts",
  );
  const governanceHelper = readText("src/utils/localizationGovernance.ts");
  if (!displayNameModule.includes("resolveManagedLocalBackendDisplayNameText")) {
    errors.push(
      "[helper-wiring] displayName path must use resolveManagedLocalBackendDisplayNameText",
    );
  }
  if (!runtimeToastModule.includes("resolveManagedLocalRuntimeToastText")) {
    errors.push(
      "[helper-wiring] runtime toast path must use resolveManagedLocalRuntimeToastText",
    );
  }
  if (
    hasAny(displayNameModule, [/本地后端/, /Local Backend/]) ||
    hasAny(runtimeToastModule, [
      /本地后端已启动。/,
      /本地后端已停止。/,
      /本地后端异常停止。/,
      /Local backend started\.?/,
      /Local backend stopped\.?/,
      /Local backend stopped unexpectedly\.?/,
    ])
  ) {
    errors.push(
      "[fallback-hardcode] managed local backend display/toast fallback text must stay in centralized helper",
    );
  }
  if (
    !governanceHelper.includes("resolveManagedLocalBackendDisplayNameText") ||
    !governanceHelper.includes("resolveManagedLocalRuntimeToastText")
  ) {
    errors.push(
      "[helper-contract] centralized helper must export managed backend display/toast resolvers",
    );
  }

  if (errors.length > 0) {
    console.error("[localization-governance] failed");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
    return;
  }
  console.log("[localization-governance] passed");
}

main();
