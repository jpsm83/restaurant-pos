import { flexRender, type Cell, type Row, type Table } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";

export interface StandaloneTableBodyProps<TData> {
  table: Table<TData>;
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

export const TableBody = <TData,>({
  table,
  columns,
  emptyStateMessage,
  emptyStateSubMessage,
  onRowClick,
  selectedRowId,
  rowHeightPx,
}: StandaloneTableBodyProps<TData>) => {
  const { t } = useTranslation("business");
  const rows = table.getPaginationRowModel().rows;
  const resolvedEmptyMessage =
    emptyStateMessage ?? t("advancedTable.body.emptyMessage", { defaultValue: "No data found" });
  const resolvedEmptySubMessage =
    emptyStateSubMessage ??
    t("advancedTable.body.emptySubMessage", { defaultValue: "Try adjusting your filters" });

  return (
    <tbody className="h-full">
      {rows.length > 0 ? (
        rows.map((row: Row<TData>) => {
          const selected = isRowSelected(row.id, selectedRowId);
          return (
            <tr
              key={row.id}
              data-state={selected ? "selected" : undefined}
              className={`text-center text-[12px] leading-none ${selected ? "bg-primary/15" : "hover:bg-muted/70"} ${
                onRowClick ? "cursor-pointer" : ""
              }`}
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
              {row.getVisibleCells().map((cell: Cell<TData, unknown>) => (
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
            <div className="flex flex-col items-center justify-center min-h-[320px] w-full pointer-events-none">
              <p className="text-xl font-medium mb-2">{resolvedEmptyMessage}</p>
              <p className="text-sm font-medium">{resolvedEmptySubMessage}</p>
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
};
