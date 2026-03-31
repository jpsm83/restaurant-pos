import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export interface TableConfigColumn {
  columnKey: string;
  columnName: string;
  order: number;
  enable: boolean;
  visible?: boolean;
}

export interface TableConfigEditorProps {
  columns: TableConfigColumn[];
  showVisibilityControl?: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  onSave?: (columns: TableConfigColumn[]) => Promise<void> | void;
  onCancel?: () => void;
}

export function reorderConfigColumns(
  columns: TableConfigColumn[],
  draggedKey: string,
  targetKey: string
): TableConfigColumn[] {
  if (!draggedKey || draggedKey === targetKey) return columns;
  const sourceIndex = columns.findIndex((column) => column.columnKey === draggedKey);
  const targetIndex = columns.findIndex((column) => column.columnKey === targetKey);
  if (sourceIndex < 0 || targetIndex < 0) return columns;

  const next = [...columns];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next.map((column, index) => ({ ...column, order: index }));
}

export function applyEnableRule(
  column: TableConfigColumn,
  enable: boolean,
  showVisibilityControl: boolean
): TableConfigColumn {
  if (!showVisibilityControl) {
    return {
      ...column,
      enable,
      visible: enable,
    };
  }
  return {
    ...column,
    enable,
    visible: enable ? column.visible ?? true : false,
  };
}

export function applyVisibilityRule(
  column: TableConfigColumn,
  visible: boolean
): TableConfigColumn {
  if (!column.enable) return { ...column, visible: false };
  return { ...column, visible };
}

export const TableConfigEditor: React.FC<TableConfigEditorProps> = ({
  columns,
  showVisibilityControl = true,
  isLoading = false,
  isSaving = false,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation("business");
  const [localColumns, setLocalColumns] = useState<TableConfigColumn[]>(() =>
    [...columns].sort((a, b) => a.order - b.order)
  );
  const [draggedKey, setDraggedKey] = useState<string | null>(null);

  const isDisabled = isLoading || isSaving;

  const orderedColumns = useMemo(
    () => [...localColumns].sort((a, b) => a.order - b.order),
    [localColumns]
  );

  const handleDrop = (targetKey: string) => {
    if (!draggedKey) return;
    setLocalColumns((prev) => reorderConfigColumns(prev, draggedKey, targetKey));
    setDraggedKey(null);
  };

  return (
    <div className="w-full h-full flex flex-col gap-3">
      <div className="border rounded bg-white overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="p-2 text-left">
                {t("advancedTable.configEditor.order", { defaultValue: "Order" })}
              </th>
              <th className="p-2 text-left">
                {t("advancedTable.configEditor.enable", { defaultValue: "Enable" })}
              </th>
              <th className="p-2 text-left">
                {t("advancedTable.configEditor.columnKey", { defaultValue: "Column key" })}
              </th>
              <th className="p-2 text-left">
                {t("advancedTable.configEditor.columnName", { defaultValue: "Column name" })}
              </th>
              {showVisibilityControl && (
                <th className="p-2 text-left">
                  {t("advancedTable.configEditor.visible", { defaultValue: "Visible" })}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {orderedColumns.map((column, index) => (
              <tr
                key={column.columnKey}
                className={`border-t ${draggedKey === column.columnKey ? "opacity-50" : ""}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(column.columnKey)}
              >
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-7 w-7 border rounded"
                      draggable
                      onDragStart={() => setDraggedKey(column.columnKey)}
                      onDragEnd={() => setDraggedKey(null)}
                      disabled={isDisabled}
                    >
                      ☰
                    </button>
                    <span>{index + 1}</span>
                  </div>
                </td>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={column.enable}
                    disabled={isDisabled}
                    onChange={(event) => {
                      const enable = event.target.checked;
                      setLocalColumns((prev) =>
                        prev.map((item) =>
                          item.columnKey === column.columnKey
                            ? applyEnableRule(item, enable, showVisibilityControl)
                            : item
                        )
                      );
                    }}
                  />
                </td>
                <td className="p-2 font-mono text-xs">{column.columnKey}</td>
                <td className="p-2">
                  <input
                    className="h-8 border rounded px-2 w-full"
                    value={column.columnName}
                    disabled={isDisabled}
                    onChange={(event) => {
                      const nextName = event.target.value;
                      setLocalColumns((prev) =>
                        prev.map((item) =>
                          item.columnKey === column.columnKey
                            ? { ...item, columnName: nextName }
                            : item
                        )
                      );
                    }}
                  />
                </td>
                {showVisibilityControl && (
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={column.visible ?? column.enable}
                      disabled={isDisabled || !column.enable}
                      onChange={(event) => {
                        const visible = event.target.checked;
                        setLocalColumns((prev) =>
                          prev.map((item) =>
                            item.columnKey === column.columnKey
                              ? applyVisibilityRule(item, visible)
                              : item
                          )
                        );
                      }}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="h-9 border rounded px-3"
          disabled={isDisabled}
          onClick={onCancel}
        >
          {t("advancedTable.configEditor.cancel", { defaultValue: "Cancel" })}
        </button>
        <button
          type="button"
          className="h-9 border rounded px-3"
          disabled={isDisabled || orderedColumns.length === 0}
          onClick={() => onSave?.(orderedColumns)}
        >
          {isSaving
            ? t("advancedTable.configEditor.saving", { defaultValue: "Saving..." })
            : t("advancedTable.configEditor.save", { defaultValue: "Save" })}
        </button>
      </div>
    </div>
  );
};
