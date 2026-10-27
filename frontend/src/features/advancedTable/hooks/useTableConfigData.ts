import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { TableConfigColumn } from "@/features/advancedTable/components/TableConfigEditor";
import { http } from "@/services/http";
import { toServiceRequestError } from "@/services/serviceErrors";

export interface TableConfigEndpointConfig {
  loadUrl: string;
  saveUrl: string;
  showVisibilityControl?: boolean;
}

export interface TableConfigPayloadAdapters {
  mapLoadResponse?: (raw: unknown) => TableConfigColumn[];
  mapSaveRequest?: (columns: TableConfigColumn[]) => unknown;
}

export function normalizeLoadedConfigColumns(raw: unknown): TableConfigColumn[] {
  const fallback = [] as TableConfigColumn[];
  if (!raw || typeof raw !== "object") return fallback;

  const anyRaw = raw as {
    columns?: unknown;
    tableConfig?: { columns?: unknown };
  };

  const source =
    (Array.isArray(anyRaw.columns) ? anyRaw.columns : undefined) ??
    (Array.isArray(anyRaw.tableConfig?.columns) ? anyRaw.tableConfig?.columns : undefined) ??
    [];

  return source
    .map((item, index) => {
      const col = item as Partial<TableConfigColumn> & {
        key?: string;
        label?: string;
      };
      const columnKey = String(col.columnKey ?? col.key ?? "");
      if (!columnKey) return null;

      return {
        columnKey,
        columnName: String(col.columnName ?? col.label ?? columnKey),
        order: Number.isFinite(col.order) ? Number(col.order) : index,
        enable: col.enable ?? true,
        visible: col.visible ?? col.enable ?? true,
      } as TableConfigColumn;
    })
    .filter((item): item is TableConfigColumn => Boolean(item))
    .sort((a, b) => a.order - b.order);
}

export function normalizeSaveRequestPayload(
  columns: TableConfigColumn[],
  showVisibilityControl = true
) {
  const normalizedColumns = columns.map((column, index) => ({
    ...column,
    order: index,
    visible: showVisibilityControl ? Boolean(column.visible) : Boolean(column.enable),
  }));

  return {
    tableConfig: {
      tableAccessibility: ["v", "s", "a"],
      columns: normalizedColumns,
    },
  };
}

export function useTableConfigData(
  endpoint: TableConfigEndpointConfig,
  adapters?: TableConfigPayloadAdapters
) {
  const [draftColumns, setDraftColumns] = useState<TableConfigColumn[] | null>(null);

  const mapLoadResponse = useMemo(
    () => adapters?.mapLoadResponse ?? normalizeLoadedConfigColumns,
    [adapters?.mapLoadResponse]
  );
  const mapSaveRequest = useMemo(
    () =>
      adapters?.mapSaveRequest ??
      ((nextColumns: TableConfigColumn[]) =>
        normalizeSaveRequestPayload(nextColumns, endpoint.showVisibilityControl !== false)),
    [adapters?.mapSaveRequest, endpoint.showVisibilityControl]
  );

  const loadQuery = useQuery<TableConfigColumn[], Error>({
    queryKey: ["advancedTable", "tableConfig", endpoint.loadUrl],
    queryFn: async () => {
      try {
        const response = await http.get(endpoint.loadUrl);
        return mapLoadResponse(response.data);
      } catch (e) {
        throw toServiceRequestError(e, "tableConfigLoad");
      }
    },
  });

  const columns = useMemo(
    () => draftColumns ?? loadQuery.data ?? [],
    [draftColumns, loadQuery.data]
  );

  const saveMutation = useMutation<boolean, Error, TableConfigColumn[]>({
    mutationFn: async (nextColumns) => {
      try {
        await http.post(endpoint.saveUrl, mapSaveRequest(nextColumns));
        setDraftColumns(nextColumns);
        return true;
      } catch (e) {
        throw toServiceRequestError(e, "tableConfigSave");
      }
    },
  });

  const errorMessage = useMemo(() => {
    if (saveMutation.error) return saveMutation.error.message;
    if (loadQuery.error) return loadQuery.error.message;
    return null;
  }, [loadQuery.error, saveMutation.error]);

  return {
    columns,
    isLoading: loadQuery.isLoading,
    isSaving: saveMutation.isPending,
    error: errorMessage,
    setColumns: setDraftColumns,
    reload: async () => {
      setDraftColumns(null);
      await loadQuery.refetch();
    },
    save: async (nextColumns: TableConfigColumn[]) => {
      try {
        return await saveMutation.mutateAsync(nextColumns);
      } catch {
        return false;
      }
    },
  };
}
