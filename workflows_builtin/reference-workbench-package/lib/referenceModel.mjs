export function normalizeReferenceAuthors(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export function normalizeReferenceEntry(entry, index) {
  const normalized = entry && typeof entry === "object" ? { ...entry } : {};
  const id = String(normalized.id || `ref-${index + 1}`).trim();
  const title = String(normalized.title || "").trim();
  const year = String(normalized.year || "").trim();
  const rawText = String(normalized.rawText || "").trim();
  const citekey = String(normalized.citekey || normalized.citeKey || "").trim();
  const author = normalizeReferenceAuthors(normalized.author || normalized.authors);
  const output = {
    ...normalized,
    id,
    title,
    year,
    author,
    rawText,
  };
  const optionalFields = [
    "publicationTitle",
    "conferenceName",
    "university",
    "archiveID",
    "volume",
    "issue",
    "pages",
    "place",
  ];
  for (const field of optionalFields) {
    const value = String(output[field] || "").trim();
    if (value) {
      output[field] = value;
    } else {
      delete output[field];
    }
  }
  if (citekey) {
    output.citekey = citekey;
  } else {
    delete output.citekey;
    delete output.citeKey;
  }
  return output;
}

export function normalizeReferencesArray(value) {
  const refs = Array.isArray(value) ? value : [];
  return refs.map((entry, index) => normalizeReferenceEntry(entry, index));
}
