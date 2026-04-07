import { describe, expect, it } from "vitest";
import { queryClient } from "../queryClient";

function axiosLikeError(status?: number): unknown {
  if (status === undefined) return { message: "Network error" };
  return { response: { status } };
}

describe("queryClient defaults", () => {
  it("configures retry and stale policies", () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(60_000);
    expect(defaults.queries?.gcTime).toBe(10 * 60_000);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.queries?.throwOnError).toBe(false);
    expect(defaults.mutations?.throwOnError).toBe(false);
  });

  it("retries transient query errors only", () => {
    const queryRetry = defaultsRetry("queries");
    expect(queryRetry(0, axiosLikeError())).toBe(true);
    expect(queryRetry(0, axiosLikeError(500))).toBe(true);
    expect(queryRetry(0, axiosLikeError(429))).toBe(true);
    expect(queryRetry(0, axiosLikeError(408))).toBe(true);
    expect(queryRetry(0, axiosLikeError(404))).toBe(false);
    expect(queryRetry(2, axiosLikeError(500))).toBe(false);
  });

  it("applies stricter mutation retry limit", () => {
    const mutationRetry = defaultsRetry("mutations");
    expect(mutationRetry(0, axiosLikeError(500))).toBe(true);
    expect(mutationRetry(1, axiosLikeError(500))).toBe(false);
  });
});

function defaultsRetry(type: "queries" | "mutations") {
  const defaults = queryClient.getDefaultOptions();
  const retry = defaults[type]?.retry;
  if (typeof retry !== "function") {
    throw new Error("Expected retry strategy to be a function");
  }
  return retry;
}
