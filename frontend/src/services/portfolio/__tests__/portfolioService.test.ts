/**
 * Owner portfolio service tests — request shape and failure mapping.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createVenue,
  fetchOwnerPortfolio,
  hasOwnedBusiness,
  updateCompany,
  useCreateVenueMutation,
} from "../portfolioService";

const { mockGet, mockPost, mockPatch } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
}));

vi.mock("../../http", () => ({
  http: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

function companyUpdateFailure(status: number) {
  const response = { status } as AxiosResponse;
  return new AxiosError(
    "request failed",
    "ERR_BAD_RESPONSE",
    undefined,
    undefined,
    response,
  );
}

const emptyPortfolio = {
  owner: null,
  country: null,
  subscription: null,
  companies: [],
};

const ownedPortfolio = {
  owner: { _id: "o1", country: "Spain", subscription: "Free" },
  country: "Spain",
  subscription: "Free",
  companies: [
    {
      _id: "c1",
      country: "Spain",
      businesses: [
        {
          _id: "b1",
          tradeName: "Demo Bistro",
          currencyTrade: "EUR",
          companyId: "c1",
          profileComplete: false,
        },
      ],
    },
    {
      _id: "c2",
      country: "Spain",
      businesses: [
        {
          _id: "b2",
          tradeName: "Draft Cafe",
          currencyTrade: "EUR",
          companyId: "c2",
          profileComplete: false,
        },
      ],
    },
  ],
};

describe("portfolioService", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
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

  it("recognizes only venues present in the caller's portfolio", () => {
    expect(hasOwnedBusiness(ownedPortfolio, "b1")).toBe(true);
    expect(hasOwnedBusiness(ownedPortfolio, "b2")).toBe(true);
    expect(hasOwnedBusiness(ownedPortfolio, "not-owned")).toBe(false);
    expect(hasOwnedBusiness(undefined, "b1")).toBe(false);
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

  it("invalidates the portfolio and accessible-venue reads after creation", async () => {
    mockPost.mockResolvedValue({
      data: {
        business: { _id: "b1", tradeName: "New Venue", currencyTrade: "USD" },
        company: { _id: "c1", country: "USA" },
      },
    });
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useCreateVenueMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        tradeName: "New Venue",
        country: "USA",
        currencyTrade: "USD",
        company: {},
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["portfolio"] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["auth", "venues"],
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

  it("updates the Company identity through the owner Company route", async () => {
    mockPatch.mockResolvedValue({
      data: {
        _id: "c1",
        country: "Spain",
        legalName: "Demo Bistro SL",
        taxNumber: "B12345678",
      },
    });

    const result = await updateCompany("c1", {
      legalName: "Demo Bistro SL",
      taxNumber: "B12345678",
    });

    expect(mockPatch).toHaveBeenCalledWith("/api/v1/owners/companies/c1", {
      legalName: "Demo Bistro SL",
      taxNumber: "B12345678",
    });
    expect(result.legalName).toBe("Demo Bistro SL");
  });

  it("maps Company update conflicts to a machine failure code", async () => {
    mockPatch.mockRejectedValue(companyUpdateFailure(409));

    await expect(
      updateCompany("c1", { legalName: "Duplicate SL" }),
    ).rejects.toMatchObject({ code: "companyUpdate.conflict", status: 409 });
  });

  it("maps forbidden Company updates to a machine failure code", async () => {
    mockPatch.mockRejectedValue(companyUpdateFailure(403));

    await expect(
      updateCompany("c1", { taxNumber: "B12345678" }),
    ).rejects.toMatchObject({ code: "companyUpdate.forbidden", status: 403 });
  });

  it("maps a missing Company to a machine failure code", async () => {
    mockPatch.mockRejectedValue(companyUpdateFailure(404));

    await expect(
      updateCompany("missing", { legalName: "Unknown SL" }),
    ).rejects.toMatchObject({ code: "companyUpdate.notFound", status: 404 });
  });
});
