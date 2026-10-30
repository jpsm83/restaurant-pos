/**
 * Owner portfolio service — the customer dashboard's venue read and venue
 * registration. Network and React Query live here so pages stay declarative;
 * failures use the shared machine-code contract.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "../http";
import { queryKeys } from "../queryKeys";
import { toServiceRequestError } from "../serviceErrors";
import type { IOwnerPortfolio } from "restaurant-pos-packages/interfaces/IOwner";
import type { CreateBusinessBody } from "restaurant-pos-packages/schemas/business";

type VenueCompanyChoice =
  | { companyId: string; company?: never }
  | {
      companyId?: never;
      company?: { legalName?: string; taxNumber?: string };
    };

/** A venue registration: either joins an existing Company or forms a new one. */
export type CreateVenueInput = Pick<
  CreateBusinessBody,
  "tradeName" | "country" | "currencyTrade"
> &
  VenueCompanyChoice;

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
 * Registers a venue. The response carries the new Business and its Company;
 * the portfolio query is invalidated so the dashboard re-reads it. Exactly one
 * Company choice is sent: an existing Company id, or a new Company payload.
 */
export async function createVenue(
  input: CreateVenueInput,
): Promise<CreateVenueResult> {
  const companyId =
    "companyId" in input && typeof input.companyId === "string"
      ? input.companyId.trim()
      : undefined;
  const company = "companyId" in input ? undefined : input.company;
  const legalName = company?.legalName?.trim();
  const taxNumber = company?.taxNumber?.trim();
  try {
    const { data } = await http.post<CreateVenueResult>("/api/v1/business", {
      tradeName: input.tradeName.trim(),
      country: input.country.trim(),
      currencyTrade: input.currencyTrade,
      ...(companyId
        ? { companyId }
        : {
            company: {
              ...(legalName ? { legalName } : {}),
              ...(taxNumber ? { taxNumber } : {}),
            },
          }),
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
