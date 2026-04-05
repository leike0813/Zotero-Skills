function isObjectLike(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function matchesType(type, value) {
  if (type === "array") {
    return Array.isArray(value);
  }
  if (type === "object") {
    return isObjectLike(value);
  }
  if (type === "string") {
    return typeof value === "string";
  }
  if (type === "integer") {
    return Number.isInteger(value);
  }
  if (type === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (type === "boolean") {
    return typeof value === "boolean";
  }
  if (type === "null") {
    return value === null;
  }
  return true;
}

function normalizeTypes(typeValue) {
  if (Array.isArray(typeValue)) {
    return typeValue.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (typeof typeValue === "string" && typeValue.trim()) {
    return [typeValue.trim()];
  }
  return [];
}

function validateNode(value, schema, path, errors) {
  if (!schema || typeof schema !== "object") {
    return;
  }

  const expectedTypes = normalizeTypes(schema.type);
  if (
    expectedTypes.length > 0 &&
    !expectedTypes.some((candidate) => matchesType(candidate, value))
  ) {
    errors.push(`${path} should be ${expectedTypes.join(" or ")}`);
    return;
  }

  if (typeof schema.minLength === "number" && typeof value === "string") {
    if (value.length < schema.minLength) {
      errors.push(`${path} should have minLength ${schema.minLength}`);
    }
  }

  if (Array.isArray(value)) {
    const itemSchema = schema.items;
    if (itemSchema && typeof itemSchema === "object") {
      for (let index = 0; index < value.length; index += 1) {
        validateNode(value[index], itemSchema, `${path}[${index}]`, errors);
      }
    }
    return;
  }

  if (!isObjectLike(value)) {
    return;
  }

  const properties = isObjectLike(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      errors.push(`${path}.${key} is required`);
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) {
        errors.push(`${path}.${key} is not allowed`);
      }
    }
  }

  for (const [key, childSchema] of Object.entries(properties)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      continue;
    }
    validateNode(value[key], childSchema, `${path}.${key}`, errors);
  }
}

export function validateWithJsonSchemaLite(value, schema) {
  const errors = [];
  validateNode(value, schema, "$", errors);
  return {
    valid: errors.length === 0,
    errors,
  };
}
