import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { VisibilityState } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
import {
  useTableExport,
  type TableExportColumnLabel,
} from "@/features/advancedTable/hooks/useTableExport";
import type { UseDynamicTableDataConfig } from "@/features/advancedTable/hooks/useDynamicTableData";
import type { PersistenceAdapter } from "@/features/advancedTable/services/persistenceService";
import { TableBody } from "@/features/advancedTable/components/genericTable/TableBody";
import { TableFilterRow } from "@/features/advancedTable/components/genericTable/TableFilterRow";
import { TableHeader } from "@/features/advancedTable/components/genericTable/TableHeader";
import { TablePagination } from "@/features/advancedTable/components/genericTable/TablePagination";
import { RecordDetailsModal } from "@/features/advancedTable/components/RecordDetailsModal";
import type { TableExportOptions } from "@/features/advancedTable/types/tableContracts";
import { parseDateTime } from "@/features/advancedTable/utils/dateFilter";

const START_DATE_FILTER_ID = "start-date";
const END_DATE_FILTER_ID = "end-date";

interface DetailsRenderContext {
  index: number;
  total: number;
  close: () => void;
  navigatePrevious: () => void;
  navigateNext: () => void;
}

function buildEnabledColumnIds<TData>(
  columns: TableColumnConfig<TData>[],
): string[] {
  return columns.map((column) => column.id);
}

function shouldUseFetchMode<TData>(
  data: TData[] | undefined,
  fetchConfig: UseDynamicTableDataConfig<TData> | undefined,
): boolean {
  return !!fetchConfig && !data;
}

function resolveTableRows<TData>(
  data: TData[] | undefined,
  fetchedRows: TData[],
  useFetchMode: boolean,
): TData[] {
  if (useFetchMode) return fetchedRows;
  return data ?? [];
}

function resolveTableRenderState(args: {
  useFetchMode: boolean;
  isLoading: boolean;
  isError: boolean;
  rowsLength: number;
}) {
  if (args.useFetchMode && args.isLoading) return "loading" as const;
  if (args.useFetchMode && args.isError) return "error" as const;
  if (args.rowsLength === 0) return "empty" as const;
  return "ready" as const;
}

function resolveSelectedIndex<TData>(
  rows: TData[],
  selectedRecord: TData | null,
): number {
  if (!selectedRecord) return -1;
  return rows.findIndex((row) => row === selectedRecord);
}

function getNextRecordByDirection<TData>(
  rows: TData[],
  selectedIndex: number,
  direction: "previous" | "next",
): TData | null {
  if (selectedIndex < 0) return null;
  const targetIndex =
    direction === "previous" ? selectedIndex - 1 : selectedIndex + 1;
  return rows[targetIndex] ?? null;
}

function resolveExportAction(
  externalOnExport: (() => Promise<void> | void) | undefined,
  internalOnExport: (() => Promise<void> | void) | undefined,
  internalEnabled: boolean,
): (() => Promise<void> | void) | undefined {
  if (externalOnExport) return externalOnExport;
  if (internalEnabled) return internalOnExport;
  return undefined;
}

function createDetailsRenderContext(
  args: DetailsRenderContext,
): DetailsRenderContext {
  return {
    index: args.index,
    total: args.total,
    close: args.close,
    navigatePrevious: args.navigatePrevious,
    navigateNext: args.navigateNext,
  };
}

function resolveDateValue(row: unknown, columnId: string): string | null {
  const record = row as Record<string, unknown>;
  const value = record?.[columnId];
  if (value == null) return null;
  return String(value);
}

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
  toolbar?: ReactNode;
  dateRangeFilter?: {
    startDate: string;
    endDate: string;
    columnId?: string;
  };
  localOnlyFilterColumnIds?: string[];
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
  toolbar,
  dateRangeFilter,
  localOnlyFilterColumnIds = [],
  onExport,
  exportConfig,
  detailsModal,
  persistence,
}: StandaloneAdvancedTableProps<TData>) => {
  const { t } = useTranslation("business");
  const useFetchMode = shouldUseFetchMode(data, fetchConfig);
  const [fetchParams, setFetchParams] = useState<Record<string, unknown>>(
    () => (fetchConfig?.params as Record<string, unknown>) ?? {},
  );

  const fallbackFetchConfig = useMemo<UseDynamicTableDataConfig<TData>>(
    () => ({
      queryKey: () => ["advancedTable", "standalone-table-disabled-fetch"],
      params: {},
      queryFn: async () => [],
      enabled: false,
    }),
    [],
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
      const localOnlySet = new Set(localOnlyFilterColumnIds);
      const fetchColumnFilters = columnFilters.filter(
        (filter) => !localOnlySet.has(filter.id),
      );
      setFetchParams((prev) => {
        const next = {
          ...prev,
          sorting,
          filters: fetchColumnFilters,
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
        };

        const sameSorting =
          JSON.stringify(prev.sorting ?? []) ===
          JSON.stringify(next.sorting ?? []);
        const sameFilters =
          JSON.stringify(prev.filters ?? []) ===
          JSON.stringify(next.filters ?? []);
        const samePage = prev.page === next.page;
        const samePageSize = prev.pageSize === next.pageSize;

        if (sameSorting && sameFilters && samePage && samePageSize) {
          return prev;
        }

        return next;
      });
    },
    [localOnlyFilterColumnIds, useFetchMode],
  );

  const normalizedStartDate = dateRangeFilter?.startDate?.trim() ?? "";
  const normalizedEndDate = dateRangeFilter?.endDate?.trim() ?? "";
  const effectiveFetchParams = useMemo(() => {
    const baseParams = (
      useFetchMode ? fetchParams : (fetchConfig?.params ?? {})
    ) as Record<string, unknown>;
    const baseFilters = Array.isArray(baseParams.filters)
      ? (baseParams.filters as Array<{ id?: string; value?: unknown }>).filter(
          (filter) =>
            filter?.id !== START_DATE_FILTER_ID &&
            filter?.id !== END_DATE_FILTER_ID,
        )
      : [];
    const dateFilters =
      normalizedStartDate && normalizedEndDate
        ? [
            { id: START_DATE_FILTER_ID, value: normalizedStartDate },
            { id: END_DATE_FILTER_ID, value: normalizedEndDate },
          ]
        : [];

    return {
      ...baseParams,
      filters: [...baseFilters, ...dateFilters],
      startDate: normalizedStartDate || undefined,
      endDate: normalizedEndDate || undefined,
    };
  }, [
    fetchConfig?.params,
    fetchParams,
    normalizedEndDate,
    normalizedStartDate,
    useFetchMode,
  ]);

  const dynamicData = useDynamicTableData<TData>({
    ...(fetchConfig ?? fallbackFetchConfig),
    params: effectiveFetchParams as UseDynamicTableDataConfig<TData>["params"],
    enabled: (fetchConfig?.enabled ?? true) && useFetchMode,
  });

  const tableColumns = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        filterFn: "includesString",
      })),
    [columns],
  );

  const tableRows = resolveTableRows(data, dynamicData.rows, useFetchMode);
  const effectiveTableRows = useMemo(() => {
    if (useFetchMode) return tableRows;

    const normalizedStartDate = dateRangeFilter?.startDate?.trim() ?? "";
    const normalizedEndDate = dateRangeFilter?.endDate?.trim() ?? "";
    const targetColumnId = dateRangeFilter?.columnId ?? "createdAt";
    if (!normalizedStartDate || !normalizedEndDate) return tableRows;

    const parsedStart = parseDateTime(normalizedStartDate);
    const parsedEnd = parseDateTime(normalizedEndDate);
    if (!parsedStart || !parsedEnd) return tableRows;

    const startMs = parsedStart.date.getTime();
    const endMs = parsedEnd.date.getTime();
    return tableRows.filter((row) => {
      const dateValue = resolveDateValue(row, targetColumnId);
      if (!dateValue) return false;
      const parsedValue = parseDateTime(dateValue);
      if (!parsedValue) return false;
      const valueMs = parsedValue.date.getTime();
      return valueMs >= startMs && valueMs <= endMs;
    });
  }, [
    dateRangeFilter?.columnId,
    dateRangeFilter?.endDate,
    dateRangeFilter?.startDate,
    tableRows,
    useFetchMode,
  ]);
  const availableColumnIds = useMemo(
    () => columns.map((column) => column.id),
    [columns],
  );
  const renderState = resolveTableRenderState({
    useFetchMode,
    isLoading: dynamicData.isLoading,
    isError: dynamicData.isError,
    rowsLength: effectiveTableRows.length,
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
    data: effectiveTableRows,
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

  useEffect(() => {
    if (!useFetchMode) return;
    table.setPageIndex(0);
  }, [normalizedEndDate, normalizedStartDate, table, useFetchMode]);

  const enabledColumnIds = useMemo(
    () => buildEnabledColumnIds(columns),
    [columns],
  );
  const tableFilters = useTableFilters(table, filterConfigs);
  const { clearHiddenColumnFilters } = tableFilters;
  const handleClearAllFilters = useCallback(() => {
    // Always clear table-level filters first, then optional external state (e.g. URL date range).
    tableFilters.clearAllFilters();
    onClearFilters?.();
  }, [onClearFilters, tableFilters]);
  const tableExport = useTableExport<TData>({
    table,
    storeColumns: exportConfig?.storeColumns ?? [],
    options:
      exportConfig?.options ??
      ({
        fileName: t("advancedTable.export.defaultFileName", {
          defaultValue: "table-export.xlsx",
        }),
        sheetName: t("advancedTable.export.defaultSheetName", {
          defaultValue: "Table",
        }),
      } as TableExportOptions),
    onError: exportConfig?.onError,
  });
  const effectiveOnExport = resolveExportAction(
    onExport,
    tableExport.handleExportFiltered,
    Boolean(exportConfig?.enabled),
  );
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TData | null>(null);

  useEffect(() => {
    clearHiddenColumnFilters();
  }, [clearHiddenColumnFilters, columnVisibility]);

  const selectedIndex = useMemo(
    () => resolveSelectedIndex(effectiveTableRows, selectedRecord),
    [effectiveTableRows, selectedRecord],
  );

  const selectedRecordId = useMemo(() => {
    if (!selectedRecord) return selectedRowId ?? null;
    const index = effectiveTableRows.findIndex((row) => row === selectedRecord);
    if (index < 0) return selectedRowId ?? null;
    return getRowId ? getRowId(selectedRecord, index) : String(index);
  }, [effectiveTableRows, getRowId, selectedRecord, selectedRowId]);

  useEffect(() => {
    if (
      !detailsModal?.enabled ||
      !isDetailsOpen ||
      !detailsModal.allowKeyboardNavigation
    )
      return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable =
        tagName === "input" ||
        tagName === "textarea" ||
        Boolean(target?.isContentEditable);
      if (isEditable) return;

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const next = getNextRecordByDirection(
          effectiveTableRows,
          selectedIndex,
          "previous",
        );
        if (next) setSelectedRecord(next);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = getNextRecordByDirection(
          effectiveTableRows,
          selectedIndex,
          "next",
        );
        if (next) setSelectedRecord(next);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    detailsModal?.allowKeyboardNavigation,
    detailsModal?.enabled,
    effectiveTableRows,
    isDetailsOpen,
    selectedIndex,
  ]);

  if (renderState === "loading") {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
        {t("advancedTable.states.loading", {
          defaultValue: "Loading table data...",
        })}
      </div>
    );
  }

  if (renderState === "error") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-sm text-destructive">
        <p>
          {t("advancedTable.states.error", {
            defaultValue: "Failed to load table data.",
          })}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void dynamicData.refetch();
          }}
        >
          {t("advancedTable.states.retry", { defaultValue: "Retry" })}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      {toolbar ? <div className="mb-3">{toolbar}</div> : null}
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
        onClearFilters={handleClearAllFilters}
        onResetColumns={resetColumns}
        onExport={effectiveOnExport}
        enabledColumnIds={enabledColumnIds}
      />

      {detailsModal?.enabled && selectedRecord && (
        <RecordDetailsModal
          open={isDetailsOpen}
          title={
            <span className="text-xs text-muted-foreground">
              {selectedIndex >= 0
                ? `${selectedIndex + 1} / ${effectiveTableRows.length}`
                : ""}
            </span>
          }
          onClose={() => setIsDetailsOpen(false)}
          canGoPrevious={selectedIndex > 0}
          canGoNext={
            selectedIndex >= 0 && selectedIndex < effectiveTableRows.length - 1
          }
          onPrevious={() => {
            const previous = getNextRecordByDirection(
              effectiveTableRows,
              selectedIndex,
              "previous",
            );
            if (previous) setSelectedRecord(previous);
          }}
          onNext={() => {
            const next = getNextRecordByDirection(
              effectiveTableRows,
              selectedIndex,
              "next",
            );
            if (next) setSelectedRecord(next);
          }}
          headerActions={detailsModal.renderHeaderActions?.(selectedRecord)}
          position={detailsModal.position ?? "center"}
        >
          {detailsModal.renderDetails(
            selectedRecord,
            createDetailsRenderContext({
              index: selectedIndex,
              total: effectiveTableRows.length,
              close: () => setIsDetailsOpen(false),
              navigatePrevious: () => {
                const previous = getNextRecordByDirection(
                  effectiveTableRows,
                  selectedIndex,
                  "previous",
                );
                if (previous) setSelectedRecord(previous);
              },
              navigateNext: () => {
                const next = getNextRecordByDirection(
                  effectiveTableRows,
                  selectedIndex,
                  "next",
                );
                if (next) setSelectedRecord(next);
              },
            }),
          )}
        </RecordDetailsModal>
      )}
    </div>
  );
};
