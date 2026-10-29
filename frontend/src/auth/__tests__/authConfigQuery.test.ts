import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
  };
});

import { useAuthConfigQuery } from "../api";

describe("useAuthConfigQuery", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("caches under the auth config key without retries", () => {
    useAuthConfigQuery();

    const config = mockUseQuery.mock.calls[0][0] as {
      queryKey: readonly string[];
      retry: boolean;
    };

    expect(config.queryKey).toEqual(["auth", "config"]);
    expect(config.retry).toBe(false);
  });
});
