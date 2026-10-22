/**
 * Supplier DTOs — the request bodies and path params the suppliers routes
 * accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `imageUrl` never appears in a DTO, so a client that sends it gets a `400`. The
 * create and update bodies are consumed through the shared multipart helper, so
 * the JSON-encoded `address` field is parsed and validated here; `email` is
 * normalized (trimmed and lowercased). The reserved "One Time Purchase" guard
 * and the in-use delete guard stay as post-parse checks in the route, because
 * they depend on database state or span more than one field.
 */
import { z } from "zod";

import { addressSchema } from "./address.ts";
import {
  coercedBooleanSchema,
  emailSchema,
  emptyToUndefined,
  jsonField,
  objectIdSchema,
  sanitizedString,
} from "./primitives.ts";

const supplierFields = {
  tradeName: sanitizedString("Trade name is required!"),
  legalName: sanitizedString("Legal name is required!"),
  email: emailSchema,
  phoneNumber: sanitizedString("Phone number is required!"),
  taxNumber: sanitizedString("Tax number is required!"),
  address: jsonField(addressSchema),
  currentlyInUse: coercedBooleanSchema,
  contactPerson: z.preprocess(emptyToUndefined, sanitizedString().optional()),
};

/**
 * Body for `POST /suppliers` (multipart). The uploaded logo is collected by the
 * multipart helper as a file, not a field; `imageUrl` is server-owned and
 * rejected here.
 */
export const createSupplierBodySchema = z.strictObject({
  ...supplierFields,
  businessId: objectIdSchema,
});

/**
 * Body for `PATCH /suppliers/:supplierId` (multipart). Same fields as create,
 * but the supplier is identified by its path param and `businessId` is not
 * client-settable on update.
 */
export const updateSupplierBodySchema = createSupplierBodySchema.omit({
  businessId: true,
});

/** Path params for `GET`/`PATCH`/`DELETE /suppliers/:supplierId`. */
export const supplierIdParamsSchema = z.strictObject({
  supplierId: objectIdSchema,
});

/** Path params for `GET /suppliers/business/:businessId`. */
export const supplierByBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/** Optional query for supplier reads: include soft-deleted records explicitly. */
export const supplierIncludeDeletedQuerySchema = z.strictObject({
  includeDeleted: z.preprocess(emptyToUndefined, coercedBooleanSchema.optional()),
});

export type CreateSupplierBody = z.infer<typeof createSupplierBodySchema>;
export type UpdateSupplierBody = z.infer<typeof updateSupplierBodySchema>;
export type SupplierIdParams = z.infer<typeof supplierIdParamsSchema>;
export type SupplierByBusinessParams = z.infer<
  typeof supplierByBusinessParamsSchema
>;
export type SupplierIncludeDeletedQuery = z.infer<
  typeof supplierIncludeDeletedQuerySchema
>;
