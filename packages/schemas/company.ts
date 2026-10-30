/**
 * Company DTOs — the request bodies and path params the Owner Company routes
 * accept.
 *
 * A Company's legal name and tax number are optional while it is a draft, so
 * both fields are optional on update. A `null` clears a field; an omitted field
 * stays unchanged. Uniqueness among active Companies in the same country is
 * enforced by the model's partial indexes, not here.
 */
import { z } from "zod";

import { objectIdSchema, sanitizedString } from "./primitives.ts";

/** A non-blank identity field; `null` clears it, omission leaves it unchanged. */
const companyIdentityFieldSchema = sanitizedString()
  .min(1, "Company identity must not be empty")
  .nullable()
  .optional();

/** Body for `PATCH /owners/companies/:companyId`. */
export const updateCompanyBodySchema = z.strictObject({
  legalName: companyIdentityFieldSchema,
  taxNumber: companyIdentityFieldSchema,
});

export type UpdateCompanyBody = z.infer<typeof updateCompanyBodySchema>;

/** Path params for a Company addressed by id. */
export const companyIdParamsSchema = z.strictObject({
  companyId: objectIdSchema,
});

export type CompanyIdParams = z.infer<typeof companyIdParamsSchema>;
