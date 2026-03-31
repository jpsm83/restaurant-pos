/**
 * Normalizes input-like filter values to a stable string shape.
 */
export function normalizeInputFilterValue(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * Normalizes multi-select filter values to unique non-empty strings.
 */
export function normalizeDropdownFilterValues(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeInputFilterValue(value);
    if (!normalized) continue;
    seen.add(normalized);
  }

  return Array.from(seen);
}
