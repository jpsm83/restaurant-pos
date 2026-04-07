import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { normalizeQueryError, useDynamicTableData } from "../useDynamicTableData";

const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
  };
});

describe("useDynamicTableData", () => {
  it("normalizes unknown query errors", () => {
    expect(normalizeQueryError(null)).toBeNull();
    expect(normalizeQueryError("boom")?.message).toBe("boom");
  });

  it("maps useQuery response into stable shape", async () => {
    const refetch = vi.fn(async () => undefined);
    mockUseQuery.mockReturnValueOnce({
      data: { rows: [{ id: 1 }], total: 10 },
      isLoading: false,
      isError: false,
      error: null,
      refetch,
    });

    const { result } = renderHook(() =>
      useDynamicTableData({
        queryKey: () => ["k"],
        params: {},
        queryFn: async () => [{ id: 1 }],
      }),
    );

    expect(result.current.rows).toEqual([{ id: 1 }]);
    expect(result.current.total).toBe(10);
    await result.current.refetch();
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
