import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  constructFilterFn,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type ColumnOrderState,
  type RowData,
  type SortingState,
  type ReactTable,
  type TableOptions,
  type ColumnVisibilityState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import type { TableRowData } from "@/features/advancedTable/types/tableContracts";

const includesStringFilterFn = constructFilterFn({
  filter: (dataValue, filterValue) => {
    if (!filterValue || String(filterValue).trim() === "") return true;

    if (Array.isArray(filterValue)) {
      if (filterValue.length === 0) return true;
      if (dataValue == null) return false;
      const cellValue = String(dataValue).toLowerCase();
      return filterValue.some(
        (candidate) => cellValue === String(candidate).toLowerCase()
      );
    }

    if (dataValue == null) return false;
    return String(dataValue)
      .toLowerCase()
      .includes(String(filterValue).toLowerCase().trim());
  },
});

export const advancedTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: includesStringFilterFn },
});

export type AdvancedTableFeatures = typeof advancedTableFeatures;

export interface UseEnhancedTableConfig<TData extends RowData> {
  data: TData[];
  columns: TableOptions<AdvancedTableFeatures, TData>["columns"];
  getRowId?: (row: TData, index: number) => string;
  defaultColumnVisibility?: ColumnVisibilityState;
  defaultColumnOrder?: ColumnOrderState;
  pageSize?: number;
  initialColumnOrder?: ColumnOrderState;
  initialColumnVisibility?: ColumnVisibilityState;
  onColumnOrderChange?: (order: ColumnOrderState) => void;
  onColumnVisibilityChange?: (visibility: ColumnVisibilityState) => void;
  onTableStateChange?: (state: {
    sorting: SortingState;
    columnFilters: ColumnFiltersState;
    pagination: { pageIndex: number; pageSize: number };
  }) => void;
  onResetColumnState?: () => void;
}

export interface UseEnhancedTableReturn<TData extends RowData> {
  table: ReactTable<AdvancedTableFeatures, TData>;
  draggedColumn: string | null;
  handleDragStart: (e: React.DragEvent, columnId: string) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, targetColumnId: string) => void;
  handleDragEnd: () => void;
  resetColumns: () => void;
  columnOrder: ColumnOrderState;
  setColumnOrder: React.Dispatch<React.SetStateAction<ColumnOrderState>>;
  columnVisibility: ColumnVisibilityState;
  setColumnVisibility: React.Dispatch<React.SetStateAction<ColumnVisibilityState>>;
  pagination: { pageIndex: number; pageSize: number };
}

function resolveStableRowId(row: unknown, index: number): string {
  const maybe = row as { id?: unknown };
  if (maybe?.id != null && String(maybe.id).trim() !== "") {
    return String(maybe.id);
  }
  return `row-${index}`;
}

export function resolveInitialColumnVisibility(
  initial?: ColumnVisibilityState,
  fallback: ColumnVisibilityState = {}
): ColumnVisibilityState {
  if (initial && Object.keys(initial).length > 0) return initial;
  return fallback;
}

export function resolveInitialColumnOrder(
  initial?: ColumnOrderState,
  fallback: ColumnOrderState = []
): ColumnOrderState {
  if (initial && initial.length > 0) return initial;
  return fallback;
}

export function buildReorderedColumns(
  currentOrder: ColumnOrderState,
  draggedColumn: string,
  targetColumnId: string
): ColumnOrderState {
  if (!draggedColumn || draggedColumn === targetColumnId) return currentOrder;
  const draggedIndex = currentOrder.indexOf(draggedColumn);
  const targetIndex = currentOrder.indexOf(targetColumnId);
  if (draggedIndex === -1 || targetIndex === -1) return currentOrder;

  const next = [...currentOrder];
  next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, draggedColumn);
  return next;
}

export const useEnhancedTable = <TData extends RowData = TableRowData>({
  data,
  columns,
  getRowId,
  defaultColumnVisibility = {},
  defaultColumnOrder = [],
  pageSize = 100,
  initialColumnOrder = [],
  initialColumnVisibility,
  onColumnOrderChange,
  onColumnVisibilityChange,
  onTableStateChange,
  onResetColumnState,
}: UseEnhancedTableConfig<TData>): UseEnhancedTableReturn<TData> => {
  const { t } = useTranslation("business");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });
  const [previousPageSize, setPreviousPageSize] = useState(pageSize);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() =>
    resolveInitialColumnVisibility(initialColumnVisibility, defaultColumnVisibility)
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() =>
    resolveInitialColumnOrder(initialColumnOrder, defaultColumnOrder)
  );
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  const mountedOrderRef = useRef(false);
  const mountedVisibilityRef = useRef(false);

  if (previousPageSize !== pageSize) {
    setPreviousPageSize(pageSize);
    setPagination((prev) => ({ ...prev, pageSize }));
  }

  useEffect(() => {
    if (!mountedOrderRef.current) {
      mountedOrderRef.current = true;
      return;
    }
    onColumnOrderChange?.(columnOrder);
  }, [columnOrder, onColumnOrderChange]);

  useEffect(() => {
    onTableStateChange?.({ sorting, columnFilters, pagination });
  }, [columnFilters, onTableStateChange, pagination, sorting]);

  useEffect(() => {
    if (!mountedVisibilityRef.current) {
      mountedVisibilityRef.current = true;
      return;
    }
    onColumnVisibilityChange?.(columnVisibility);
  }, [columnVisibility, onColumnVisibilityChange]);

  const table = useTable<AdvancedTableFeatures, TData>({
    features: advancedTableFeatures,
    data,
    columns,
    autoResetPageIndex: false,
    getRowId: (row, index) => (getRowId ? getRowId(row, index) : resolveStableRowId(row, index)),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
      pagination,
    },
    initialState: {
      pagination: { pageIndex: 0, pageSize },
    },
  });

  const handleDragStart = useCallback((e: React.DragEvent, columnId: string) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetColumnId: string) => {
      e.preventDefault();
      if (!draggedColumn) {
        setDraggedColumn(null);
        return;
      }

      const currentOrder =
        columnOrder.length > 0 ? columnOrder : table.getAllColumns().map((column) => column.id);
      const nextOrder = buildReorderedColumns(currentOrder, draggedColumn, targetColumnId);
      if (nextOrder === currentOrder) {
        setDraggedColumn(null);
        return;
      }
      setColumnOrder(nextOrder);
      table.setColumnOrder(nextOrder);
      setDraggedColumn(null);
    },
    [columnOrder, draggedColumn, table]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null);
  }, []);

  const resetColumns = useCallback(() => {
    const orderToUse = defaultColumnOrder.length > 0 ? defaultColumnOrder : [];
    setColumnOrder(orderToUse);
    setColumnVisibility(defaultColumnVisibility);

    onResetColumnState?.();
    onColumnOrderChange?.(orderToUse);
    onColumnVisibilityChange?.(defaultColumnVisibility);

    toast.success(t("advancedTable.pagination.resetSuccess"), {
      duration: 2000,
      closeButton: false,
    });
  }, [
    defaultColumnOrder,
    defaultColumnVisibility,
    onColumnOrderChange,
    onColumnVisibilityChange,
    onResetColumnState,
    t,
  ]);

  return useMemo(
    () => ({
      table,
      draggedColumn,
      handleDragStart,
      handleDragOver,
      handleDrop,
      handleDragEnd,
      resetColumns,
      columnOrder,
      setColumnOrder,
      columnVisibility,
      setColumnVisibility,
      pagination,
    }),
    [
      table,
      draggedColumn,
      handleDragStart,
      handleDragOver,
      handleDrop,
      handleDragEnd,
      resetColumns,
      columnOrder,
      columnVisibility,
      pagination,
    ]
  );
};
