export function joinPath(...segments) {
  const normalized = segments
    .map((segment) => String(segment || "").trim())
    .filter(Boolean)
    .flatMap((segment) => segment.split(/[\\/]+/))
    .filter(Boolean);
  if (normalized.length === 0) {
    return "";
  }
  const first = String(segments[0] || "").trim();
  const driveMatch = first.match(/^([A-Za-z]:)/);
  const isAbsolute = /^[\\/]/.test(first);
  if (driveMatch) {
    if (normalized[0].toLowerCase() === driveMatch[1].toLowerCase()) {
      normalized.shift();
    }
    return `${driveMatch[1]}\\${normalized.join("\\")}`;
  }
  if (isAbsolute) {
    return `/${normalized.join("/")}`;
  }
  return normalized.join("/");
}

export function getBaseName(targetPath) {
  const parts = String(targetPath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

export function sanitizeFileNameSegment(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "untitled";
  }
  const sanitized = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return sanitized || "untitled";
}
