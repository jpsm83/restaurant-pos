/**
 * Safe fallback formatter for table cells and exports.
 */
export function formatSafeValue(value: unknown, emptyFallback = "-"): string {
  if (value == null) return emptyFallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : emptyFallback;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return emptyFallback;
  }
}
