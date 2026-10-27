import {
  flexRender,
  type Cell,
  type Row,
  type RowData,
  type Table,
} from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { AdvancedTableFeatures } from "@/features/advancedTable/hooks/useEnhancedTable";

export interface StandaloneTableBodyProps<TData extends RowData> {
  table: Table<AdvancedTableFeatures, TData>;
  columns: Array<unknown>;
  emptyStateMessage?: string;
  emptyStateSubMessage?: string;
  onRowClick?: (row: TData) => void;
  selectedRowId?: string | null;
  rowHeightPx?: number;
}

function isRowSelected(rowId: string, selectedRowId?: string | null): boolean {
  if (selectedRowId == null) return false;
  return String(rowId) === String(selectedRowId);
}

export const TableBody = <TData extends RowData,>({
  table,
  columns,
  emptyStateMessage,
  emptyStateSubMessage,
  onRowClick,
  selectedRowId,
  rowHeightPx,
}: StandaloneTableBodyProps<TData>) => {
  const { t } = useTranslation("business");
  const rows = table.getPaginatedRowModel().rows;
  const resolvedEmptyMessage =
    emptyStateMessage ?? t("advancedTable.body.emptyMessage");
  const resolvedEmptySubMessage =
    emptyStateSubMessage ??
    t("advancedTable.body.emptySubMessage");

  return (
    <tbody className="h-full">
      {rows.length > 0 ? (
        rows.map((row: Row<AdvancedTableFeatures, TData>) => {
          const selected = isRowSelected(row.id, selectedRowId);
          return (
            <tr
              key={row.id}
              data-state={selected ? "selected" : undefined}
              className={cn(
                "text-center text-xs leading-none",
                selected ? "bg-primary/15" : "hover:bg-muted/70",
                onRowClick && "cursor-pointer",
              )}
              style={
                rowHeightPx
                  ? {
                      height: `${rowHeightPx}px`,
                      minHeight: `${rowHeightPx}px`,
                      maxHeight: `${rowHeightPx}px`,
                    }
                  : undefined
              }
              onDoubleClick={onRowClick ? () => onRowClick(row.original) : undefined}
            >
              {row.getVisibleCells().map((cell: Cell<AdvancedTableFeatures, TData, unknown>) => (
                <td key={cell.id} className="px-2 py-1">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          );
        })
      ) : (
        <tr className="h-full">
          <td colSpan={columns.length} className="h-full text-center text-muted-foreground">
            <div className="pointer-events-none flex min-h-80 w-full flex-col items-center justify-center">
              <p className="text-xl font-medium mb-2">{resolvedEmptyMessage}</p>
              <p className="text-sm font-medium">{resolvedEmptySubMessage}</p>
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
};
