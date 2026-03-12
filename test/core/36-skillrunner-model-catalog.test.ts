import { assert } from "chai";
import {
  getDefaultSkillRunnerEngine,
  listSkillRunnerEngines,
  listSkillRunnerModelOptions,
  listSkillRunnerModelOptionsForProvider,
  listSkillRunnerModelProviders,
  normalizeSkillRunnerModel,
} from "../../src/providers/skillrunner/modelCatalog";
import {
  clearSkillRunnerModelCache,
  upsertSkillRunnerModelCacheEntry,
} from "../../src/providers/skillrunner/modelCache";
import { resolveProviderById } from "../../src/providers/registry";
import { config } from "../../package.json";

describe("skillrunner model catalog", function () {
  const cachePrefKey = `${config.prefsPrefix}.skillRunnerModelCacheJson`;
  let previousPref: unknown;

  beforeEach(function () {
    previousPref = Zotero.Prefs.get(cachePrefKey, true);
    clearSkillRunnerModelCache();
  });

  afterEach(function () {
    if (typeof previousPref === "undefined") {
      Zotero.Prefs.clear(cachePrefKey, true);
    } else {
      Zotero.Prefs.set(cachePrefKey, previousPref, true);
    }
  });

  it("exposes engines from bundled static catalog", function () {
    const engines = listSkillRunnerEngines();
    assert.includeMembers(engines, ["codex", "gemini", "iflow"]);
    assert.equal(getDefaultSkillRunnerEngine(), "gemini");
  });

  it("returns latest snapshot model list for a selected engine", function () {
    const geminiModels = listSkillRunnerModelOptions("gemini").map(
      (entry) => entry.value,
    );
    assert.include(geminiModels, "gemini-2.5-pro");
    assert.notInclude(geminiModels, "gpt-4");
  });

  it("normalizes model by selected engine", function () {
    assert.equal(
      normalizeSkillRunnerModel("gemini", "gemini-2.5-flash"),
      "gemini-2.5-flash",
    );
    assert.equal(normalizeSkillRunnerModel("gemini", "gpt-4"), "");
  });

  it("provides engine/model enum values via provider runtime schema hooks", function () {
    const provider = resolveProviderById("skillrunner");
    const schema = provider.getRuntimeOptionSchema?.() || {};
    assert.includeMembers(schema.engine?.enum || [], ["codex", "gemini", "iflow"]);

    const modelEnum = provider.getRuntimeOptionEnumValues?.({
      key: "model",
      options: { engine: "gemini" },
    });
    assert.include(modelEnum || [], "gemini-2.5-pro");

    const modelProviderEnum = provider.getRuntimeOptionEnumValues?.({
      key: "model_provider",
      options: { engine: "gemini" },
    });
    assert.deepEqual(modelProviderEnum || [], ["google"]);
  });

  it("prefers backend-scoped model cache when available", function () {
    upsertSkillRunnerModelCacheEntry({
      backendId: "skillrunner-local",
      baseUrl: "http://127.0.0.1:8030",
      updatedAt: "2026-03-11T00:00:00.000Z",
      engines: ["opencode"],
      modelsByEngine: {
        opencode: [
          {
            id: "openai/gpt-5",
            display_name: "OpenAI GPT-5",
            provider: "openai",
            model: "gpt-5",
            deprecated: false,
          },
          {
            provider: "anthropic",
            model: "claude-sonnet-4",
            display_name: "Claude Sonnet 4",
            deprecated: false,
          },
        ],
      },
    });

    const engines = listSkillRunnerEngines({
      backendId: "skillrunner-local",
      baseUrl: "http://127.0.0.1:8030",
    });
    assert.deepEqual(engines, ["opencode"]);

    const modelEnum = listSkillRunnerModelOptions("opencode", {
      backendId: "skillrunner-local",
      baseUrl: "http://127.0.0.1:8030",
    }).map((entry) => entry.value);
    assert.includeMembers(modelEnum, ["openai/gpt-5", "anthropic/claude-sonnet-4"]);

    const providers = listSkillRunnerModelProviders("opencode", {
      backendId: "skillrunner-local",
      baseUrl: "http://127.0.0.1:8030",
    });
    assert.deepEqual(providers, ["anthropic", "openai"]);

    const openaiModelEnum = listSkillRunnerModelOptionsForProvider(
      "opencode",
      "openai",
      {
        backendId: "skillrunner-local",
        baseUrl: "http://127.0.0.1:8030",
      },
    ).map((entry) => entry.value);
    assert.deepEqual(openaiModelEnum, ["gpt-5"]);
  });

  it("falls back to bundled catalog when backend-scoped cache is missing", function () {
    upsertSkillRunnerModelCacheEntry({
      backendId: "skillrunner-local",
      baseUrl: "http://127.0.0.1:8030",
      updatedAt: "2026-03-11T00:00:00.000Z",
      engines: ["opencode"],
      modelsByEngine: {
        opencode: [
          {
            id: "openai/gpt-5",
            display_name: "OpenAI GPT-5",
            deprecated: false,
          },
        ],
      },
    });

    const engines = listSkillRunnerEngines({
      backendId: "skillrunner-local",
      baseUrl: "http://127.0.0.1:19030",
    });
    assert.includeMembers(engines, ["codex", "gemini", "iflow"]);
    assert.notInclude(engines, "opencode");
  });

  it("filters opencode model enum by model_provider in provider hooks", function () {
    upsertSkillRunnerModelCacheEntry({
      backendId: "skillrunner-local",
      baseUrl: "http://127.0.0.1:8030",
      updatedAt: "2026-03-11T00:00:00.000Z",
      engines: ["opencode"],
      modelsByEngine: {
        opencode: [
          {
            id: "openai/gpt-5",
            provider: "openai",
            model: "gpt-5",
            display_name: "OpenAI GPT-5",
            deprecated: false,
          },
          {
            id: "anthropic/claude-sonnet-4",
            provider: "anthropic",
            model: "claude-sonnet-4",
            display_name: "Claude Sonnet 4",
            deprecated: false,
          },
        ],
      },
    });

    const provider = resolveProviderById("skillrunner");
    const modelProviderEnum = provider.getRuntimeOptionEnumValues?.({
      key: "model_provider",
      options: { engine: "opencode" },
      backend: {
        id: "skillrunner-local",
        type: "skillrunner",
        baseUrl: "http://127.0.0.1:8030",
        auth: { kind: "none" },
      },
    });
    assert.deepEqual(modelProviderEnum || [], ["anthropic", "openai"]);

    const modelEnum = provider.getRuntimeOptionEnumValues?.({
      key: "model",
      options: {
        engine: "opencode",
        model_provider: "openai",
      },
      backend: {
        id: "skillrunner-local",
        type: "skillrunner",
        baseUrl: "http://127.0.0.1:8030",
        auth: { kind: "none" },
      },
    });
    assert.deepEqual(modelEnum || [], ["gpt-5"]);
  });
});
