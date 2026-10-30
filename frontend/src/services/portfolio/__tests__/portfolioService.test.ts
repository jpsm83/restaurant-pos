/**
 * Owner portfolio service tests — request shape and failure mapping.
 */
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVenue, fetchOwnerPortfolio } from "../portfolioService";

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("../../http", () => ({
  http: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

const emptyPortfolio = {
  owner: null,
  country: null,
  subscription: null,
  companies: [],
};

describe("portfolioService", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("reads the caller's portfolio from the owner portfolio endpoint", async () => {
    mockGet.mockResolvedValue({ data: emptyPortfolio });
    const controller = new AbortController();

    const result = await fetchOwnerPortfolio(controller.signal);

    expect(mockGet).toHaveBeenCalledWith("/api/v1/owners/portfolio", {
      signal: controller.signal,
    });
    expect(result).toEqual(emptyPortfolio);
  });

  it("registers a first venue with an optional new Company", async () => {
    mockPost.mockResolvedValue({
      data: {
        business: {
          _id: "64b000000000000000000001",
          tradeName: "Demo Bistro",
          currencyTrade: "EUR",
          companyId: "64b000000000000000000002",
        },
        company: {
          _id: "64b000000000000000000002",
          country: "Spain",
          legalName: "Demo Bistro SL",
          taxNumber: "B12345678",
        },
      },
    });

    const result = await createVenue({
      tradeName: "  Demo Bistro  ",
      country: "  Spain ",
      currencyTrade: "EUR",
      company: {
        legalName: "  Demo Bistro SL ",
        taxNumber: " B12345678 ",
      },
    });

    expect(mockPost).toHaveBeenCalledWith("/api/v1/business", {
      tradeName: "Demo Bistro",
      country: "Spain",
      currencyTrade: "EUR",
      company: {
        legalName: "Demo Bistro SL",
        taxNumber: "B12345678",
      },
    });
    expect(result.company.legalName).toBe("Demo Bistro SL");
  });

  it("joins an existing Company by id without sending new Company fields", async () => {
    mockPost.mockResolvedValue({
      data: {
        business: { _id: "b2", tradeName: "Joined Venue", currencyTrade: "EUR" },
        company: { _id: "c1", country: "Spain", legalName: "Demo Bistro SL" },
      },
    });

    await createVenue({
      tradeName: " Joined Venue ",
      country: " Spain ",
      currencyTrade: "EUR",
      companyId: " c1 ",
    });

    expect(mockPost).toHaveBeenCalledWith("/api/v1/business", {
      tradeName: "Joined Venue",
      country: "Spain",
      currencyTrade: "EUR",
      companyId: "c1",
    });
  });

  it("omits blank Company fields from the registration payload", async () => {
    mockPost.mockResolvedValue({
      data: {
        business: { _id: "b1", tradeName: "Draft", currencyTrade: "USD" },
        company: { _id: "c1", country: "USA" },
      },
    });

    await createVenue({
      tradeName: "Draft",
      country: "USA",
      currencyTrade: "USD",
      company: { legalName: " ", taxNumber: "" },
    });

    expect(mockPost).toHaveBeenCalledWith("/api/v1/business", {
      tradeName: "Draft",
      country: "USA",
      currencyTrade: "USD",
      company: {},
    });
  });

  it("maps registration conflicts to a machine failure code", async () => {
    const response = {
      status: 409,
      data: { type: "https://restaurant-pos.app/errors/conflict" },
    } as AxiosResponse;
    mockPost.mockRejectedValue(
      new AxiosError("conflict", "ERR_BAD_REQUEST", undefined, undefined, response),
    );

    await expect(
      createVenue({ tradeName: "Dup", country: "USA", currencyTrade: "USD" }),
    ).rejects.toMatchObject({ code: "businessCreate.conflict", status: 409 });
  });
});
