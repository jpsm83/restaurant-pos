/**
 * Owner portfolio service — the customer dashboard's venue read and the first
 * venue registration. Network and React Query live here so pages stay
 * declarative; failures use the shared machine-code contract.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "../http";
import { queryKeys } from "../queryKeys";
import { toServiceRequestError } from "../serviceErrors";
import type { IOwnerPortfolio } from "restaurant-pos-packages/interfaces/IOwner";
import type { CreateBusinessBody } from "restaurant-pos-packages/schemas/business";

/** The first-venue subset of the shared registration body. */
export type CreateVenueInput = Pick<
  CreateBusinessBody,
  "tradeName" | "country" | "currencyTrade" | "company"
>;

export type CreateVenueResult = {
  business: {
    _id: string;
    tradeName: string;
    currencyTrade: string;
    companyId?: string;
    address?: { country?: string };
  };
  company: {
    _id: string;
    country: string;
    legalName?: string;
    taxNumber?: string;
  };
};

/** Reads only the signed-in User's Owner portfolio. */
export async function fetchOwnerPortfolio(
  signal?: AbortSignal,
): Promise<IOwnerPortfolio> {
  try {
    const { data } = await http.get<IOwnerPortfolio>(
      "/api/v1/owners/portfolio",
      { signal },
    );
    return data;
  } catch (error) {
    throw toServiceRequestError(error, "portfolioFetch");
  }
}

/**
 * Registers the first venue. The response carries the new Business and its
 * Company; the portfolio query is invalidated so the dashboard re-reads it.
 */
export async function createVenue(
  input: CreateVenueInput,
): Promise<CreateVenueResult> {
  const legalName = input.company?.legalName?.trim();
  const taxNumber = input.company?.taxNumber?.trim();
  try {
    const { data } = await http.post<CreateVenueResult>("/api/v1/business", {
      tradeName: input.tradeName.trim(),
      country: input.country.trim(),
      currencyTrade: input.currencyTrade,
      company: {
        ...(legalName ? { legalName } : {}),
        ...(taxNumber ? { taxNumber } : {}),
      },
    });
    return data;
  } catch (error) {
    throw toServiceRequestError(error, "businessCreate");
  }
}

export function useOwnerPortfolioQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.portfolio.byUser(userId ?? "anonymous"),
    queryFn: ({ signal }) => fetchOwnerPortfolio(signal),
    enabled: Boolean(userId),
  });
}

export function useCreateVenueMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createVenue,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() }),
  });
}
