/**
 * updateOwnerCompany — the Owner-scoped write behind the Company page.
 *
 * The route never takes an Owner id from the client: it resolves the caller's
 * Owner and then the Company through that Owner, so one Owner can never edit
 * another's tax identity. Active uniqueness is enforced by the Company model's
 * partial indexes; a duplicate surfaces as a conflict.
 */
import type { Types } from "mongoose";
import type { ICompany } from "restaurant-pos-packages/interfaces/ICompany";

import Company from "../models/company.ts";
import Owner from "../models/owner.ts";

export type OwnerCompanyErrorCode =
  | "company-not-found"
  | "company-not-owned"
  | "company-duplicate";

export class OwnerCompanyError extends Error {
  readonly code: OwnerCompanyErrorCode;

  constructor(code: OwnerCompanyErrorCode, message: string) {
    super(message);
    this.name = "OwnerCompanyError";
    this.code = code;
  }
}

export type OwnerCompanySummary = {
  _id: string;
  country: string;
  legalName?: string;
  taxNumber?: string;
};

export type UpdateOwnerCompanyInput = {
  userId: string;
  companyId: string;
  legalName?: string | null;
  taxNumber?: string | null;
};

function toOwnerCompanySummary(
  company: ICompany & { _id: Types.ObjectId },
): OwnerCompanySummary {
  return {
    _id: String(company._id),
    country: company.country,
    ...(company.legalName ? { legalName: company.legalName } : {}),
    ...(company.taxNumber ? { taxNumber: company.taxNumber } : {}),
  };
}

export async function updateOwnerCompany(
  input: UpdateOwnerCompanyInput,
): Promise<OwnerCompanySummary> {
  const owner = await Owner.findOne({ userId: input.userId })
    .select("_id")
    .lean();
  if (!owner) {
    throw new OwnerCompanyError(
      "company-not-owned",
      "Company does not belong to this Owner!",
    );
  }

  // Scope the lookup through the Owner so a foreign Company id is not found
  // rather than distinguishable by a different status.
  const company = await Company.findOne({
    _id: input.companyId,
    ownerId: owner._id,
  });
  if (!company) {
    throw new OwnerCompanyError("company-not-found", "Company not found!");
  }

  const updates: Pick<UpdateOwnerCompanyInput, "legalName" | "taxNumber"> = {};
  if (input.legalName !== undefined) updates.legalName = input.legalName;
  if (input.taxNumber !== undefined) updates.taxNumber = input.taxNumber;

  if (Object.keys(updates).length === 0) {
    return toOwnerCompanySummary(company);
  }

  try {
    const updated = await Company.findByIdAndUpdate(
      company._id,
      { $set: updates },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated) {
      throw new OwnerCompanyError("company-not-found", "Company not found!");
    }
    return toOwnerCompanySummary(updated);
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === 11000) {
      throw new OwnerCompanyError(
        "company-duplicate",
        "Company legal name or tax number already exists!",
      );
    }
    throw error;
  }
}
