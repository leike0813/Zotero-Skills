// @ts-check Let TS check this config file

import zotero from "@zotero-plugin/eslint-config";

export default zotero({
  ignores: [
    // Generated/bundled files
    "addon/locale/**",

    // Openspec artifacts (proposals, designs, specs, tasks)
    "openspec/changes/**",
    "openspec/specs/**",

    // Documentation (keep README.md checked)
    "doc/**",
    "**/*.md",
    "!README.md",

    // Artifacts
    "artifact/**",

    // Test fixtures
    "test/fixtures/**",
  ],
  overrides: [
    {
      files: ["**/*.ts"],
      rules: {
        // We disable this rule here because the template
        // contains some unused examples and variables
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
  ],
});
