import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnFiltersState,
  type ColumnOrderState,
  type FilterFn,
  type SortingState,
  type Table as TanStackTable,
  type TableOptions,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import type { TableRowData } from "@/features/advancedTable/types/tableContracts";

declare module "@tanstack/react-table" {
  interface FilterFns {
    includesString: FilterFn<unknown>;
  }
}

export interface UseEnhancedTableConfig<TData> {
  data: TData[];
  columns: TableOptions<TData>["columns"];
  getRowId?: (row: TData, index: number) => string;
  defaultColumnVisibility?: VisibilityState;
  defaultColumnOrder?: ColumnOrderState;
  pageSize?: number;
  initialColumnOrder?: ColumnOrderState;
  initialColumnVisibility?: VisibilityState;
  onColumnOrderChange?: (order: ColumnOrderState) => void;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  onTableStateChange?: (state: {
    sorting: SortingState;
    columnFilters: ColumnFiltersState;
    pagination: { pageIndex: number; pageSize: number };
  }) => void;
  onResetColumnState?: () => void;
}

export interface UseEnhancedTableReturn<TData> {
  table: TanStackTable<TData>;
  draggedColumn: string | null;
  handleDragStart: (e: React.DragEvent, columnId: string) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, targetColumnId: string) => void;
  handleDragEnd: () => void;
  resetColumns: () => void;
  columnOrder: ColumnOrderState;
  setColumnOrder: React.Dispatch<React.SetStateAction<ColumnOrderState>>;
  columnVisibility: VisibilityState;
  setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>;
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
  initial?: VisibilityState,
  fallback: VisibilityState = {}
): VisibilityState {
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

export const useEnhancedTable = <TData = TableRowData>({
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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    resolveInitialColumnVisibility(initialColumnVisibility, defaultColumnVisibility)
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() =>
    resolveInitialColumnOrder(initialColumnOrder, defaultColumnOrder)
  );
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  const mountedOrderRef = useRef(false);
  const mountedVisibilityRef = useRef(false);

  useEffect(() => {
    if (!mountedOrderRef.current) {
      mountedOrderRef.current = true;
      return;
    }
    onColumnOrderChange?.(columnOrder);
  }, [columnOrder, onColumnOrderChange]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize }));
  }, [pageSize]);

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

  const table = useReactTable<TData>({
    data,
    columns,
    autoResetPageIndex: false,
    getRowId: (row, index) => (getRowId ? getRowId(row, index) : resolveStableRowId(row, index)),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    filterFns: {
      includesString: ((row, columnId, filterValue) => {
        if (!filterValue || String(filterValue).trim() === "") return true;

        if (Array.isArray(filterValue)) {
          if (filterValue.length === 0) return true;
          const value = row.getValue(columnId);
          if (value == null) return false;
          const cellValue = String(value).toLowerCase();
          return filterValue.some(
            (candidate) => cellValue === String(candidate).toLowerCase()
          );
        }

        const value = row.getValue(columnId);
        if (value == null) return false;
        return String(value).toLowerCase().includes(String(filterValue).toLowerCase().trim());
      }) as FilterFn<TData>,
    } as Record<string, FilterFn<TData>>,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
      pagination,
    },
    initialState: {
      pagination: { pageSize },
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

    toast.success("Columns were reset successfully.", {
      duration: 2000,
      closeButton: false,
    });
  }, [
    defaultColumnOrder,
    defaultColumnVisibility,
    onColumnOrderChange,
    onColumnVisibilityChange,
    onResetColumnState,
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
