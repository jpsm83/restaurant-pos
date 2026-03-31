import { useCallback } from "react";
import type { Table } from "@tanstack/react-table";
import { exportRowsToExcel } from "@/features/advancedTable/services/exportService";
import type { TableExportColumn, TableExportOptions } from "@/features/advancedTable/types/tableContracts";

export interface TableExportColumnLabel {
  columnKey: string;
  columnName: string;
}

export interface UseTableExportConfig<TData> {
  table: Table<TData>;
  storeColumns: TableExportColumnLabel[];
  options: TableExportOptions;
  onError?: (error: Error, context?: string) => Promise<void> | void;
}

export function getFilteredRows<TData>(table: Table<TData>): TData[] {
  return table.getFilteredRowModel().rows.map((row) => row.original);
}

export function getVisibleExportColumns<TData>(
  table: Table<TData>,
  storeColumns: TableExportColumnLabel[]
): TableExportColumn[] {
  const labels = new Map(storeColumns.map((column) => [column.columnKey, column.columnName]));
  return table
    .getVisibleLeafColumns()
    .map((column) => ({
      id: column.id,
      label: labels.get(column.id) ?? column.id,
    }))
    .filter((column) => Boolean(column.id));
}

export const useTableExport = <TData = Record<string, unknown>>({
  table,
  storeColumns,
  options,
  onError,
}: UseTableExportConfig<TData>) => {
  const handleExportFiltered = useCallback(async () => {
    try {
      const rows = getFilteredRows(table);
      const columns = getVisibleExportColumns(table, storeColumns);
      await exportRowsToExcel(rows, columns, options);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        await onError(normalized, "useTableExport.handleExportFiltered");
      } else {
        throw normalized;
      }
    }
  }, [onError, options, storeColumns, table]);

  return { handleExportFiltered };
};
