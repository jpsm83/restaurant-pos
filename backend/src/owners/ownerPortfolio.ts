/**
 * ownerPortfolio — the read model behind the customer dashboard's venue list.
 *
 * Scopes every read through User → Owner → Company → Business, so a caller can
 * only ever see their own portfolio. A User without an Owner gets an empty
 * portfolio. Each Business carries a `profileComplete` signal for the draft
 * warning; it is the identity/contact part of the go-live checklist plus the
 * owning Company's tax identity, never a statement that the venue is live.
 */

import type { Types } from "mongoose";
import type { IBusiness } from "restaurant-pos-packages/interfaces/IBusiness";
import type { ICompany } from "restaurant-pos-packages/interfaces/ICompany";
import type { IOwner } from "restaurant-pos-packages/interfaces/IOwner";
import type {
  IOwnerPortfolio,
  IOwnerPortfolioBusiness,
  IOwnerPortfolioCompany,
} from "restaurant-pos-packages/interfaces/IOwner";

import Business from "../models/business.ts";
import Company from "../models/company.ts";
import Owner from "../models/owner.ts";

type BusinessRecord = IBusiness & { _id: Types.ObjectId };
type CompanyRecord = ICompany & { _id: Types.ObjectId };

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasCompleteAddress(address: BusinessRecord["address"]): boolean {
  if (!address) return false;
  return (
    isNonEmptyString(address.country) &&
    isNonEmptyString(address.state) &&
    isNonEmptyString(address.city) &&
    isNonEmptyString(address.street) &&
    isNonEmptyString(address.buildingNumber) &&
    isNonEmptyString(address.postCode)
  );
}

/**
 * Whether the venue profile and its Company identity are complete enough for
 * the draft warning to disappear. Operational go-live requirements (opening
 * hours, menu, sales points, payments, print kit) are deliberately excluded.
 */
function isBusinessProfileComplete(
  business: Pick<
    BusinessRecord,
    | "tradeName"
    | "currencyTrade"
    | "phoneNumber"
    | "email"
    | "emailVerified"
    | "address"
  >,
  company: Pick<CompanyRecord, "legalName" | "taxNumber"> | null | undefined,
): boolean {
  return (
    isNonEmptyString(business.tradeName) &&
    isNonEmptyString(business.currencyTrade) &&
    isNonEmptyString(business.phoneNumber) &&
    isNonEmptyString(business.email) &&
    business.emailVerified === true &&
    hasCompleteAddress(business.address) &&
    isNonEmptyString(company?.legalName) &&
    isNonEmptyString(company?.taxNumber)
  );
}

function toPortfolioBusiness(
  business: BusinessRecord,
  company: CompanyRecord,
): IOwnerPortfolioBusiness {
  return {
    _id: String(business._id),
    tradeName: business.tradeName,
    currencyTrade: business.currencyTrade,
    companyId: String(company._id),
    profileComplete: isBusinessProfileComplete(business, company),
    ...(business.imageUrl ? { imageUrl: business.imageUrl } : {}),
    ...(business.address ? { address: business.address } : {}),
  };
}

function toPortfolioCompany(
  company: CompanyRecord,
  businesses: BusinessRecord[],
): IOwnerPortfolioCompany {
  return {
    _id: String(company._id),
    country: company.country,
    businesses: businesses.map((business) =>
      toPortfolioBusiness(business, company),
    ),
    ...(company.legalName ? { legalName: company.legalName } : {}),
    ...(company.taxNumber ? { taxNumber: company.taxNumber } : {}),
  };
}

/** Reads the caller's Owner, Companies and Businesses in one portfolio shape. */
export async function readOwnerPortfolio(
  userId: string,
): Promise<IOwnerPortfolio> {
  const owner = (await Owner.findOne({ userId }).lean()) as
    | (IOwner & { _id: Types.ObjectId })
    | null;

  if (!owner) {
    return {
      owner: null,
      country: null,
      subscription: null,
      companies: [],
    };
  }

  const companies = (await Company.find({ ownerId: owner._id })
    .sort({ createdAt: 1 })
    .lean()) as CompanyRecord[];

  const businesses = (await Business.find({
    companyId: { $in: companies.map((company) => company._id) },
  })
    .sort({ createdAt: 1 })
    .lean()) as BusinessRecord[];

  const businessesByCompany = new Map<string, BusinessRecord[]>();
  for (const business of businesses) {
    const companyId = String(business.companyId);
    const existing = businessesByCompany.get(companyId);
    if (existing) existing.push(business);
    else businessesByCompany.set(companyId, [business]);
  }

  return {
    owner: {
      _id: String(owner._id),
      country: owner.country,
      subscription: owner.subscription,
    },
    country: owner.country,
    subscription: owner.subscription,
    companies: companies.map((company) =>
      toPortfolioCompany(
        company,
        businessesByCompany.get(String(company._id)) ?? [],
      ),
    ),
  };
}
