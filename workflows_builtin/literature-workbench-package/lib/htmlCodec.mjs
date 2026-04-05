import {
  decodeRuntimeBase64Utf8,
  encodeRuntimeBase64Utf8,
} from "./runtime.mjs";

export function escapeHtml(input) {
  return String(input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function escapeAttribute(input) {
  return escapeHtml(input).replaceAll('"', "&quot;");
}

export function encodeBase64Utf8(text, runtime) {
  return encodeRuntimeBase64Utf8(text, runtime);
}

export function decodeBase64Utf8(text, runtime) {
  return decodeRuntimeBase64Utf8(
    text,
    "references payload data-zs-value is empty",
    runtime,
  );
}

export function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const parsed = parseInt(hex, 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      const parsed = parseInt(dec, 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    })
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

export function readTagAttribute(tagText, attributeName) {
  const match = String(tagText || "").match(
    new RegExp(
      `${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i",
    ),
  );
  if (!match) {
    return "";
  }
  return String(match[1] || match[2] || match[3] || "");
}

export function setTagAttribute(tagText, attributeName, nextValue) {
  const escaped = escapeAttribute(String(nextValue || ""));
  const regex = new RegExp(
    `(${attributeName}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s>]+)`,
    "i",
  );
  if (regex.test(tagText)) {
    return String(tagText || "").replace(regex, `$1"${escaped}"`);
  }
  return String(tagText || "").replace(/>$/, ` ${attributeName}="${escaped}">`);
}
