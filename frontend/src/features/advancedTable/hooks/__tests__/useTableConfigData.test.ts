import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeLoadedConfigColumns,
  normalizeSaveRequestPayload,
  useTableConfigData,
} from "../useTableConfigData";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockHttpGet = vi.fn();
const mockHttpPost = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
    useMutation: (...args: unknown[]) => mockUseMutation(...args),
  };
});

vi.mock("@/services/http", () => ({
  http: {
    get: (...args: unknown[]) => mockHttpGet(...args),
    post: (...args: unknown[]) => mockHttpPost(...args),
  },
}));

describe("useTableConfigData", () => {
  it("normalizes load and save payloads", () => {
    expect(
      normalizeLoadedConfigColumns({
        tableConfig: { columns: [{ key: "id", label: "ID" }] },
      }),
    ).toEqual([
      { columnKey: "id", columnName: "ID", order: 0, enable: true, visible: true },
    ]);

    const payload = normalizeSaveRequestPayload(
      [{ columnKey: "id", columnName: "ID", order: 9, enable: true, visible: false }],
      false,
    );
    expect(payload.tableConfig.columns[0]).toMatchObject({ order: 0, visible: true });
  });

  it("maps load failures to tableConfigLoad machine codes", async () => {
    mockHttpGet.mockRejectedValueOnce({
      isAxiosError: true,
      message: "Request failed",
      response: { status: 403, data: { detail: "Forbidden" } },
    });
    mockUseQuery.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseMutation.mockReturnValueOnce({
      isPending: false,
      error: null,
      mutateAsync: vi.fn(),
    });

    renderHook(() => useTableConfigData({ loadUrl: "/load", saveUrl: "/save" }));

    const queryConfig = mockUseQuery.mock.calls.at(-1)?.[0] as {
      queryFn: () => Promise<unknown>;
    };
    await expect(queryConfig.queryFn()).rejects.toMatchObject({
      code: "tableConfigLoad.forbidden",
      status: 403,
      serverMessage: "Forbidden",
    });
  });

  it("maps save failures to tableConfigSave machine codes", async () => {
    mockHttpPost.mockRejectedValueOnce({
      isAxiosError: true,
      message: "Request failed",
      response: { status: 409, data: { detail: "Conflict" } },
    });
    mockUseQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseMutation.mockReturnValueOnce({
      isPending: false,
      error: null,
      mutateAsync: vi.fn(),
    });

    renderHook(() => useTableConfigData({ loadUrl: "/load", saveUrl: "/save" }));

    const mutationConfig = mockUseMutation.mock.calls.at(-1)?.[0] as {
      mutationFn: (columns: unknown[]) => Promise<unknown>;
    };
    await expect(mutationConfig.mutationFn([])).rejects.toMatchObject({
      code: "tableConfigSave.conflict",
      status: 409,
      serverMessage: "Conflict",
    });
  });

  it("returns computed state and handles save/reload paths", async () => {
    const refetch = vi.fn(async () => undefined);
    const mutateAsync = vi.fn(async () => true);
    mockUseQuery.mockReturnValueOnce({
      data: [{ columnKey: "id", columnName: "ID", order: 0, enable: true, visible: true }],
      isLoading: false,
      error: null,
      refetch,
    });
    mockUseMutation.mockReturnValueOnce({
      isPending: false,
      error: null,
      mutateAsync,
    });

    const { result } = renderHook(() =>
      useTableConfigData({ loadUrl: "/load", saveUrl: "/save" }),
    );

    expect(result.current.columns).toHaveLength(1);
    expect(await result.current.save(result.current.columns)).toBe(true);
    await result.current.reload();
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
