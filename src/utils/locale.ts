import { config } from "../../package.json";
import { FluentMessageId } from "../../typings/i10n";
import { createZToolkit } from "./ztoolkit";

export { initLocale, getString, getLocaleID };

/**
 * Initialize locale data
 */
function initLocale() {
  const toolkit = getToolkit();
  const localizationCtor =
    typeof Localization === "undefined"
      ? toolkit.getGlobal("Zotero")?.getMainWindow?.()?.Localization ||
        toolkit.getGlobal("Localization")
      : Localization;
  if (!localizationCtor) {
    throw new Error("Localization is not available");
  }
  const l10n = new localizationCtor(
    [`${config.addonRef}-addon.ftl`],
    true,
  );
  addon.data.locale = {
    current: l10n,
  };
}

/**
 * Get locale string, see https://firefox-source-docs.mozilla.org/l10n/fluent/tutorial.html#fluent-translation-list-ftl
 * @param localString ftl key
 * @param options.branch branch name
 * @param options.args args
 * @example
 * ```ftl
 * # addon.ftl
 * addon-static-example = This is default branch!
 *     .branch-example = This is a branch under addon-static-example!
 * addon-dynamic-example =
    { $count ->
        [one] I have { $count } apple
       *[other] I have { $count } apples
    }
 * ```
 * ```js
 * getString("addon-static-example"); // This is default branch!
 * getString("addon-static-example", { branch: "branch-example" }); // This is a branch under addon-static-example!
 * getString("addon-dynamic-example", { args: { count: 1 } }); // I have 1 apple
 * getString("addon-dynamic-example", { args: { count: 2 } }); // I have 2 apples
 * ```
 */
function getString(localString: FluentMessageId): string;
function getString(localString: FluentMessageId, branch: string): string;
function getString(
  localeString: FluentMessageId,
  options: { branch?: string | undefined; args?: Record<string, unknown> },
): string;
function getString(...inputs: any[]) {
  if (inputs.length === 1) {
    return _getString(inputs[0]);
  } else if (inputs.length === 2) {
    if (typeof inputs[1] === "string") {
      return _getString(inputs[0], { branch: inputs[1] });
    } else {
      return _getString(inputs[0], inputs[1]);
    }
  } else {
    throw new Error("Invalid arguments");
  }
}

interface Pattern {
  value: string | null;
  attributes: Array<{
    name: string;
    value: string;
  }> | null;
}

function _getString(
  localeString: FluentMessageId,
  options: { branch?: string | undefined; args?: Record<string, unknown> } = {},
): string {
  const localStringWithPrefix = `${config.addonRef}-${localeString}`;
  const { branch, args } = options;
  if (!addon.data.locale?.current) {
    try {
      initLocale();
    } catch {
      return localStringWithPrefix;
    }
  }
  const pattern = addon.data.locale?.current.formatMessagesSync([
    { id: localStringWithPrefix, args },
  ])[0] as Pattern;

  if (!pattern) {
    return localStringWithPrefix;
  }
  if (branch && pattern.attributes) {
    return (
      pattern.attributes.find((attr) => attr.name === branch)?.value ||
      localStringWithPrefix
    );
  } else {
    return pattern.value || localStringWithPrefix;
  }
}

function getLocaleID(id: FluentMessageId) {
  return `${config.addonRef}-${id}`;
}

function getToolkit() {
  if (addon?.data?.ztoolkit) return addon.data.ztoolkit;
  addon.data.ztoolkit = createZToolkit();
  return addon.data.ztoolkit;
}
