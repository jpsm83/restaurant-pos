import type { IOwnerPortfolioCompany } from "restaurant-pos-packages/interfaces/IOwner";

type CompanyIdentity = Pick<
  IOwnerPortfolioCompany,
  "legalName" | "taxNumber"
>;

/** A Company's human label: legal name, then tax number, then a fallback. */
export function companyDisplayName(
  company: CompanyIdentity,
  fallback: string,
): string {
  return company.legalName || company.taxNumber || fallback;
}
