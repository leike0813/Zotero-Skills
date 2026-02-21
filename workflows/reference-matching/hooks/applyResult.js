function escapeHtml(input) {
  return String(input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(input) {
  return escapeHtml(input).replaceAll('"', "&quot;");
}

function encodeBase64Utf8(text) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(String(text || ""), "utf8").toString("base64");
  }
  if (typeof TextEncoder !== "undefined" && typeof btoa === "function") {
    const bytes = new TextEncoder().encode(String(text || ""));
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(String(text || ""))));
  }
  throw new Error("No base64 encoder available in current runtime");
}

function decodeBase64Utf8(text) {
  const encoded = String(text || "").trim();
  if (!encoded) {
    throw new Error("references payload data-zs-value is empty");
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(encoded, "base64").toString("utf8");
  }
  if (typeof TextDecoder !== "undefined" && typeof atob === "function") {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  if (typeof atob === "function") {
    return decodeURIComponent(escape(atob(encoded)));
  }
  throw new Error("No base64 decoder available in current runtime");
}

function decodeHtmlEntities(text) {
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

const DEFAULT_CITEKEY_TEMPLATE = "{author}_{title}_{year}";
const SUPPORTED_LEGACY_CITEKEY_TEMPLATE_TOKENS = new Set([
  "author",
  "year",
  "title",
]);
const BBT_LITE_ALLOWED_OBJECTS = new Set(["auth", "year", "title"]);
const BBT_LITE_TEMPLATE_AST_CACHE = new Map();
const BBT_LITE_SKIP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const BBT_LITE_METHOD_SPECS = {
  auth: {
    lower: { minArgs: 0, maxArgs: 0, fn: (value) => String(value || "").toLowerCase() },
    upper: { minArgs: 0, maxArgs: 0, fn: (value) => String(value || "").toUpperCase() },
    nopunct: { minArgs: 0, maxArgs: 0, fn: (value) => normalizeBbtLitePunctuation(value) },
    skipwords: { minArgs: 0, maxArgs: 0, fn: (value) => skipBbtLiteWords(value) },
    select: { minArgs: 1, maxArgs: 2, fn: (value, args) => selectBbtLiteWords(value, args) },
    prefix: { minArgs: 1, maxArgs: 1, fn: (value, args) => prefixBbtLiteChars(value, args) },
    postfix: { minArgs: 1, maxArgs: 1, fn: (value, args) => postfixBbtLiteChars(value, args) },
    initials: { minArgs: 0, maxArgs: 0, fn: (value) => initialsBbtLiteWords(value) },
    trim: { minArgs: 0, maxArgs: 0, fn: (value) => String(value || "").trim() },
    replace: { minArgs: 2, maxArgs: 2, fn: (value, args) => replaceBbtLiteText(value, args) },
    clean: { minArgs: 0, maxArgs: 0, fn: (value) => normalizeBbtLiteWords(value).join(" ") },
    short: { minArgs: 0, maxArgs: 0, fn: (value) => selectBbtLiteWords(value, [1, 1]) },
    abbr: { minArgs: 0, maxArgs: 0, fn: (value) => initialsBbtLiteWords(value) },
  },
  title: {
    lower: { minArgs: 0, maxArgs: 0, fn: (value) => String(value || "").toLowerCase() },
    upper: { minArgs: 0, maxArgs: 0, fn: (value) => String(value || "").toUpperCase() },
    nopunct: { minArgs: 0, maxArgs: 0, fn: (value) => normalizeBbtLitePunctuation(value) },
    skipwords: { minArgs: 0, maxArgs: 0, fn: (value) => skipBbtLiteWords(value) },
    select: { minArgs: 1, maxArgs: 2, fn: (value, args) => selectBbtLiteWords(value, args) },
    prefix: { minArgs: 1, maxArgs: 1, fn: (value, args) => prefixBbtLiteChars(value, args) },
    postfix: { minArgs: 1, maxArgs: 1, fn: (value, args) => postfixBbtLiteChars(value, args) },
    initials: { minArgs: 0, maxArgs: 0, fn: (value) => initialsBbtLiteWords(value) },
    trim: { minArgs: 0, maxArgs: 0, fn: (value) => String(value || "").trim() },
    replace: { minArgs: 2, maxArgs: 2, fn: (value, args) => replaceBbtLiteText(value, args) },
    clean: { minArgs: 0, maxArgs: 0, fn: (value) => normalizeBbtLiteWords(value).join(" ") },
    short: { minArgs: 0, maxArgs: 0, fn: (value) => selectBbtLiteWords(value, [1, 1]) },
    abbr: { minArgs: 0, maxArgs: 0, fn: (value) => initialsBbtLiteWords(value) },
  },
  year: {
    lower: { minArgs: 0, maxArgs: 0, fn: (value) => String(value || "").toLowerCase() },
    upper: { minArgs: 0, maxArgs: 0, fn: (value) => String(value || "").toUpperCase() },
    nopunct: { minArgs: 0, maxArgs: 0, fn: (value) => normalizeBbtLitePunctuation(value) },
    select: { minArgs: 1, maxArgs: 2, fn: (value, args) => selectBbtLiteWords(value, args) },
    prefix: { minArgs: 1, maxArgs: 1, fn: (value, args) => prefixBbtLiteChars(value, args) },
    postfix: { minArgs: 1, maxArgs: 1, fn: (value, args) => postfixBbtLiteChars(value, args) },
    trim: { minArgs: 0, maxArgs: 0, fn: (value) => String(value || "").trim() },
    replace: { minArgs: 2, maxArgs: 2, fn: (value, args) => replaceBbtLiteText(value, args) },
  },
};

function readTagAttribute(tagText, attributeName) {
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

function setTagAttribute(tagText, attributeName, nextValue) {
  const escaped = escapeAttribute(String(nextValue || ""));
  const regex = new RegExp(
    `(${attributeName}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s>]+)`,
    "i",
  );
  if (regex.test(tagText)) {
    return tagText.replace(regex, `$1"${escaped}"`);
  }
  return String(tagText || "").replace(/>$/, ` ${attributeName}="${escaped}">`);
}

function parseReferencesPayload(noteContent, runtime) {
  const payloadTagMatch = String(noteContent || "").match(
    /<span[^>]*data-zs-payload=(["'])references-json\1[^>]*>/i,
  );
  if (!payloadTagMatch) {
    throw new Error("references payload block not found in note");
  }
  const payloadTag = payloadTagMatch[0];
  const encoding = (
    readTagAttribute(payloadTag, "data-zs-encoding") || "base64"
  ).toLowerCase();
  const encodedValue = decodeHtmlEntities(
    readTagAttribute(payloadTag, "data-zs-value"),
  );
  let jsonText = "";
  if (encoding === "base64") {
    jsonText = decodeBase64Utf8(encodedValue);
  } else if (encoding === "plain" || encoding === "utf8") {
    jsonText = encodedValue;
  } else {
    throw new Error(`Unsupported references payload encoding: ${encoding}`);
  }

  let payload = null;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new Error("references payload JSON is malformed");
  }
  const references = runtime.helpers.normalizeReferencesPayload(payload);
  return {
    payload,
    references,
    payloadTag,
  };
}

function normalizeText(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function jaccardLikeSimilarity(a, b) {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }
  let common = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      common += 1;
    }
  }
  return common / Math.max(tokensA.size, tokensB.size);
}

function bigramSimilarity(a, b) {
  const left = normalizeText(a).replace(/\s+/g, "");
  const right = normalizeText(b).replace(/\s+/g, "");
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 1;
  }
  const makeBigrams = (value) => {
    if (value.length < 2) {
      return [value];
    }
    const result = [];
    for (let i = 0; i < value.length - 1; i++) {
      result.push(value.slice(i, i + 2));
    }
    return result;
  };
  const leftBigrams = makeBigrams(left);
  const rightBigrams = makeBigrams(right);
  const rightCount = new Map();
  for (const gram of rightBigrams) {
    rightCount.set(gram, (rightCount.get(gram) || 0) + 1);
  }
  let overlap = 0;
  for (const gram of leftBigrams) {
    const count = rightCount.get(gram) || 0;
    if (count > 0) {
      overlap += 1;
      rightCount.set(gram, count - 1);
    }
  }
  return (2 * overlap) / (leftBigrams.length + rightBigrams.length);
}

function extractYear(value) {
  const match = String(value || "").match(/\b(1[6-9]\d{2}|20\d{2}|21\d{2})\b/);
  return match ? match[1] : "";
}

function normalizeCitekeyLookupKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function isValidLegacyCitekeyTemplate(template) {
  const text = String(template || "");
  if (!text.trim()) {
    return false;
  }
  if (!text.includes("{")) {
    return false;
  }
  const openBraces = (text.match(/\{/g) || []).length;
  const closeBraces = (text.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    return false;
  }
  for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
    const token = String(match[1] || "").trim().toLowerCase();
    if (!SUPPORTED_LEGACY_CITEKEY_TEMPLATE_TOKENS.has(token)) {
      return false;
    }
  }
  const stripped = text.replace(/\{[^{}]+\}/g, "");
  return !/[{}]/.test(stripped);
}

function isValidCitekeyTemplate(template) {
  return (
    isValidLegacyCitekeyTemplate(template) ||
    isValidBbtLiteTemplate(template)
  );
}

function normalizeCitekeyToken(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeBbtLitePunctuation(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBbtLiteWords(value) {
  return normalizeBbtLitePunctuation(value)
    .toLowerCase()
    .split(" ")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function skipBbtLiteWords(value) {
  return normalizeBbtLiteWords(value)
    .filter((word) => !BBT_LITE_SKIP_WORDS.has(word))
    .join(" ");
}

function readPositiveInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const rounded = Math.trunc(numeric);
  if (rounded < 1) {
    return null;
  }
  return rounded;
}

function selectBbtLiteWords(value, args) {
  const start = readPositiveInteger(args?.[0]);
  if (!start) {
    return "";
  }
  const count = args?.length > 1 ? readPositiveInteger(args[1]) : 1;
  if (!count) {
    return "";
  }
  const words = normalizeBbtLiteWords(value);
  return words.slice(start - 1, start - 1 + count).join(" ");
}

function prefixBbtLiteChars(value, args) {
  const count = readPositiveInteger(args?.[0]);
  if (!count) {
    return "";
  }
  const compact = normalizeBbtLiteWords(value).join("");
  return compact.slice(0, count);
}

function postfixBbtLiteChars(value, args) {
  const count = readPositiveInteger(args?.[0]);
  if (!count) {
    return "";
  }
  const compact = normalizeBbtLiteWords(value).join("");
  return compact.slice(Math.max(0, compact.length - count));
}

function initialsBbtLiteWords(value) {
  return normalizeBbtLiteWords(value)
    .map((word) => word[0] || "")
    .join("");
}

function replaceBbtLiteText(value, args) {
  const [from, to] = args || [];
  return String(value || "").split(String(from || "")).join(String(to || ""));
}

function tokenizeBbtLiteTemplate(template) {
  const text = String(template || "");
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const ch = text[index];
    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }
    if (ch === "+" || ch === "." || ch === "," || ch === "(" || ch === ")") {
      tokens.push({ type: ch, value: ch });
      index += 1;
      continue;
    }
    if (ch === "'") {
      let cursor = index + 1;
      let literal = "";
      let closed = false;
      while (cursor < text.length) {
        const current = text[cursor];
        if (current === "\\") {
          const next = text[cursor + 1];
          if (typeof next === "string") {
            literal += next;
            cursor += 2;
            continue;
          }
          return null;
        }
        if (current === "'") {
          closed = true;
          cursor += 1;
          break;
        }
        literal += current;
        cursor += 1;
      }
      if (!closed) {
        return null;
      }
      tokens.push({ type: "string", value: literal });
      index = cursor;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let cursor = index + 1;
      while (cursor < text.length && /[0-9]/.test(text[cursor])) {
        cursor += 1;
      }
      tokens.push({
        type: "number",
        value: Number(text.slice(index, cursor)),
      });
      index = cursor;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let cursor = index + 1;
      while (cursor < text.length && /[A-Za-z0-9_]/.test(text[cursor])) {
        cursor += 1;
      }
      tokens.push({
        type: "identifier",
        value: text.slice(index, cursor),
      });
      index = cursor;
      continue;
    }
    return null;
  }
  return tokens;
}

function parseBbtLiteTemplateAst(template) {
  const tokens = tokenizeBbtLiteTemplate(template);
  if (!tokens || tokens.length === 0) {
    return null;
  }
  let cursor = 0;
  const peek = () => tokens[cursor];
  const consume = (type) => {
    if (tokens[cursor]?.type === type) {
      const consumed = tokens[cursor];
      cursor += 1;
      return consumed;
    }
    return null;
  };
  const parseArg = () => {
    const token = peek();
    if (!token) {
      return null;
    }
    if (token.type === "string" || token.type === "number") {
      cursor += 1;
      return token.value;
    }
    return null;
  };
  const parseChain = () => {
    const objectToken = consume("identifier");
    if (!objectToken) {
      return null;
    }
    const chain = {
      type: "chain",
      object: String(objectToken.value || "").toLowerCase(),
      methods: [],
    };
    while (consume(".")) {
      const methodToken = consume("identifier");
      if (!methodToken) {
        return null;
      }
      const method = {
        name: String(methodToken.value || "").toLowerCase(),
        args: [],
      };
      if (consume("(")) {
        if (!consume(")")) {
          const firstArg = parseArg();
          if (firstArg === null) {
            return null;
          }
          method.args.push(firstArg);
          while (consume(",")) {
            const nextArg = parseArg();
            if (nextArg === null) {
              return null;
            }
            method.args.push(nextArg);
          }
          if (!consume(")")) {
            return null;
          }
        }
      }
      chain.methods.push(method);
    }
    return chain;
  };
  const parseTerm = () => {
    const literal = consume("string");
    if (literal) {
      return {
        type: "literal",
        value: String(literal.value || ""),
      };
    }
    return parseChain();
  };

  const terms = [];
  const first = parseTerm();
  if (!first) {
    return null;
  }
  terms.push(first);
  while (consume("+")) {
    const next = parseTerm();
    if (!next) {
      return null;
    }
    terms.push(next);
  }
  if (cursor !== tokens.length) {
    return null;
  }
  return { type: "expression", terms };
}

function getBbtLiteTemplateAst(template) {
  const key = String(template || "");
  if (BBT_LITE_TEMPLATE_AST_CACHE.has(key)) {
    return BBT_LITE_TEMPLATE_AST_CACHE.get(key);
  }
  const parsed = parseBbtLiteTemplateAst(key);
  BBT_LITE_TEMPLATE_AST_CACHE.set(key, parsed);
  return parsed;
}

function getBbtLiteMethodSpec(objectName, methodName) {
  return BBT_LITE_METHOD_SPECS[objectName]?.[methodName] || null;
}

function isValidBbtLiteMethodCall(objectName, methodName, args) {
  const spec = getBbtLiteMethodSpec(objectName, methodName);
  if (!spec) {
    return false;
  }
  const count = Array.isArray(args) ? args.length : 0;
  if (count < spec.minArgs || count > spec.maxArgs) {
    return false;
  }
  return true;
}

function isValidBbtLiteTemplate(template) {
  const text = String(template || "").trim();
  if (!text || /[{}]/.test(text)) {
    return false;
  }
  const ast = getBbtLiteTemplateAst(text);
  if (!ast || !Array.isArray(ast.terms) || ast.terms.length === 0) {
    return false;
  }
  for (const term of ast.terms) {
    if (!term || typeof term !== "object") {
      return false;
    }
    if (term.type === "literal") {
      continue;
    }
    if (term.type !== "chain") {
      return false;
    }
    if (!BBT_LITE_ALLOWED_OBJECTS.has(term.object)) {
      return false;
    }
    for (const method of term.methods || []) {
      if (!isValidBbtLiteMethodCall(term.object, method.name, method.args)) {
        return false;
      }
    }
  }
  return true;
}

function extractFirstReferenceAuthor(reference) {
  const pickFirst = (value) => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const text = String(entry || "").trim();
        if (text) {
          return text;
        }
      }
      return "";
    }
    if (typeof value === "string") {
      return String(value)
        .split(/[;,]/)
        .map((entry) => entry.trim())
        .find(Boolean) || "";
    }
    return "";
  };
  return pickFirst(reference?.author) || pickFirst(reference?.authors) || "";
}

function extractAuthorToken(reference) {
  const firstAuthor = extractFirstReferenceAuthor(reference);
  if (!firstAuthor) {
    return "";
  }
  const words = normalizeText(firstAuthor)
    .split(" ")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (words.length === 0) {
    return "";
  }
  return words[words.length - 1];
}

function extractTitleToken(reference) {
  const tokens = normalizeText(reference?.title)
    .split(" ")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return "";
  }
  return tokens.slice(0, 2).join("-");
}

function resolveCitekeyTemplate(parameter) {
  const configured = String(parameter?.citekey_template || "").trim();
  if (isValidCitekeyTemplate(configured)) {
    return configured;
  }
  return DEFAULT_CITEKEY_TEMPLATE;
}

function buildPredictedCitekey(reference, template) {
  if (isValidLegacyCitekeyTemplate(template)) {
    return buildPredictedLegacyCitekey(reference, template);
  }
  const rendered = evaluateBbtLiteTemplate(reference, template);
  if (!rendered.trim()) {
    return "";
  }
  return normalizePredictedCitekey(rendered);
}

function normalizePredictedCitekey(rendered) {
  return String(rendered || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
    .replace(/[_-]+$/g, "")
    .replace(/^[_-]+/g, "");
}

function buildPredictedLegacyCitekey(reference, template) {
  const values = {
    author: normalizeCitekeyToken(extractAuthorToken(reference)),
    year: normalizeCitekeyToken(extractYear(reference?.year || reference?.date)),
    title: normalizeCitekeyToken(extractTitleToken(reference)),
  };
  const rendered = String(template).replace(/\{([^{}]+)\}/g, (_, token) => {
    const key = String(token || "").trim().toLowerCase();
    return values[key] || "";
  });
  return normalizePredictedCitekey(rendered);
}

function resolveBbtLiteObjectValue(reference, objectName) {
  if (objectName === "auth") {
    return extractAuthorToken(reference);
  }
  if (objectName === "title") {
    return String(reference?.title || "");
  }
  if (objectName === "year") {
    return extractYear(reference?.year || reference?.date);
  }
  return "";
}

function applyBbtLiteMethod(objectName, value, method) {
  const spec = getBbtLiteMethodSpec(objectName, method?.name);
  if (!spec) {
    return null;
  }
  const args = Array.isArray(method?.args) ? method.args : [];
  if (!isValidBbtLiteMethodCall(objectName, method?.name, args)) {
    return null;
  }
  try {
    return spec.fn(value, args);
  } catch {
    return null;
  }
}

function evaluateBbtLiteTemplate(reference, template) {
  const ast = getBbtLiteTemplateAst(template);
  if (!ast || !Array.isArray(ast.terms) || ast.terms.length === 0) {
    return "";
  }
  const parts = [];
  for (const term of ast.terms) {
    if (term.type === "literal") {
      parts.push(String(term.value || ""));
      continue;
    }
    if (term.type !== "chain" || !BBT_LITE_ALLOWED_OBJECTS.has(term.object)) {
      return "";
    }
    let current = resolveBbtLiteObjectValue(reference, term.object);
    for (const method of term.methods || []) {
      const next = applyBbtLiteMethod(term.object, current, method);
      if (next === null) {
        return "";
      }
      current = next;
    }
    parts.push(String(current || ""));
  }
  return parts.join("");
}

function normalizeAuthors(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[;,]/)
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
  }
  return [];
}

function extractReferenceAuthors(reference) {
  const explicitAuthor = normalizeAuthors(reference?.author);
  if (explicitAuthor.length > 0) {
    return explicitAuthor;
  }
  return normalizeAuthors(reference?.authors);
}

function extractCreatorsFromItem(item) {
  const creators = [];
  const fromGetCreators = item?.getCreators?.();
  if (Array.isArray(fromGetCreators)) {
    for (const creator of fromGetCreators) {
      const name = String(
        creator?.lastName || creator?.name || creator?.firstName || "",
      ).trim();
      if (name) {
        creators.push(name);
      }
    }
  }
  const fromJson = item?.toJSON?.()?.creators;
  if (Array.isArray(fromJson)) {
    for (const creator of fromJson) {
      const name = String(
        creator?.lastName || creator?.name || creator?.firstName || "",
      ).trim();
      if (name) {
        creators.push(name);
      }
    }
  }
  const fallback = String(item?.firstCreator || "").trim();
  if (fallback) {
    creators.push(fallback);
  }
  return creators;
}

function extractCitekeyFromExtra(extraValue) {
  const match = String(extraValue || "").match(
    /(?:^|\n)\s*(?:citation\s*key|citekey)\s*:\s*([^\s]+)\s*(?:$|\n)/i,
  );
  return match ? String(match[1] || "").trim() : "";
}

function getItemField(item, field) {
  try {
    return String(item?.getField?.(field) || "");
  } catch {
    return "";
  }
}

function extractCitekeyFromItem(item) {
  const direct = getItemField(item, "citationKey");
  if (direct) {
    return direct.trim();
  }
  const fromJson = String(item?.toJSON?.()?.citationKey || "").trim();
  if (fromJson) {
    return fromJson;
  }
  const extra = getItemField(item, "extra");
  const fromExtra = extractCitekeyFromExtra(extra);
  if (fromExtra) {
    return fromExtra;
  }
  return "";
}

function isRegularItem(item) {
  if (!item || typeof item !== "object") {
    return false;
  }
  if (typeof item.isRegularItem === "function") {
    return !!item.isRegularItem();
  }
  if (typeof item.isNote === "function" && item.isNote()) {
    return false;
  }
  if (typeof item.isAttachment === "function" && item.isAttachment()) {
    return false;
  }
  return true;
}

function isDeletedItem(item) {
  if (!item || typeof item !== "object") {
    return false;
  }
  if (typeof item.isDeleted === "function") {
    try {
      return !!item.isDeleted();
    } catch {
      // ignore and continue fallback checks
    }
  }
  const direct = item.deleted;
  if (typeof direct === "boolean") {
    return direct;
  }
  if (typeof direct === "number") {
    return direct !== 0;
  }
  const fromJson = item.toJSON?.();
  if (fromJson && typeof fromJson === "object") {
    const value = fromJson.deleted;
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value !== 0;
    }
  }
  return false;
}

function collectLibraryItemsByIdScan() {
  const results = [];
  let misses = 0;
  const maxMisses = 200;
  const maxScan = 50000;
  for (let id = 1; id <= maxScan; id++) {
    const item = Zotero.Items.get(id);
    if (!item) {
      misses += 1;
      if (misses >= maxMisses) {
        break;
      }
      continue;
    }
    misses = 0;
    if (!isRegularItem(item)) {
      continue;
    }
    if (isDeletedItem(item)) {
      continue;
    }
    results.push(item);
  }
  return results;
}

async function collectLibraryItemsFromZoteroApi() {
  const getAll = Zotero.Items?.getAll;
  if (typeof getAll === "function") {
    try {
      const loaded = await getAll();
      if (Array.isArray(loaded)) {
        return loaded.filter(
          (entry) => isRegularItem(entry) && !isDeletedItem(entry),
        );
      }
    } catch {
      // fallback to id scan
    }
  }
  return collectLibraryItemsByIdScan();
}

function resolveFetchImpl() {
  const runtime = globalThis;
  if (typeof runtime.fetch === "function") {
    return runtime.fetch.bind(runtime);
  }
  throw new Error("fetch() is unavailable in current runtime");
}

function resolveBbtRpcEndpoint(parameter) {
  const parsedPort = Math.round(parseNumeric(parameter?.bbt_port, 23119));
  const port = Math.max(1, Math.min(65535, parsedPort));
  return `http://127.0.0.1:${port}/better-bibtex/json-rpc`;
}

async function postJsonRpc(url, payload) {
  const fetchImpl = resolveFetchImpl();
  let response = null;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(`bbt-json request failed (${url}): ${String(error)}`);
  }
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text.trim() ? JSON.parse(text) : {};
  } catch {
    throw new Error(`bbt-json response is not valid JSON (${url})`);
  }
  if (!response.ok) {
    throw new Error(
      `bbt-json request failed (${url}): HTTP ${response.status} ${JSON.stringify(parsed)}`,
    );
  }
  if (parsed && typeof parsed === "object" && parsed.error) {
    throw new Error(`bbt-json rpc error (${url}): ${JSON.stringify(parsed.error)}`);
  }
  return parsed?.result;
}

function normalizeBbtCreators(value) {
  const creators = [];
  if (!Array.isArray(value)) {
    return creators;
  }
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) {
      creators.push(entry.trim());
      continue;
    }
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const name = String(
      entry.lastName ||
        entry.family ||
        entry.name ||
        entry.firstName ||
        entry.given ||
        "",
    ).trim();
    if (name) {
      creators.push(name);
    }
  }
  return creators;
}

function extractBbtYear(entry) {
  const direct = extractYear(entry?.year || entry?.date || entry?.issued);
  if (direct) {
    return direct;
  }
  const parts = entry?.issued?.["date-parts"];
  if (Array.isArray(parts) && Array.isArray(parts[0])) {
    const year = String(parts[0][0] || "").trim();
    return extractYear(year);
  }
  return "";
}

function buildCandidateFromBbtEntry(entry) {
  const title = String(entry?.title || entry?.data?.title || "").trim();
  const citekey = String(
    entry?.citekey ||
      entry?.citeKey ||
      entry?.citationKey ||
      entry?.data?.citationKey ||
      "",
  ).trim();
  const authors = normalizeAuthors([
    ...normalizeBbtCreators(entry?.creators),
    ...normalizeBbtCreators(entry?.authors),
    ...normalizeAuthors(entry?.author),
  ]);
  return {
    item: entry,
    title,
    normalizedTitle: normalizeText(title),
    year: extractBbtYear(entry),
    authors,
    citekey,
  };
}

async function collectLibraryItemsFromBbtJson(parameter) {
  const endpoint = resolveBbtRpcEndpoint(parameter);
  const result = await postJsonRpc(endpoint, {
    jsonrpc: "2.0",
    method: "item.search",
    params: [""],
    id: `zotero-skills-reference-matching-${Date.now()}`,
  });
  if (Array.isArray(result)) {
    return result;
  }
  if (result && typeof result === "object" && Array.isArray(result.items)) {
    return result.items;
  }
  throw new Error(`bbt-json response payload is unsupported (${endpoint})`);
}

function buildCandidateFromZoteroItem(item) {
  const title = getItemField(item, "title");
  return {
    item,
    title,
    normalizedTitle: normalizeText(title),
    year: extractYear(getItemField(item, "date")),
    authors: normalizeAuthors(extractCreatorsFromItem(item)),
    citekey: extractCitekeyFromItem(item),
  };
}

async function collectLibraryCandidates(dataSource, parameter) {
  if (dataSource === "bbt-json") {
    const bbtItems = await collectLibraryItemsFromBbtJson(parameter);
    return bbtItems.map((entry) => buildCandidateFromBbtEntry(entry));
  }
  const zoteroItems = await collectLibraryItemsFromZoteroApi();
  return zoteroItems.map((entry) => buildCandidateFromZoteroItem(entry));
}

function buildCitekeyIndex(candidates) {
  const index = new Map();
  for (const candidate of candidates || []) {
    const raw = String(candidate?.citekey || "").trim();
    if (!raw) {
      continue;
    }
    const key = normalizeCitekeyLookupKey(raw);
    if (!key) {
      continue;
    }
    const bucket = index.get(key) || [];
    bucket.push(candidate);
    index.set(key, bucket);
  }
  return index;
}

function resolveCandidateByCitekey(citekey, citekeyIndex) {
  const key = normalizeCitekeyLookupKey(citekey);
  if (!key) {
    return { candidate: null, ambiguous: false };
  }
  const bucket = citekeyIndex.get(key) || [];
  if (bucket.length === 1) {
    return { candidate: bucket[0], ambiguous: false };
  }
  if (bucket.length > 1) {
    return { candidate: null, ambiguous: true };
  }
  return { candidate: null, ambiguous: false };
}

function computeMatchScore(reference, candidate) {
  const referenceTitle = String(reference?.title || "");
  const normalizedRefTitle = normalizeText(referenceTitle);
  const normalizedCandidateTitle = candidate.normalizedTitle;
  if (!normalizedRefTitle || !normalizedCandidateTitle || !candidate.citekey) {
    return {
      score: 0,
      exactTitle: false,
      titleScore: 0,
      authorScore: 0,
      yearScore: 0,
    };
  }

  const exactTitle = normalizedRefTitle === normalizedCandidateTitle;
  let titleScore = 0;
  if (exactTitle) {
    titleScore = 1;
  } else if (
    normalizedRefTitle.includes(normalizedCandidateTitle) ||
    normalizedCandidateTitle.includes(normalizedRefTitle)
  ) {
    titleScore = 0.95;
  } else {
    titleScore = Math.max(
      jaccardLikeSimilarity(referenceTitle, candidate.title),
      bigramSimilarity(referenceTitle, candidate.title),
    );
  }

  const referenceAuthors = extractReferenceAuthors(reference);
  let authorScore = 0;
  if (referenceAuthors.length > 0 && candidate.authors.length > 0) {
    const candidateSet = new Set(candidate.authors);
    for (const author of referenceAuthors) {
      if (candidateSet.has(author)) {
        authorScore = 1;
        break;
      }
    }
  }

  const referenceYear = extractYear(reference?.year);
  const yearScore =
    referenceYear && candidate.year && referenceYear === candidate.year ? 1 : 0;

  let score =
    titleScore * 0.82 + authorScore * 0.13 + yearScore * 0.05;
  if (exactTitle) {
    score = Math.max(score, 0.98);
  }
  return {
    score,
    exactTitle,
    titleScore,
    authorScore,
    yearScore,
  };
}

function parseNumeric(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveMatchingOptions(parameter) {
  return {
    confidenceThreshold: Math.min(
      1,
      Math.max(0, parseNumeric(parameter?.confidence_threshold, 0.93)),
    ),
    ambiguityDelta: Math.min(
      0.2,
      Math.max(0, parseNumeric(parameter?.ambiguity_delta, 0.03)),
    ),
    minimumFuzzyTitleScore: 0.9,
  };
}

function resolveReferenceMatch(reference, candidates, options) {
  const scored = [];
  for (const candidate of candidates) {
    const metrics = computeMatchScore(reference, candidate);
    if (metrics.exactTitle) {
      scored.push({
        candidate,
        ...metrics,
      });
      continue;
    }
    if (metrics.titleScore < options.minimumFuzzyTitleScore) {
      continue;
    }
    if (metrics.authorScore === 0 && metrics.yearScore === 0) {
      continue;
    }
    scored.push({
      candidate,
      ...metrics,
    });
  }
  if (scored.length === 0) {
    return null;
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (top.score < options.confidenceThreshold) {
    return null;
  }
  if (scored.length > 1) {
    const second = scored[1];
    if (top.score - second.score <= options.ambiguityDelta) {
      return null;
    }
  }
  return top.candidate;
}

function replaceReferencesTable(noteContent, tableHtml) {
  const pattern =
    /<table[^>]*data-zs-view=(["'])references-table\1[^>]*>[\s\S]*?<\/table>/i;
  if (pattern.test(noteContent)) {
    return String(noteContent).replace(pattern, tableHtml);
  }
  return String(noteContent);
}

function updatePayloadBlock(noteContent, payloadTag, nextPayload) {
  const nextEncoded = encodeBase64Utf8(JSON.stringify(nextPayload));
  let nextTag = setTagAttribute(payloadTag, "data-zs-encoding", "base64");
  nextTag = setTagAttribute(nextTag, "data-zs-value", nextEncoded);
  return String(noteContent).replace(payloadTag, nextTag);
}

function parseReferencesNoteKind(noteContent) {
  const payloadType = String(noteContent || "").match(
    /data-zs-payload\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
  );
  if (payloadType) {
    const parsed = String(
      payloadType[1] || payloadType[2] || payloadType[3] || "",
    );
    if (parsed === "references-json") {
      return "references";
    }
  }
  const kind = String(noteContent || "").match(
    /data-zs-note-kind\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
  );
  const parsedKind = kind
    ? String(kind[1] || kind[2] || kind[3] || "")
    : "";
  return parsedKind === "references" ? "references" : "";
}

function resolveSelectedReferenceNote(runResult, runtime) {
  const selectionContext = runResult?.resultJson?.selectionContext;
  const notes = Array.isArray(selectionContext?.items?.notes)
    ? selectionContext.items.notes
    : [];
  if (notes.length !== 1) {
    throw new Error(
      `reference-matching expects exactly one selected references note, got ${notes.length}`,
    );
  }
  const noteRef =
    typeof notes[0]?.item?.id === "number"
      ? notes[0].item.id
      : String(notes[0]?.item?.key || "").trim();
  if (!noteRef) {
    throw new Error("reference-matching cannot resolve selected note reference");
  }
  const noteItem = runtime.helpers.resolveItemRef(noteRef);
  const noteContent = String(noteItem.getNote?.() || "");
  if (parseReferencesNoteKind(noteContent) !== "references") {
    throw new Error("selected note is not a references note");
  }
  return {
    noteItem,
    noteContent,
  };
}

function resolveParentItemForReferenceNote(noteItem, runResult, runtime) {
  const selectionParentId = runResult?.resultJson?.selectionContext?.items?.notes?.[0]?.parent?.id;
  if (typeof selectionParentId === "number" && selectionParentId > 0) {
    try {
      return runtime.helpers.resolveItemRef(selectionParentId);
    } catch {
      return null;
    }
  }
  const fallbackParentId =
    (typeof noteItem?.parentItemID === "number" && noteItem.parentItemID > 0
      ? noteItem.parentItemID
      : null) ||
    (typeof noteItem?.parentID === "number" && noteItem.parentID > 0
      ? noteItem.parentID
      : null);
  if (typeof fallbackParentId === "number" && fallbackParentId > 0) {
    try {
      return runtime.helpers.resolveItemRef(fallbackParentId);
    } catch {
      return null;
    }
  }
  return null;
}

function listRelatedKeys(item) {
  const raw = Array.isArray(item?.relatedItems) ? item.relatedItems : [];
  return raw
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function resolveMatchedItem(candidate, runtime) {
  const source = candidate?.item;
  if (!source || typeof source !== "object") {
    return null;
  }
  const id = source.id;
  if (typeof id === "number" && id > 0) {
    try {
      return runtime.helpers.resolveItemRef(id);
    } catch {
      return null;
    }
  }
  const key = String(source.key || "").trim();
  if (key) {
    try {
      return runtime.helpers.resolveItemRef(key);
    } catch {
      return null;
    }
  }
  return null;
}

async function syncParentRelatedItems({
  parentItem,
  matchedCandidates,
  runtime,
}) {
  const resolvedItemsByKey = new Map();
  let unresolved = 0;
  for (const candidate of matchedCandidates || []) {
    const item = resolveMatchedItem(candidate, runtime);
    if (!item) {
      unresolved += 1;
      continue;
    }
    const key = String(item.key || "").trim();
    if (!key) {
      unresolved += 1;
      continue;
    }
    resolvedItemsByKey.set(key, item);
  }
  if (!parentItem) {
    return {
      added: 0,
      existing: 0,
      skipped: resolvedItemsByKey.size + unresolved,
    };
  }
  const existingKeys = new Set(listRelatedKeys(parentItem));
  const toAdd = [];
  let existing = 0;
  for (const [key, item] of resolvedItemsByKey.entries()) {
    if (existingKeys.has(key)) {
      existing += 1;
      continue;
    }
    toAdd.push(item);
  }
  if (toAdd.length > 0) {
    await runtime.handlers.parent.addRelated(parentItem, toAdd);
  }
  return {
    added: toAdd.length,
    existing,
    skipped: unresolved,
  };
}

export async function applyResult({ runResult, runtime }) {
  const parameter = runResult?.resultJson?.parameter || {};
  const dataSource = String(parameter?.data_source || "zotero-api").trim();
  const options = resolveMatchingOptions(parameter);
  const { noteItem, noteContent } = resolveSelectedReferenceNote(
    runResult,
    runtime,
  );
  const { payload, references, payloadTag } = parseReferencesPayload(
    noteContent,
    runtime,
  );
  const candidates = await collectLibraryCandidates(dataSource, parameter);
  const citekeyTemplate = resolveCitekeyTemplate(parameter);
  const citekeyIndex = buildCitekeyIndex(candidates);
  const matchedCandidates = [];

  const nextReferences = references.map((reference) => {
    const explicit = resolveCandidateByCitekey(
      reference?.citekey || reference?.citeKey,
      citekeyIndex,
    );
    if (explicit.candidate && explicit.candidate.citekey) {
      matchedCandidates.push(explicit.candidate);
      return {
        ...(reference || {}),
        citekey: explicit.candidate.citekey,
      };
    }

    const predictedCitekey = buildPredictedCitekey(reference, citekeyTemplate);
    const predicted = resolveCandidateByCitekey(predictedCitekey, citekeyIndex);
    if (predicted.candidate && predicted.candidate.citekey) {
      matchedCandidates.push(predicted.candidate);
      return {
        ...(reference || {}),
        citekey: predicted.candidate.citekey,
      };
    }

    const selected = resolveReferenceMatch(reference, candidates, options);
    if (!selected || !selected.citekey) {
      const cleared = { ...(reference || {}) };
      delete cleared.citekey;
      delete cleared.citeKey;
      return cleared;
    }
    matchedCandidates.push(selected);
    return {
      ...(reference || {}),
      citekey: selected.citekey,
    };
  });

  const nextPayload = runtime.helpers.replacePayloadReferences(
    payload,
    nextReferences,
  );
  const withPayload = updatePayloadBlock(noteContent, payloadTag, nextPayload);
  const nextNoteContent = replaceReferencesTable(
    withPayload,
    runtime.helpers.renderReferencesTable(nextReferences),
  );
  await runtime.handlers.note.update(noteItem, {
    content: nextNoteContent,
  });
  const parentItem = resolveParentItemForReferenceNote(noteItem, runResult, runtime);
  const related = await syncParentRelatedItems({
    parentItem,
    matchedCandidates,
    runtime,
  });

  const matched = nextReferences.filter((entry) =>
    String(entry?.citekey || "").trim(),
  ).length;
  return {
    updated: 1,
    matched,
    total: nextReferences.length,
    related_added: related.added,
    related_existing: related.existing,
    related_skipped: related.skipped,
  };
}

// Test-only export for fixture-driven unit tests.
export const __referenceMatchingTestOnly = {
  buildPredictedCitekey,
};
