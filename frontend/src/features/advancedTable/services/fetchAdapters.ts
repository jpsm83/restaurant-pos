import type { TableFetchParams, TableRowData } from "@/features/advancedTable/types/tableContracts";
import { mapBackendRowsToTableRows, normalizeNullableRecordValues } from "@/features/advancedTable/utils/dataMapping";

export type ParamsMapper<TParams = TableFetchParams> = (
  params: TParams
) => Record<string, unknown>;

export type ResponseMapper<TData = TableRowData> = (raw: unknown) => TData[];

/**
 * Default params mapper keeps params shape as-is.
 */
export function defaultParamsMapper<TParams = TableFetchParams>(
  params: TParams
): Record<string, unknown> {
  return params as Record<string, unknown>;
}

/**
 * Default response mapper expects API response already as row array.
 */
export function defaultResponseMapper<TData = TableRowData>(raw: unknown): TData[] {
  return mapBackendRowsToTableRows<unknown, TData & TableRowData>(
    raw,
    (row) => normalizeNullableRecordValues((row ?? {}) as TData & TableRowData)
  );
}

/**
 * Helper to create endpoint-level transform adapters.
 */
export function createFetchTransformAdapters<
  TParams = TableFetchParams,
  TData = TableRowData
>(
  adapters?: {
    mapParams?: ParamsMapper<TParams>;
    mapResponse?: ResponseMapper<TData>;
  }
): {
  mapParams: ParamsMapper<TParams>;
  mapResponse: ResponseMapper<TData>;
} {
  return {
    mapParams: adapters?.mapParams ?? defaultParamsMapper<TParams>,
    mapResponse: adapters?.mapResponse ?? defaultResponseMapper<TData>,
  };
}
