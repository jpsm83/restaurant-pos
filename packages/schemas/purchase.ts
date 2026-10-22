/**
 * Purchase DTOs — the request bodies, path params and query the `purchases`
 * routes accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `_id`, `totalAmount`, `oneTimePurchase`, `documentsUrl` (set from uploaded
 * files) and the timestamps never appear in a DTO, so a client that sends them
 * gets a `400`. The create body's `supplierId` is either a real supplier id or
 * the `"One Time Purchase"` sentinel; `purchaseDate` is coerced to a `Date`
 * (multipart sends it as a string), and the line items carry a coerced quantity
 * and price. The `startDate`/`endDate` query values are `YYYY-MM-DD` calendar
 * dates. Cross-field and database-dependent rules stay in the route as named
 * post-parse checks: the one-time-purchase comment rule, the
 * `startDate <= endDate` range rule, `validateInventoryPurchaseItems`, the
 * duplicate-receipt guard and the management-role guard.
 */
import { z } from "zod";

import {
  calendarDateSchema,
  coercedBooleanSchema,
  coercedNumberSchema,
  emptyToUndefined,
  freeTextString,
  objectIdSchema,
  sanitizedString,
} from "./primitives.ts";

/** The sentinel a client sends as `supplierId` for an ad-hoc purchase. */
export const ONE_TIME_PURCHASE_SUPPLIER = "One Time Purchase";

/** An optional query value; an empty string means "not provided". */
const calendarDateQuerySchema = z.preprocess(
  emptyToUndefined,
  calendarDateSchema.optional(),
);

/** An optional form field; an empty string means "not provided". */
const optionalSanitizedString = z.preprocess(
  emptyToUndefined,
  sanitizedString().optional(),
);

/** An optional free-text form field; an empty string means "not provided". */
const optionalFreeText = z.preprocess(
  emptyToUndefined,
  freeTextString().optional(),
);

/** An optional coerced date; an empty string means "not provided". */
const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());

/**
 * A purchase line. `supplierGoodId` is left unvalidated as an ObjectId here:
 * the one-time-purchase flow discards it, so `validateInventoryPurchaseItems`
 * owns that check for real purchases.
 */
const purchaseItemFields = {
  supplierGoodId: z.string().trim().optional(),
  quantityPurchased: coercedNumberSchema,
  purchasePrice: coercedNumberSchema,
};

/**
 * Body for `POST /purchases`. Uploaded receipt files are collected by the
 * multipart helper; `oneTimePurchase`, `totalAmount` and `documentsUrl` are
 * server-owned.
 */
export const createPurchaseBodySchema = z.strictObject({
  supplierId: z.union([z.literal(ONE_TIME_PURCHASE_SUPPLIER), objectIdSchema]),
  purchaseDate: z.coerce.date("Purchase date is required!"),
  businessId: objectIdSchema,
  purchasedByEmployeeId: objectIdSchema,
  receiptId: sanitizedString("Receipt id is required!"),
  title: optionalSanitizedString,
  comment: optionalFreeText,
  purchaseInventoryItems: z.array(z.strictObject(purchaseItemFields)),
});

/**
 * Body for the multipart `PATCH /purchases/:purchaseId`. `businessId` and
 * `purchasedByEmployeeId` are required (the form always submits them); the
 * remaining fields are optional. Uploaded documents are collected as files.
 */
export const updatePurchaseBodySchema = z.strictObject({
  businessId: objectIdSchema,
  purchasedByEmployeeId: objectIdSchema,
  title: optionalSanitizedString,
  purchaseDate: optionalDate,
  receiptId: optionalSanitizedString,
});

/** Path params for `GET`/`PATCH`/`DELETE /purchases/:purchaseId`. */
export const purchaseIdParamsSchema = z.strictObject({
  purchaseId: objectIdSchema,
});

/** Path params for `GET /purchases/supplier/:supplierId`. */
export const purchaseBySupplierParamsSchema = z.strictObject({
  supplierId: objectIdSchema,
});

/** Path params for `GET /purchases/user/:userId`. */
export const purchaseByUserParamsSchema = z.strictObject({
  userId: objectIdSchema,
});

/**
 * Query for the purchase list routes: `startDate`/`endDate` are `YYYY-MM-DD`
 * calendar dates. The ordering rule stays in the route as a post-parse check.
 */
export const purchasesQuerySchema = z.strictObject({
  startDate: calendarDateQuerySchema,
  endDate: calendarDateQuerySchema,
  includeDeleted: z.preprocess(emptyToUndefined, coercedBooleanSchema.optional()),
});

/** Body for `PATCH /purchases/:purchaseId/addSupplierGood`. */
export const addPurchaseItemBodySchema = z.strictObject({
  supplierGoodId: objectIdSchema,
  quantityPurchased: coercedNumberSchema,
  purchasePrice: coercedNumberSchema,
});

/** Body for `PATCH /purchases/:purchaseId/deleteSupplierGood`. */
export const deletePurchaseItemBodySchema = z.strictObject({
  purchaseInventoryItemsId: objectIdSchema,
});

/**
 * Body for `PATCH /purchases/:purchaseId/editSupplierGood`. `reason` is required
 * for the audit trail; the new quantity and price are optional.
 */
export const editPurchaseItemBodySchema = z.strictObject({
  purchaseInventoryItemsId: objectIdSchema,
  reason: freeTextString("Reason is required!"),
  newQuantityPurchased: coercedNumberSchema.optional(),
  newPurchasePrice: coercedNumberSchema.optional(),
});

export type CreatePurchaseBody = z.infer<typeof createPurchaseBodySchema>;
export type UpdatePurchaseBody = z.infer<typeof updatePurchaseBodySchema>;
export type PurchaseIdParams = z.infer<typeof purchaseIdParamsSchema>;
export type PurchaseBySupplierParams = z.infer<
  typeof purchaseBySupplierParamsSchema
>;
export type PurchaseByUserParams = z.infer<typeof purchaseByUserParamsSchema>;
export type PurchasesQuery = z.infer<typeof purchasesQuerySchema>;
export type AddPurchaseItemBody = z.infer<typeof addPurchaseItemBodySchema>;
export type DeletePurchaseItemBody = z.infer<
  typeof deletePurchaseItemBodySchema
>;
export type EditPurchaseItemBody = z.infer<typeof editPurchaseItemBodySchema>;
