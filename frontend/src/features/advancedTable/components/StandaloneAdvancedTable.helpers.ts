import type { UseDynamicTableDataConfig } from "@/features/advancedTable/hooks/useDynamicTableData";
import type { TableColumnConfig } from "@/features/advancedTable/types/tableContracts";

export function buildEnabledColumnIds<TData>(columns: TableColumnConfig<TData>[]): string[] {
  return columns.map((column) => column.id);
}

export function shouldUseFetchMode<TData>(
  data: TData[] | undefined,
  fetchConfig: UseDynamicTableDataConfig<TData> | undefined
): boolean {
  return !!fetchConfig && !data;
}

export function resolveTableRows<TData>(
  data: TData[] | undefined,
  fetchedRows: TData[],
  useFetchMode: boolean
): TData[] {
  if (useFetchMode) return fetchedRows;
  return data ?? [];
}

export function resolveTableRenderState(args: {
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

export function resolveSelectedIndex<TData>(
  rows: TData[],
  selectedRecord: TData | null
): number {
  if (!selectedRecord) return -1;
  return rows.findIndex((row) => row === selectedRecord);
}

export function getNextRecordByDirection<TData>(
  rows: TData[],
  selectedIndex: number,
  direction: "previous" | "next"
): TData | null {
  if (selectedIndex < 0) return null;
  const targetIndex = direction === "previous" ? selectedIndex - 1 : selectedIndex + 1;
  return rows[targetIndex] ?? null;
}

export function resolveExportAction(
  externalOnExport: (() => Promise<void> | void) | undefined,
  internalOnExport: (() => Promise<void> | void) | undefined,
  internalEnabled: boolean
): (() => Promise<void> | void) | undefined {
  if (externalOnExport) return externalOnExport;
  if (internalEnabled) return internalOnExport;
  return undefined;
}

export interface DetailsRenderContext {
  index: number;
  total: number;
  close: () => void;
  navigatePrevious: () => void;
  navigateNext: () => void;
}

export function createDetailsRenderContext(args: DetailsRenderContext): DetailsRenderContext {
  return {
    index: args.index,
    total: args.total,
    close: args.close,
    navigatePrevious: args.navigatePrevious,
    navigateNext: args.navigateNext,
  };
}
