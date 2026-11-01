import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHttpGet, mockToServiceRequestError, mockUseQuery } = vi.hoisted(
  () => ({
    mockHttpGet: vi.fn(),
    mockToServiceRequestError: vi.fn(),
    mockUseQuery: vi.fn(),
  }),
);

vi.mock("../http", () => ({
  http: {
    get: (...args: unknown[]) => mockHttpGet(...args),
  },
}));

vi.mock("../serviceErrors", () => ({
  toServiceRequestError: (...args: unknown[]) =>
    mockToServiceRequestError(...args),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

import { getAccessibleVenues, useAccessibleVenuesQuery } from "../authVenues";

describe("authVenues service", () => {
  beforeEach(() => {
    mockHttpGet.mockReset();
    mockToServiceRequestError.mockReset();
    mockUseQuery.mockReset();
  });

  it("reads the session User's venues from the auth route", async () => {
    const venues = [
      {
        businessId: "b-1",
        tradeName: "Alpha Bar",
        source: "ownership",
        effectiveLayer: "admin",
        jobRoles: [],
        capabilities: ["openPrepScreens"],
        canEnterBusiness: true,
      },
    ];
    mockHttpGet.mockResolvedValueOnce({ data: { venues } });

    await expect(getAccessibleVenues()).resolves.toEqual(venues);
    expect(mockHttpGet).toHaveBeenCalledWith("/api/v1/auth/venues", {
      signal: undefined,
    });
  });

  it("normalizes a missing venue list to an empty array", async () => {
    mockHttpGet.mockResolvedValueOnce({ data: {} });

    await expect(getAccessibleVenues()).resolves.toEqual([]);
  });

  it("maps read errors through the venuesLoad service operation", async () => {
    const original = new Error("boom");
    const mapped = new Error("mapped");
    mockHttpGet.mockRejectedValueOnce(original);
    mockToServiceRequestError.mockReturnValueOnce(mapped);

    await expect(getAccessibleVenues()).rejects.toBe(mapped);
    expect(mockToServiceRequestError).toHaveBeenCalledWith(
      original,
      "venuesLoad",
    );
  });

  it("caches under the stable auth venues key", () => {
    useAccessibleVenuesQuery();

    const config = mockUseQuery.mock.calls[0][0] as {
      queryKey: readonly string[];
      enabled: boolean;
    };

    expect(config.queryKey).toEqual(["auth", "venues"]);
    expect(config.enabled).toBe(true);
  });

  it("stays disabled when the caller has no User", () => {
    useAccessibleVenuesQuery({ enabled: false });

    const config = mockUseQuery.mock.calls[0][0] as { enabled: boolean };
    expect(config.enabled).toBe(false);
  });
});
