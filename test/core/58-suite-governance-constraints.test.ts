import { assert } from "chai";
import { readFileSync } from "fs";
import { join } from "path";
import packageJson from "../../package.json";

type ScriptsMap = Record<string, string>;

function getScripts() {
  return ((packageJson as { scripts?: ScriptsMap }).scripts || {}) as ScriptsMap;
}

describe("suite governance constraints", function () {
  it("Risk: workflow builtin hooks must not depend on sibling workflow code or tag-vocab core bridge", function () {
    const checkedFiles = [
      join(process.cwd(), "workflows_builtin", "tag-manager", "hooks", "applyResult.js"),
      join(process.cwd(), "workflows_builtin", "tag-regulator", "hooks", "applyResult.js"),
      join(process.cwd(), "workflows_builtin", "tag-regulator", "hooks", "buildRequest.js"),
    ];

    for (const filePath of checkedFiles) {
      const source = readFileSync(filePath, "utf8");
      assert.notMatch(
        source,
        /from\s+["']\.\.\/\.\.\/(?:shared|[^"']+)["']/,
        `builtin workflow must stay self-contained: ${filePath}`,
      );
      assert.notMatch(
        source,
        /tagVocabularySyncBridge|__zsTagVocabularySyncBridge/,
        `builtin workflow must not depend on tag-vocab core bridge: ${filePath}`,
      );
    }
  });

  it("Risk: MR-02 keeps zotero scoped scripts bound to explicit domain selectors", function () {
    const scripts = getScripts();

    assert.match(scripts["test:zotero:core"] || "", /\blite\b.*\bcore\b/i);
    assert.match(scripts["test:zotero:ui"] || "", /\blite\b.*\bui\b/i);
    assert.match(
      scripts["test:zotero:workflow"] || "",
      /\blite\b.*\bworkflow\b/i,
    );
  });

  it("Risk: MR-02 keeps node scoped scripts bound to explicit domain selectors", function () {
    const scripts = getScripts();

    assert.match(scripts["test:node:core"] || "", /\blite\b.*\bcore\b/i);
    assert.match(scripts["test:node:ui"] || "", /\blite\b.*\bui\b/i);
    assert.match(scripts["test:node:workflow"] || "", /\blite\b.*\bworkflow\b/i);
  });

  it("Risk: MR-02 keeps full-suite scripts explicitly pinned to full mode", function () {
    const scripts = getScripts();

    assert.match(scripts["test:zotero:core:full"] || "", /\bfull\b.*\bcore\b/i);
    assert.match(scripts["test:zotero:ui:full"] || "", /\bfull\b.*\bui\b/i);
    assert.match(
      scripts["test:zotero:workflow:full"] || "",
      /\bfull\b.*\bworkflow\b/i,
    );
    assert.match(scripts["test:node:core:full"] || "", /\bfull\b.*\bcore\b/i);
    assert.match(scripts["test:node:ui:full"] || "", /\bfull\b.*\bui\b/i);
    assert.match(
      scripts["test:node:workflow:full"] || "",
      /\bfull\b.*\bworkflow\b/i,
    );
  });

  it("Risk: MR-02 keeps CI gate entries mapped to explicit pr/release targets", function () {
    const scripts = getScripts();

    assert.match(scripts["test:gate:pr"] || "", /run-ci-gate\.ts\s+pr/i);
    assert.match(
      scripts["test:gate:release"] || "",
      /run-ci-gate\.ts\s+release/i,
    );
  });
});
