import React from "react";
import { useTranslation } from "react-i18next";
import {
  useTableConfigData,
  type TableConfigEndpointConfig,
  type TableConfigPayloadAdapters,
} from "@/features/advancedTable/hooks/useTableConfigData";
import {
  TableConfigEditor,
  type TableConfigColumn,
} from "@/features/advancedTable/components/TableConfigEditor";

export interface TableConfigManagerProps {
  endpoint: TableConfigEndpointConfig;
  adapters?: TableConfigPayloadAdapters;
  onSaved?: (columns: TableConfigColumn[]) => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
}

export function shouldDisableSave(
  isLoading: boolean,
  isSaving: boolean,
  columns: TableConfigColumn[]
): boolean {
  return isLoading || isSaving || columns.length === 0;
}

/**
 * Route/page-friendly integration component for table config load/save flow.
 * This remains independent from StandaloneAdvancedTable usage.
 */
export const TableConfigManager: React.FC<TableConfigManagerProps> = ({
  endpoint,
  adapters,
  onSaved,
  onCancel,
  onError,
}) => {
  const { t } = useTranslation("business");
  const { columns, isLoading, isSaving, error, save } = useTableConfigData(endpoint, adapters);

  React.useEffect(() => {
    if (error) onError?.(error);
  }, [error, onError]);

  return (
    <div className="w-full h-full">
      <TableConfigEditor
        columns={columns}
        showVisibilityControl={endpoint.showVisibilityControl !== false}
        isLoading={isLoading}
        isSaving={isSaving}
        onCancel={onCancel}
        onSave={async (nextColumns) => {
          const ok = await save(nextColumns);
          if (ok) {
            onSaved?.(nextColumns);
          }
        }}
      />
      {shouldDisableSave(isLoading, isSaving, columns) && columns.length === 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {t("advancedTable.configManager.noColumnsToSave", {
            defaultValue: "No columns available to save.",
          })}
        </p>
      )}
    </div>
  );
};
