import { useEffect, useMemo, useRef, useState } from "react";
import type { Column, Table } from "@tanstack/react-table";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const PAGE_SIZES = [25, 50, 100, 150] as const;

function getPageLabel(pageIndex: number, pageCount: number): string {
  return `Page ${pageIndex + 1} of ${pageCount}`;
}

export interface StandaloneTablePaginationProps<TData> {
  table: Table<TData>;
  onClearFilters?: () => void;
  onResetColumns?: () => void;
  onExport?: () => Promise<void> | void;
  enabledColumnIds?: string[];
}

export const TablePagination = <TData,>({
  table,
  onClearFilters,
  onResetColumns,
  onExport,
  enabledColumnIds,
}: StandaloneTablePaginationProps<TData>) => {
  const { t } = useTranslation("business");
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);

  const hideableColumns = useMemo(() => {
    const all = table.getAllColumns().filter((column: Column<TData, unknown>) => column.getCanHide());
    if (enabledColumnIds?.length) {
      return all.filter((column) => enabledColumnIds.includes(column.id));
    }
    return all;
  }, [enabledColumnIds, table]);

  const handleExport = async () => {
    if (!onExport || isExporting) return;
    try {
      setIsExporting(true);
      await onExport();
      toast.success(t("advancedTable.pagination.exportSuccess", { defaultValue: "Export completed successfully." }), {
        duration: 2500,
        closeButton: false,
      });
    } catch {
      toast.error(t("advancedTable.pagination.exportError", { defaultValue: "Failed to export filtered data." }), {
        duration: 2500,
        closeButton: false,
      });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!showColumnMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (columnMenuRef.current?.contains(target)) return;
      setShowColumnMenu(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [showColumnMenu]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <div className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">
        {t("advancedTable.pagination.selectedCount", {
          defaultValue: "{{selected}} of {{total}} selected",
          selected: table.getFilteredSelectedRowModel().rows.length,
          total: table.getFilteredRowModel().rows.length,
        })}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          aria-label={t("advancedTable.pagination.goFirstPage", { defaultValue: "Go to first page" })}
          className="flex h-8 w-8 items-center justify-center rounded border border-border bg-card"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={t("advancedTable.pagination.goPreviousPage", { defaultValue: "Go to previous page" })}
          className="flex h-8 w-8 items-center justify-center rounded border border-border bg-card"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">
          {t("advancedTable.pagination.pageLabel", {
            defaultValue: getPageLabel(table.getState().pagination.pageIndex, table.getPageCount()),
            page: table.getState().pagination.pageIndex + 1,
            totalPages: table.getPageCount(),
          })}
        </span>
        <button
          type="button"
          aria-label={t("advancedTable.pagination.goNextPage", { defaultValue: "Go to next page" })}
          className="flex h-8 w-8 items-center justify-center rounded border border-border bg-card"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={t("advancedTable.pagination.goLastPage", { defaultValue: "Go to last page" })}
          className="flex h-8 w-8 items-center justify-center rounded border border-border bg-card"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <select
          className="h-8 rounded border border-border bg-card px-2 text-sm"
          value={String(table.getState().pagination.pageSize)}
          onChange={(event) => table.setPageSize(Number(event.target.value))}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>

        {onClearFilters && (
          <button className="flex h-8 items-center gap-1 rounded border border-border bg-card px-3 text-sm" onClick={onClearFilters}>
            <X className="h-4 w-4" />
            {t("advancedTable.pagination.clearFilters", { defaultValue: "Clear filters" })}
          </button>
        )}

        <div ref={columnMenuRef} className="relative">
          <button
            type="button"
            aria-label={t("advancedTable.pagination.openColumnMenu", { defaultValue: "Open column visibility menu" })}
            aria-haspopup="menu"
            aria-expanded={showColumnMenu}
            className="flex h-8 items-center gap-1 rounded border border-border bg-card px-3 text-sm"
            onClick={() => setShowColumnMenu((prev) => !prev)}
          >
            {t("advancedTable.pagination.columns", { defaultValue: "Columns" })} <ChevronDown className="h-4 w-4" />
          </button>
          {showColumnMenu && (
            <div className="absolute bottom-full right-0 z-20 mb-1 w-56 rounded border border-border bg-card p-2 shadow">
              {onResetColumns && (
                <button className="mb-2 w-full text-left text-sm text-primary" onClick={onResetColumns}>
                  {t("advancedTable.pagination.resetOrderVisibility", {
                    defaultValue: "Reset order & visibility",
                  })}
                </button>
              )}
              {hideableColumns.map((column) => (
                <label key={column.id} className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={(event) => column.toggleVisibility(event.target.checked)}
                  />
                  <span>{(column.columnDef.meta as { label?: string } | undefined)?.label ?? column.id}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label={
            isExporting
              ? t("advancedTable.pagination.exportingAria", { defaultValue: "Exporting filtered table data" })
              : t("advancedTable.pagination.exportAria", { defaultValue: "Export filtered table data" })
          }
          className="flex h-8 items-center gap-1 rounded border border-border bg-card px-3 text-sm"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className="h-4 w-4" />
          {isExporting
            ? t("advancedTable.pagination.exporting", { defaultValue: "Exporting..." })
            : t("advancedTable.pagination.exportFiltered", { defaultValue: "Export filtered" })}
        </button>
      </div>
    </div>
  );
};
