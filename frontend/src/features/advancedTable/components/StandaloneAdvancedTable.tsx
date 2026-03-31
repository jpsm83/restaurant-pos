import { useCallback, useEffect, useMemo, useState } from "react";
import type { VisibilityState } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import type {
  DetailsModalConfig,
  FilterConfig,
  TableColumnConfig,
  TableRowData,
} from "@/features/advancedTable/types/tableContracts";
import { useEnhancedTable } from "@/features/advancedTable/hooks/useEnhancedTable";
import { useDynamicTableData } from "@/features/advancedTable/hooks/useDynamicTableData";
import { useTableFilters } from "@/features/advancedTable/hooks/useTableFilters";
import { useColumnPersistence } from "@/features/advancedTable/hooks/useColumnPersistence";
import { useTableExport, type TableExportColumnLabel } from "@/features/advancedTable/hooks/useTableExport";
import type { UseDynamicTableDataConfig } from "@/features/advancedTable/hooks/useDynamicTableData";
import type { PersistenceAdapter } from "@/features/advancedTable/services/persistenceService";
import { TableBody } from "@/features/advancedTable/components/genericTable/TableBody";
import { TableFilterRow } from "@/features/advancedTable/components/genericTable/TableFilterRow";
import { TableHeader } from "@/features/advancedTable/components/genericTable/TableHeader";
import { TablePagination } from "@/features/advancedTable/components/genericTable/TablePagination";
import { RecordDetailsModal } from "@/features/advancedTable/components/RecordDetailsModal";
import {
  buildEnabledColumnIds,
  createDetailsRenderContext,
  getNextRecordByDirection,
  resolveExportAction,
  resolveSelectedIndex,
  resolveTableRenderState,
  resolveTableRows,
  shouldUseFetchMode,
} from "@/features/advancedTable/components/StandaloneAdvancedTable.helpers";
import type { TableExportOptions } from "@/features/advancedTable/types/tableContracts";

export interface StandaloneAdvancedTableProps<TData = TableRowData> {
  data?: TData[];
  fetchConfig?: UseDynamicTableDataConfig<TData>;
  columns: TableColumnConfig<TData>[];
  getRowId?: (row: TData, index: number) => string;
  pageSize?: number;
  defaultColumnVisibility?: VisibilityState;
  defaultColumnOrder?: string[];
  initialColumnOrder?: string[];
  initialColumnVisibility?: VisibilityState;
  onColumnOrderChange?: (order: string[]) => void;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  onResetColumnState?: () => void;
  filterConfigs?: FilterConfig[];
  isRealtimeFilterColumn?: (columnId: string) => boolean;
  onRowClick?: (row: TData) => void;
  selectedRowId?: string | null;
  rowHeightPx?: number;
  emptyStateMessage?: string;
  emptyStateSubMessage?: string;
  onClearFilters?: () => void;
  onExport?: () => Promise<void> | void;
  exportConfig?: {
    enabled?: boolean;
    storeColumns: TableExportColumnLabel[];
    options: TableExportOptions;
    onError?: (error: Error, context?: string) => Promise<void> | void;
  };
  detailsModal?: DetailsModalConfig<TData>;
  persistence?: {
    enabled?: boolean;
    adapter?: PersistenceAdapter;
    keyPrefix?: string;
  };
}

export const StandaloneAdvancedTable = <TData = TableRowData,>({
  data,
  fetchConfig,
  columns,
  getRowId,
  pageSize = 25,
  defaultColumnVisibility = {},
  defaultColumnOrder = [],
  initialColumnOrder = [],
  initialColumnVisibility,
  onColumnOrderChange,
  onColumnVisibilityChange,
  onResetColumnState,
  filterConfigs = [],
  isRealtimeFilterColumn,
  onRowClick,
  selectedRowId,
  rowHeightPx,
  emptyStateMessage,
  emptyStateSubMessage,
  onClearFilters,
  onExport,
  exportConfig,
  detailsModal,
  persistence,
}: StandaloneAdvancedTableProps<TData>) => {
  const { t } = useTranslation("business");
  const useFetchMode = shouldUseFetchMode(data, fetchConfig);
  const [fetchParams, setFetchParams] = useState<Record<string, unknown>>(
    () => (fetchConfig?.params as Record<string, unknown>) ?? {}
  );

  const fallbackFetchConfig = useMemo<UseDynamicTableDataConfig<TData>>(
    () => ({
      queryKey: () => ["advancedTable", "standalone-table-disabled-fetch"],
      params: {},
      queryFn: async () => [],
      enabled: false,
    }),
    []
  );

  const handleTableStateChange = useCallback(
    ({
      sorting,
      columnFilters,
      pagination,
    }: {
      sorting: Array<{ id: string; desc: boolean }>;
      columnFilters: Array<{ id: string; value: unknown }>;
      pagination: { pageIndex: number; pageSize: number };
    }) => {
      if (!useFetchMode) return;
      setFetchParams((prev) => {
        const next = {
          ...prev,
          sorting,
          filters: columnFilters,
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
        };

        const sameSorting = JSON.stringify(prev.sorting ?? []) === JSON.stringify(next.sorting ?? []);
        const sameFilters = JSON.stringify(prev.filters ?? []) === JSON.stringify(next.filters ?? []);
        const samePage = prev.page === next.page;
        const samePageSize = prev.pageSize === next.pageSize;

        if (sameSorting && sameFilters && samePage && samePageSize) {
          return prev;
        }

        return next;
      });
    },
    [useFetchMode]
  );

  const dynamicData = useDynamicTableData<TData>({
    ...(fetchConfig ?? fallbackFetchConfig),
    params: (useFetchMode ? fetchParams : fetchConfig?.params ?? {}) as UseDynamicTableDataConfig<TData>["params"],
    enabled: (fetchConfig?.enabled ?? true) && useFetchMode,
  });

  const tableColumns = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        filterFn: "includesString",
      })),
    [columns]
  );

  const tableRows = resolveTableRows(data, dynamicData.rows, useFetchMode);
  const availableColumnIds = useMemo(() => columns.map((column) => column.id), [columns]);
  const renderState = resolveTableRenderState({
    useFetchMode,
    isLoading: dynamicData.isLoading,
    isError: dynamicData.isError,
    rowsLength: tableRows.length,
  });

  const columnPersistence = useColumnPersistence({
    enabled: persistence?.enabled,
    adapter: persistence?.adapter,
    keyPrefix: persistence?.keyPrefix,
    availableColumnIds,
    initialColumnOrder,
    initialColumnVisibility,
    onColumnOrderChange,
    onColumnVisibilityChange,
  });

  const {
    table,
    draggedColumn,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    resetColumns,
    columnVisibility,
  } = useEnhancedTable<TData>({
    data: tableRows,
    columns: tableColumns as never,
    getRowId,
    defaultColumnVisibility,
    defaultColumnOrder,
    pageSize,
    initialColumnOrder: columnPersistence.initialColumnOrder,
    initialColumnVisibility: columnPersistence.initialColumnVisibility,
    onColumnOrderChange: columnPersistence.handleColumnOrderChange,
    onColumnVisibilityChange: columnPersistence.handleColumnVisibilityChange,
    onTableStateChange: handleTableStateChange,
    onResetColumnState,
  });

  const enabledColumnIds = useMemo(() => buildEnabledColumnIds(columns), [columns]);
  const tableFilters = useTableFilters(table, filterConfigs);
  const { clearHiddenColumnFilters } = tableFilters;
  const tableExport = useTableExport<TData>({
    table,
    storeColumns: exportConfig?.storeColumns ?? [],
    options:
      exportConfig?.options ??
      ({
        fileName: t("advancedTable.export.defaultFileName", { defaultValue: "table-export.xlsx" }),
        sheetName: t("advancedTable.export.defaultSheetName", { defaultValue: "Table" }),
      } as TableExportOptions),
    onError: exportConfig?.onError,
  });
  const effectiveOnExport = resolveExportAction(
    onExport,
    tableExport.handleExportFiltered,
    Boolean(exportConfig?.enabled)
  );
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TData | null>(null);

  useEffect(() => {
    clearHiddenColumnFilters();
  }, [clearHiddenColumnFilters, columnVisibility]);

  const selectedIndex = useMemo(
    () => resolveSelectedIndex(tableRows, selectedRecord),
    [selectedRecord, tableRows]
  );

  const selectedRecordId = useMemo(() => {
    if (!selectedRecord) return selectedRowId ?? null;
    const index = tableRows.findIndex((row) => row === selectedRecord);
    if (index < 0) return selectedRowId ?? null;
    return getRowId ? getRowId(selectedRecord, index) : String(index);
  }, [getRowId, selectedRecord, selectedRowId, tableRows]);

  useEffect(() => {
    if (!detailsModal?.enabled || !isDetailsOpen || !detailsModal.allowKeyboardNavigation) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable =
        tagName === "input" || tagName === "textarea" || Boolean(target?.isContentEditable);
      if (isEditable) return;

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const next = getNextRecordByDirection(tableRows, selectedIndex, "previous");
        if (next) setSelectedRecord(next);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = getNextRecordByDirection(tableRows, selectedIndex, "next");
        if (next) setSelectedRecord(next);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailsModal?.allowKeyboardNavigation, detailsModal?.enabled, isDetailsOpen, selectedIndex, tableRows]);

  if (renderState === "loading") {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
        {t("advancedTable.states.loading", { defaultValue: "Loading table data..." })}
      </div>
    );
  }

  if (renderState === "error") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-sm text-destructive">
        <p>{t("advancedTable.states.error", { defaultValue: "Failed to load table data." })}</p>
        <button
          className="h-8 rounded border border-border bg-card px-3 text-sm text-foreground"
          onClick={() => {
            void dynamicData.refetch();
          }}
        >
          {t("advancedTable.states.retry", { defaultValue: "Retry" })}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative flex-1 overflow-auto bg-card shadow">
        <table className="relative w-full caption-bottom text-sm">
          <TableHeader
            table={table}
            config={{
              isDraggable: true,
              draggedColumn,
              onDragStart: handleDragStart,
              onDragOver: handleDragOver,
              onDrop: handleDrop,
              onDragEnd: handleDragEnd,
            }}
          >
            <TableFilterRow
              table={table}
              filterConfigs={filterConfigs}
              getFilterValue={tableFilters.getFilterValue}
              setFilterInputs={tableFilters.setFilterInputs}
              isRealtimeFilterColumn={(columnId) =>
                isRealtimeFilterColumn?.(columnId) ??
                tableFilters.isRealtimeFilterColumn(columnId)
              }
              dropdownState={tableFilters.dropdownState}
              onDropdownOpenChange={tableFilters.onDropdownOpenChange}
              onDropdownToggleOption={tableFilters.onDropdownToggleOption}
              onDropdownSelectAllToggle={tableFilters.onDropdownSelectAllToggle}
              onCloseAllDropdowns={tableFilters.closeAllDropdowns}
            />
          </TableHeader>

          <TableBody
            table={table}
            columns={columns}
            emptyStateMessage={emptyStateMessage}
            emptyStateSubMessage={emptyStateSubMessage}
            onRowClick={(row) => {
              onRowClick?.(row);
              if (detailsModal?.enabled) {
                setSelectedRecord(row);
                setIsDetailsOpen(true);
              }
            }}
            selectedRowId={selectedRecordId}
            rowHeightPx={rowHeightPx}
          />
        </table>
      </div>

      <TablePagination
        table={table}
        onClearFilters={onClearFilters ?? tableFilters.clearAllFilters}
        onResetColumns={resetColumns}
        onExport={effectiveOnExport}
        enabledColumnIds={enabledColumnIds}
      />

      {detailsModal?.enabled && selectedRecord && (
        <RecordDetailsModal
          open={isDetailsOpen}
          title={
            <span className="text-xs text-muted-foreground">
              {selectedIndex >= 0 ? `${selectedIndex + 1} / ${tableRows.length}` : ""}
            </span>
          }
          onClose={() => setIsDetailsOpen(false)}
          canGoPrevious={selectedIndex > 0}
          canGoNext={selectedIndex >= 0 && selectedIndex < tableRows.length - 1}
          onPrevious={() => {
            const previous = getNextRecordByDirection(tableRows, selectedIndex, "previous");
            if (previous) setSelectedRecord(previous);
          }}
          onNext={() => {
            const next = getNextRecordByDirection(tableRows, selectedIndex, "next");
            if (next) setSelectedRecord(next);
          }}
          headerActions={detailsModal.renderHeaderActions?.(selectedRecord)}
          position={detailsModal.position ?? "center"}
        >
          {detailsModal.renderDetails(
            selectedRecord,
            createDetailsRenderContext({
              index: selectedIndex,
              total: tableRows.length,
              close: () => setIsDetailsOpen(false),
              navigatePrevious: () => {
                const previous = getNextRecordByDirection(tableRows, selectedIndex, "previous");
                if (previous) setSelectedRecord(previous);
              },
              navigateNext: () => {
                const next = getNextRecordByDirection(tableRows, selectedIndex, "next");
                if (next) setSelectedRecord(next);
              },
            })
          )}
        </RecordDetailsModal>
      )}
    </div>
  );
};
