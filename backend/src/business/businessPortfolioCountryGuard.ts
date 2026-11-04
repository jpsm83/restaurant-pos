/**
 * Portfolio-country guard for venue profile writes.
 *
 * Every Business shares its owning Company's country. Registration enforces
 * that invariant; this guard stops a later profile update from moving the
 * address to a different country. A same-country update passes through so the
 * address can still be completed and the derived timezone recomputed.
 */

import { Types } from "mongoose";

import { badRequest } from "../errors/appError.ts";
import Company from "../models/company.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";

/**
 * Refuse an address country that differs from the owning Company's country.
 * A request without a country is a no-op. When a country is supplied, the
 * owning Company must resolve: a Business with no Company cannot verify the
 * invariant, so it must not be allowed to move countries.
 */
export async function assertBusinessAddressCountryAllowed(params: {
  companyId?: Types.ObjectId | string;
  nextCountry?: string;
}): Promise<void> {
  if (params.nextCountry === undefined) {
    return;
  }

  const company = params.companyId
    ? await Company.findOne(withSoftDeleteFilter({ _id: params.companyId }))
        .select("country")
        .lean()
    : null;

  if (!company) {
    throw badRequest(
      "Business has no owning Company; its address country cannot be changed!",
    );
  }

  if (company.country !== params.nextCountry) {
    throw badRequest(
      "Business address country must match the owning Company's country!",
    );
  }
}
