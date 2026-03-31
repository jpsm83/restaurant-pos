import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createTableQueryOptions,
  type StandaloneFetchConfig,
} from "@/features/advancedTable/services/fetchService";
import type {
  TableFetchResponse,
  TableFetchParams,
  TableRowData,
} from "@/features/advancedTable/types/tableContracts";

export interface UseDynamicTableDataConfig<
  TData = TableRowData,
  TParams = TableFetchParams
> extends StandaloneFetchConfig<TData, TParams> {
  enabled?: boolean;
  staleTimeMs?: number;
  refetchIntervalMs?: number;
}

export interface UseDynamicTableDataResult<TData = TableRowData> {
  rows: TData[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function normalizeQueryError(error: unknown): Error | null {
  if (!error) return null;
  return error instanceof Error ? error : new Error(String(error));
}

export function useDynamicTableData<
  TData = TableRowData,
  TParams = TableFetchParams
>({
  enabled = true,
  staleTimeMs = 0,
  refetchIntervalMs,
  ...fetchConfig
}: UseDynamicTableDataConfig<TData, TParams>): UseDynamicTableDataResult<TData> {
  const baseOptions = useMemo(
    () => createTableQueryOptions<TData, TParams>(fetchConfig),
    [fetchConfig]
  );

  const query = useQuery<TableFetchResponse<TData>, Error>({
    ...baseOptions,
    enabled,
    staleTime: staleTimeMs,
    refetchInterval: refetchIntervalMs,
  });

  return {
    rows: query.data?.rows ?? [],
    total: query.data?.total ?? query.data?.rows?.length ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: normalizeQueryError(query.error),
    refetch: async () => {
      await query.refetch();
    },
  };
}
