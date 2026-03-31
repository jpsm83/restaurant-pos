import type { ReactNode } from "react";

/** Generic shape for table row data in standalone mode. */
export type TableRowData = Record<string, unknown>;

/** Dropdown option contract used by filter configs. */
export interface FilterOption {
  value: string;
  label: string;
}

/** Supported filter modes for standalone table columns. */
export type FilterType = "input" | "dropdown";

/** Base filter contract for standalone column filtering behavior. */
export interface FilterConfig {
  columnId: string;
  filterType: FilterType;
  options?: FilterOption[];
  realtime?: boolean;
}

/** Minimal table column contract used across pureReact table layer. */
export interface TableColumnConfig<TData = TableRowData> {
  id: string;
  header: ReactNode | ((context: unknown) => ReactNode);
  accessorKey?: keyof TData & string;
  accessorFn?: (row: TData) => unknown;
  cell?: (context: unknown) => ReactNode;
  enableSorting?: boolean;
  enableHiding?: boolean;
  enableColumnFilter?: boolean;
  filterConfig?: FilterConfig;
  meta?: {
    label?: string;
    exportLabel?: string;
  };
}

/** Generic params contract for dynamic table fetching flows. */
export type TableFetchParams = Record<string, unknown>;

/** Generic response contract for dynamic table fetching flows. */
export interface TableFetchResponse<TData = TableRowData> {
  rows: TData[];
  total?: number;
  meta?: Record<string, unknown>;
}

/** Export column contract for mapping visible columns to exported labels. */
export interface TableExportColumn {
  id: string;
  label: string;
  formatValue?: (value: unknown) => unknown;
}

/** Export options contract for excel/download flows. */
export interface TableExportOptions {
  fileName: string;
  sheetName: string;
  columnWidth?: number;
  onProgress?: (progress: number) => void;
}

/** Config contract for row-details modal behavior. */
export interface DetailsModalConfig<TData = TableRowData> {
  enabled: boolean;
  trigger?: "doubleClick" | "click";
  position?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  allowKeyboardNavigation?: boolean;
  renderDetails: (
    record: TData,
    context: {
      index: number;
      total: number;
      close: () => void;
      navigatePrevious: () => void;
      navigateNext: () => void;
    }
  ) => ReactNode;
  renderHeaderActions?: (record: TData) => ReactNode;
}
