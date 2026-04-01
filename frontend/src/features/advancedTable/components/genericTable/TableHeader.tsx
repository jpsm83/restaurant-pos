import { flexRender, type Header, type HeaderGroup, type Table } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StandaloneTableHeaderProps<TData> {
  table: Table<TData>;
  children?: React.ReactNode;
  config?: {
    isDraggable?: boolean;
    draggedColumn?: string | null;
    onDragStart?: (event: React.DragEvent, columnId: string) => void;
    onDragOver?: (event: React.DragEvent) => void;
    onDrop?: (event: React.DragEvent, columnId: string) => void;
    onDragEnd?: () => void;
  };
}

function getHeaderDragClass(isDragging: boolean): string {
  return isDragging ? "opacity-50" : "";
}

export const TableHeader = <TData,>({
  table,
  children,
  config,
}: StandaloneTableHeaderProps<TData>) => {
  const {
    isDraggable = false,
    draggedColumn = null,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  } = config ?? {};

  return (
    <thead className="sticky top-0 z-10 bg-muted/70 shadow-sm">
      {table.getHeaderGroups().map((headerGroup: HeaderGroup<TData>) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header: Header<TData, unknown>) => {
            const columnId = header.column.id;
            const isDragging = draggedColumn === columnId;
            const canDragColumn = isDraggable && !header.isPlaceholder;
            const canSortColumn = header.column.getCanSort();
            const sortDirection = header.column.getIsSorted();
            return (
              <th
                key={header.id}
                className={`group bg-muted/70 p-2 text-left text-foreground ${getHeaderDragClass(
                  isDragging
                )}`}
                draggable={canDragColumn}
                onDragStart={
                  canDragColumn && onDragStart
                    ? (event) => {
                        // Add transfer payload so browsers consistently treat it as a valid drag.
                        event.dataTransfer.setData("text/plain", columnId);
                        onDragStart(event, columnId);
                      }
                    : undefined
                }
                onDragOver={canDragColumn && onDragOver ? onDragOver : undefined}
                onDrop={canDragColumn && onDrop ? (event) => onDrop(event, columnId) : undefined}
                onDragEnd={canDragColumn && onDragEnd ? onDragEnd : undefined}
              >
                <div className="flex items-center gap-2">
                  {canDragColumn && (
                    <span
                      className="cursor-grab opacity-100"
                      title="Drag to reorder column"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </span>
                  )}
                  {canSortColumn ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex h-auto flex-1 items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-card"
                      aria-label={`Sort by ${columnId}`}
                      title="Sort rows by this column"
                      onClick={(event) => {
                        event.stopPropagation();
                        header.column.toggleSorting(sortDirection === "asc");
                      }}
                    >
                      <span className="select-none">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                      {sortDirection === "asc" ? (
                        <ArrowUp className="h-4 w-4 text-muted-foreground" />
                      ) : sortDirection === "desc" ? (
                        <ArrowDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  ) : (
                    <span className="flex-1 select-none">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </span>
                  )}
                </div>
              </th>
            );
          })}
        </tr>
      ))}
      {children}
    </thead>
  );
};
