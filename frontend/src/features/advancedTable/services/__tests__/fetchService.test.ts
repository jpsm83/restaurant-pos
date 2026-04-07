import { describe, expect, it, vi } from "vitest";
import { createTableQueryOptions } from "../fetchService";

const httpGet = vi.fn();
const httpPost = vi.fn();

vi.mock("@/services/http", () => ({
  http: {
    get: (...args: unknown[]) => httpGet(...args),
    post: (...args: unknown[]) => httpPost(...args),
  },
}));

describe("advancedTable fetchService", () => {
  it("uses custom queryFn when provided", async () => {
    const options = createTableQueryOptions({
      queryKey: (params: { q: string }) => ["table", params.q],
      params: { q: "abc" },
      queryFn: async (params: { q: string }) => [{ value: params.q }],
    });

    const result = await options.queryFn({});

    expect(options.queryKey).toEqual(["table", "abc"]);
    expect(result).toEqual({ rows: [{ value: "abc" }] });
  });

  it("uses endpoint GET and maps response", async () => {
    httpGet.mockResolvedValueOnce({ data: [{ id: 1 }] });

    const options = createTableQueryOptions({
      queryKey: () => ["k"],
      params: { page: 1 },
      endpoint: { url: "/api/test", method: "GET" },
    });

    const result = await options.queryFn({});
    expect(httpGet).toHaveBeenCalledWith("/api/test", {
      params: { page: 1 },
      signal: undefined,
    });
    expect(result.rows).toEqual([{ id: 1 }]);
  });

  it("uses endpoint POST and throws when endpoint/queryFn missing", async () => {
    httpPost.mockResolvedValueOnce({ data: [{ id: "p1" }] });

    const options = createTableQueryOptions({
      queryKey: () => ["k"],
      params: { page: 1 },
      endpoint: { url: "/api/test", method: "POST" },
    });

    const result = await options.queryFn({});
    expect(httpPost).toHaveBeenCalledWith("/api/test", { page: 1 }, { signal: undefined });
    expect(result.rows).toEqual([{ id: "p1" }]);

    const noEndpoint = createTableQueryOptions({
      queryKey: () => ["bad"],
      params: {},
    });

    await expect(noEndpoint.queryFn({})).rejects.toThrow(
      "createTableQueryOptions requires endpoint or queryFn.",
    );
  });
});
