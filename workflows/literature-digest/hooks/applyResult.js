export async function applyResult({ parent, bundleReader, runtime }) {
  const helpers = runtime.helpers;
  const parentItem = helpers.resolveItemRef(parent);
  const resultJsonText = await bundleReader.readText("result/result.json");
  const result = JSON.parse(resultJsonText);

  const digestEntry = `artifacts/${helpers.basenameOrFallback(
    result?.data?.digest_path,
    "digest.md",
  )}`;
  const referencesEntry = `artifacts/${helpers.basenameOrFallback(
    result?.data?.references_path,
    "references.json",
  )}`;

  const digestMarkdown = await bundleReader.readText(digestEntry);
  const referencesJson = await bundleReader.readText(referencesEntry);

  const digestNote = await runtime.handlers.parent.addNote(parentItem, {
    content: helpers.toHtmlNote("Literature Digest", digestMarkdown),
  });

  const referencesNote = await runtime.handlers.parent.addNote(parentItem, {
    content: helpers.toHtmlNote("References JSON", referencesJson),
  });

  return {
    notes: [digestNote, referencesNote],
  };
}
