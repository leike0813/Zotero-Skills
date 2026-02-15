import { assert } from "chai";
import {
  getDefaultSkillRunnerEngine,
  listSkillRunnerEngines,
  listSkillRunnerModelOptions,
  normalizeSkillRunnerModel,
} from "../../src/providers/skillrunner/modelCatalog";
import { resolveProviderById } from "../../src/providers/registry";

describe("skillrunner model catalog", function () {
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
  });
});
