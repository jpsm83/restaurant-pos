import type { TableRowData } from "@/features/advancedTable/types/tableContracts";
import { formatSafeValue } from "@/features/advancedTable/utils/formatValue";

export type TableRowMapper<TSource, TRow extends TableRowData> = (
  source: TSource,
  index: number
) => TRow;

function toArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];

  const candidate = raw as {
    rows?: unknown;
    data?: unknown;
    items?: unknown;
  };

  if (Array.isArray(candidate.rows)) return candidate.rows;
  if (Array.isArray(candidate.data)) return candidate.data;
  if (Array.isArray(candidate.items)) return candidate.items;
  return [];
}

export function normalizeNullableRecordValues<T extends TableRowData>(
  row: T,
  emptyFallback = "-"
): T {
  const entries = Object.entries(row).map(([key, value]) => {
    if (value == null) return [key, emptyFallback];
    return [key, value];
  });
  return Object.fromEntries(entries) as T;
}

export function mapBackendRowsToTableRows<TSource, TRow extends TableRowData>(
  raw: unknown,
  mapRow: TableRowMapper<TSource, TRow>,
  options?: { normalizeNulls?: boolean; emptyFallback?: string }
): TRow[] {
  const sourceRows = toArray(raw) as TSource[];
  return sourceRows.map((source, index) => {
    const mapped = mapRow(source, index);
    if (!options?.normalizeNulls) return mapped;
    return normalizeNullableRecordValues(mapped, options.emptyFallback ?? formatSafeValue(null));
  });
}
