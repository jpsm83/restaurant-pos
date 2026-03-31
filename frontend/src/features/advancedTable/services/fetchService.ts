import type { QueryKey } from "@tanstack/react-query";
import type {
  TableFetchParams,
  TableFetchResponse,
  TableRowData,
} from "@/features/advancedTable/types/tableContracts";
import { http } from "@/services/http";
import {
  createFetchTransformAdapters,
  type ParamsMapper,
  type ResponseMapper,
} from "@/features/advancedTable/services/fetchAdapters";

export interface StandaloneFetchEndpointConfig<TData = TableRowData, TParams = TableFetchParams> {
  url: string;
  method?: "GET" | "POST";
  mapParams?: ParamsMapper<TParams>;
  mapResponse?: ResponseMapper<TData>;
}

export interface StandaloneFetchConfig<TData = TableRowData, TParams = TableFetchParams> {
  queryKey: (params: TParams) => QueryKey;
  endpoint?: StandaloneFetchEndpointConfig<TData, TParams>;
  queryFn?: (params: TParams, signal?: AbortSignal) => Promise<TData[]>;
  params: TParams;
}

/**
 * Builds query options compatible with TanStack Query useQuery API.
 */
export function createTableQueryOptions<TData = TableRowData, TParams = TableFetchParams>(
  config: StandaloneFetchConfig<TData, TParams>
) {
  const queryKey = config.queryKey(config.params);

  const queryFn = async ({ signal }: { signal?: AbortSignal }): Promise<TableFetchResponse<TData>> => {
    if (config.queryFn) {
      const rows = await config.queryFn(config.params, signal);
      return { rows };
    }

    if (!config.endpoint) {
      throw new Error("createTableQueryOptions requires endpoint or queryFn.");
    }

    const { endpoint } = config;
    const method = endpoint.method ?? "GET";
    const adapters = createFetchTransformAdapters<TParams, TData>({
      mapParams: endpoint.mapParams,
      mapResponse: endpoint.mapResponse,
    });
    const mappedParams = adapters.mapParams(config.params);

    const response =
      method === "POST"
        ? await http.post(endpoint.url, mappedParams, { signal })
        : await http.get(endpoint.url, { params: mappedParams, signal });

    const rows = adapters.mapResponse(response.data);

    return { rows };
  };

  return {
    queryKey,
    queryFn,
  };
}
