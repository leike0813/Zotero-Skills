import { assert } from "chai";
import { __tagManagerTestOnly } from "../../workflows/tag-manager/hooks/applyResult.js";

type TagEntry = {
  tag: string;
  facet: string;
  source: string;
  note: string;
  deprecated: boolean;
};

function sampleYaml(entries: TagEntry[]) {
  const body = entries
    .map((entry) =>
      [
        `- tag: ${entry.tag}`,
        `  facet: ${entry.facet}`,
        `  source: ${entry.source}`,
        `  note: ${entry.note}`,
        `  deprecated: ${entry.deprecated ? "true" : "false"}`,
      ].join("\n"),
    )
    .join("\n");
  return `# tags/tags.yaml style\n${body}\n`;
}

describe("workflow: tag-manager import protocol", function () {
  it("imports full-field yaml entries with skip strategy", function () {
    const existing: TagEntry[] = [
      {
        tag: "topic:existing",
        facet: "topic",
        source: "manual",
        note: "existing",
        deprecated: false,
      },
    ];
    const importedYaml = sampleYaml([
      {
        tag: "topic:existing",
        facet: "topic",
        source: "llm-interactive",
        note: "overwrite candidate",
        deprecated: false,
      },
      {
        tag: "field:CE/UG",
        facet: "field",
        source: "llm-interactive",
        note: "new",
        deprecated: false,
      },
    ]);

    const result = __tagManagerTestOnly.importFromYamlText({
      existingEntries: existing,
      yamlText: importedYaml,
      options: { onDuplicate: "skip", dryRun: false, source: "import" },
    });

    assert.deepEqual(result.report.skipped, ["topic:existing"]);
    assert.deepEqual(result.report.imported, ["field:CE/UG"]);
    assert.deepEqual(
      result.nextEntries.map((entry: TagEntry) => entry.tag),
      ["field:CE/UG", "topic:existing"],
    );
  });

  it("overwrites duplicates with overwrite strategy", function () {
    const existing: TagEntry[] = [
      {
        tag: "topic:existing",
        facet: "topic",
        source: "manual",
        note: "old-note",
        deprecated: false,
      },
    ];
    const importedYaml = sampleYaml([
      {
        tag: "topic:existing",
        facet: "topic",
        source: "llm-interactive",
        note: "new-note",
        deprecated: false,
      },
    ]);

    const result = __tagManagerTestOnly.importFromYamlText({
      existingEntries: existing,
      yamlText: importedYaml,
      options: { onDuplicate: "overwrite", dryRun: false, source: "import" },
    });

    assert.deepEqual(result.report.overwritten, ["topic:existing"]);
    assert.equal(result.nextEntries.length, 1);
    assert.equal(result.nextEntries[0].note, "new-note");
    assert.equal(result.nextEntries[0].source, "llm-interactive");
  });

  it("aborts on first duplicate with error strategy", function () {
    const existing: TagEntry[] = [
      {
        tag: "topic:existing",
        facet: "topic",
        source: "manual",
        note: "old-note",
        deprecated: false,
      },
    ];
    const importedYaml = sampleYaml([
      {
        tag: "topic:existing",
        facet: "topic",
        source: "llm-interactive",
        note: "new-note",
        deprecated: false,
      },
      {
        tag: "field:CE/UG",
        facet: "field",
        source: "llm-interactive",
        note: "new-tag",
        deprecated: false,
      },
    ]);

    const result = __tagManagerTestOnly.importFromYamlText({
      existingEntries: existing,
      yamlText: importedYaml,
      options: { onDuplicate: "error", dryRun: false, source: "import" },
    });

    assert.equal(result.report.aborted, true);
    assert.isAtLeast(result.report.errors.length, 1);
    assert.match(result.report.errors[0].code, /DUPLICATE/);
    assert.deepEqual(result.nextEntries, existing);
  });

  it("keeps state unchanged in dry-run mode", function () {
    const existing: TagEntry[] = [
      {
        tag: "topic:existing",
        facet: "topic",
        source: "manual",
        note: "existing",
        deprecated: false,
      },
    ];
    const importedYaml = sampleYaml([
      {
        tag: "field:CE/UG",
        facet: "field",
        source: "llm-interactive",
        note: "new",
        deprecated: false,
      },
    ]);

    const result = __tagManagerTestOnly.importFromYamlText({
      existingEntries: existing,
      yamlText: importedYaml,
      options: { onDuplicate: "skip", dryRun: true, source: "import" },
    });

    assert.deepEqual(result.report.imported, ["field:CE/UG"]);
    assert.deepEqual(result.nextEntries, existing);
  });

  it("rejects yaml entries missing required full fields", function () {
    const invalidYaml = [
      "- tag: topic:missing-fields",
      "  facet: topic",
    ].join("\n");

    const result = __tagManagerTestOnly.importFromYamlText({
      existingEntries: [],
      yamlText: invalidYaml,
      options: { onDuplicate: "skip", dryRun: false, source: "import" },
    });

    assert.equal(result.report.aborted, true);
    assert.isAtLeast(result.report.errors.length, 1);
    assert.match(result.report.errors[0].code, /PARSE_ERROR|INVALID_FORMAT/);
    assert.deepEqual(result.nextEntries, []);
  });
});
