import type { TableColumnConfig, TableRowData } from "@/features/advancedTable/types/tableContracts";

/**
 * Returns only valid columns and ensures deterministic id fallback.
 * Empty/whitespace ids are discarded.
 */
export function normalizeColumns<TData = TableRowData>(
  columns: TableColumnConfig<TData>[]
): TableColumnConfig<TData>[] {
  return columns
    .filter((column) => typeof column.id === "string" && column.id.trim().length > 0)
    .map((column) => ({
      ...column,
      id: column.id.trim(),
    }));
}
