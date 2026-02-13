const DEFAULT_CITEKEY_TEMPLATE = "{author}_{title}_{year}";
const CITEKEY_TEMPLATE_KEY = "citekey_template";
const SUPPORTED_LEGACY_CITEKEY_TEMPLATE_TOKENS = new Set([
  "author",
  "year",
  "title",
]);
const BBT_LITE_ALLOWED_OBJECTS = new Set(["auth", "year", "title"]);
const BBT_LITE_METHOD_SPECS = {
  auth: {
    lower: { minArgs: 0, maxArgs: 0 },
    upper: { minArgs: 0, maxArgs: 0 },
    nopunct: { minArgs: 0, maxArgs: 0 },
    skipwords: { minArgs: 0, maxArgs: 0 },
    select: { minArgs: 1, maxArgs: 2 },
    prefix: { minArgs: 1, maxArgs: 1 },
    postfix: { minArgs: 1, maxArgs: 1 },
    initials: { minArgs: 0, maxArgs: 0 },
    trim: { minArgs: 0, maxArgs: 0 },
    replace: { minArgs: 2, maxArgs: 2 },
    clean: { minArgs: 0, maxArgs: 0 },
    short: { minArgs: 0, maxArgs: 0 },
    abbr: { minArgs: 0, maxArgs: 0 },
  },
  title: {
    lower: { minArgs: 0, maxArgs: 0 },
    upper: { minArgs: 0, maxArgs: 0 },
    nopunct: { minArgs: 0, maxArgs: 0 },
    skipwords: { minArgs: 0, maxArgs: 0 },
    select: { minArgs: 1, maxArgs: 2 },
    prefix: { minArgs: 1, maxArgs: 1 },
    postfix: { minArgs: 1, maxArgs: 1 },
    initials: { minArgs: 0, maxArgs: 0 },
    trim: { minArgs: 0, maxArgs: 0 },
    replace: { minArgs: 2, maxArgs: 2 },
    clean: { minArgs: 0, maxArgs: 0 },
    short: { minArgs: 0, maxArgs: 0 },
    abbr: { minArgs: 0, maxArgs: 0 },
  },
  year: {
    lower: { minArgs: 0, maxArgs: 0 },
    upper: { minArgs: 0, maxArgs: 0 },
    nopunct: { minArgs: 0, maxArgs: 0 },
    select: { minArgs: 1, maxArgs: 2 },
    prefix: { minArgs: 1, maxArgs: 1 },
    postfix: { minArgs: 1, maxArgs: 1 },
    trim: { minArgs: 0, maxArgs: 0 },
    replace: { minArgs: 2, maxArgs: 2 },
  },
};

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOwnWorkflowParam(options, key) {
  return (
    isObject(options?.workflowParams) &&
    Object.prototype.hasOwnProperty.call(options.workflowParams, key)
  );
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

function parseBbtLiteTemplate(template) {
  const tokens = tokenizeBbtLiteTemplate(template);
  if (!tokens || tokens.length === 0) {
    return null;
  }
  let cursor = 0;
  const consume = (type) => {
    if (tokens[cursor]?.type === type) {
      const consumed = tokens[cursor];
      cursor += 1;
      return consumed;
    }
    return null;
  };
  const peek = () => tokens[cursor];
  const parseArg = () => {
    const token = peek();
    if (!token) {
      return null;
    }
    if (token.type === "number" || token.type === "string") {
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
    const literalToken = consume("string");
    if (literalToken) {
      return {
        type: "literal",
        value: String(literalToken.value || ""),
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
  return { terms };
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

function isValidBbtLiteTemplate(template) {
  const text = String(template || "").trim();
  if (!text || /[{}]/.test(text)) {
    return false;
  }
  const ast = parseBbtLiteTemplate(text);
  if (!ast || !Array.isArray(ast.terms) || ast.terms.length === 0) {
    return false;
  }
  for (const term of ast.terms) {
    if (term.type === "literal") {
      continue;
    }
    if (term.type !== "chain") {
      return false;
    }
    if (!BBT_LITE_ALLOWED_OBJECTS.has(term.object)) {
      return false;
    }
    const methodSpecs = BBT_LITE_METHOD_SPECS[term.object] || {};
    for (const method of term.methods || []) {
      const spec = methodSpecs[method.name];
      if (!spec) {
        return false;
      }
      const count = method.args.length;
      if (count < spec.minArgs || count > spec.maxArgs) {
        return false;
      }
    }
  }
  return true;
}

function isValidCitekeyTemplate(template) {
  return (
    isValidLegacyCitekeyTemplate(template) ||
    isValidBbtLiteTemplate(template)
  );
}

function resolveSchemaDefaultTemplate(manifest) {
  const fromSchema = String(
    manifest?.parameters?.[CITEKEY_TEMPLATE_KEY]?.default || "",
  ).trim();
  if (isValidCitekeyTemplate(fromSchema)) {
    return fromSchema;
  }
  return DEFAULT_CITEKEY_TEMPLATE;
}

function resolveFallbackTemplate(args) {
  const previousCandidate = String(
    args?.previous?.workflowParams?.[CITEKEY_TEMPLATE_KEY] || "",
  ).trim();
  if (isValidCitekeyTemplate(previousCandidate)) {
    return previousCandidate;
  }
  return resolveSchemaDefaultTemplate(args.manifest);
}

function normalizePersistedSettings(args) {
  const fallbackTemplate = resolveFallbackTemplate(args);
  const nextOptions = {
    ...(isObject(args.merged) ? args.merged : {}),
  };
  const nextWorkflowParams = {
    ...((isObject(nextOptions.workflowParams)
      ? nextOptions.workflowParams
      : {}) || {}),
  };
  const incomingHasTemplate = hasOwnWorkflowParam(args.incoming, CITEKEY_TEMPLATE_KEY);
  const candidate = String(nextWorkflowParams[CITEKEY_TEMPLATE_KEY] || "").trim();
  if (incomingHasTemplate) {
    nextWorkflowParams[CITEKEY_TEMPLATE_KEY] = isValidCitekeyTemplate(candidate)
      ? candidate
      : fallbackTemplate;
  } else if (!isValidCitekeyTemplate(candidate)) {
    nextWorkflowParams[CITEKEY_TEMPLATE_KEY] = fallbackTemplate;
  }
  return {
    ...nextOptions,
    workflowParams: nextWorkflowParams,
  };
}

function normalizeExecutionWorkflowParams(args) {
  const fallbackTemplate = resolveSchemaDefaultTemplate(args.manifest);
  const normalized = {
    ...((isObject(args.normalizedWorkflowParams)
      ? args.normalizedWorkflowParams
      : {}) || {}),
  };
  const candidate = String(normalized[CITEKEY_TEMPLATE_KEY] || "").trim();
  normalized[CITEKEY_TEMPLATE_KEY] = isValidCitekeyTemplate(candidate)
    ? candidate
    : fallbackTemplate;
  return normalized;
}

export function normalizeSettings(args) {
  if (!args || typeof args !== "object") {
    return undefined;
  }
  if (args.phase === "persisted") {
    return normalizePersistedSettings(args);
  }
  if (args.phase === "execution") {
    return normalizeExecutionWorkflowParams(args);
  }
  return undefined;
}
