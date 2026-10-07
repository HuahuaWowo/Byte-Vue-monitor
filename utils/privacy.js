const sensitiveKey = /password|passwd|token|secret|authorization|cookie|session|api.?key/i;

export function cleanUrl(value, allowedQuery = [], base = "http://localhost") {
  try {
    const url = new URL(String(value), base);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.username = "";
    url.password = "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (sensitiveKey.test(key) || !allowedQuery.includes(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch { return ""; }
}
export function pickFields(value, allowed = []) {
  const result = Object.create(null);
  for (const key of allowed) {
    if (!sensitiveKey.test(key) && Object.hasOwn(value || {}, key)) result[key] = value[key];
  }
  return result;
}
// Bound arbitrary error values and break cycles before JSON serialization.
export function sanitize(value, options = {}, key = "", seen = new WeakSet(), depth = 0) {
  if (sensitiveKey.test(key)) return "[redacted]";
  if (value == null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    let text = value;
    if (/^(url|filename|resourceName)$/i.test(key)) text = cleanUrl(text, options.allowedQuery, options.base);
    else text = text.replace(/https?:\/\/[^\s)]+/g, url => cleanUrl(url, options.allowedQuery, options.base));
    return text.slice(0, options.maxStringLength ?? 2000);
  }
  if (typeof value !== "object") return String(value).slice(0, 2000);
  if (depth >= 6) return "[truncated]";
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.slice(0, 50).map(item => sanitize(item, options, "", seen, depth + 1));
    const result = Object.create(null);
    for (const [childKey, childValue] of Object.entries(value).slice(0, 50)) {
      const selected = /^(params|query)$/.test(childKey)
        ? pickFields(childValue, options[childKey === "params" ? "allowedParams" : "allowedQuery"])
        : childValue;
      result[childKey] = sanitize(selected, options, childKey, seen, depth + 1);
    }
    return result;
  } finally { seen.delete(value); }
}
