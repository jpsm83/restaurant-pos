/**
 * Inventories DTOs — the request bodies, path params and query the inventories
 * routes accept.
 *
 * Backend-only (not shared with the frontend). Strict (unknown keys rejected)
 * and client-settable only: the server-owned `_id`, timestamps, `setFinalCount`
 * and the derived `quantityNeeded`/`deviationPercent` never appear in a DTO, so
 * a client that sends them gets a `400`. Every id is an ObjectId, the count
 * bodies carry the coerced counts and free-text fields, and the `monthDate` /
 * `month` query values are coerced and format-checked here rather than in the
 * route. The management-role, business-match and inventory-state guards span the
 * database and stay in the route as post-parse checks.
 */
import { z } from "zod";

import {
  coercedNumberSchema,
  freeTextString,
  objectIdSchema,
} from "domain/schemas/primitives";

/** Treat a blank string (an empty query value) as "not provided". */
const emptyToUndefined = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    schema,
  );

/** An optional query date; an empty string is treated as "not provided". */
const optionalMonthDateSchema = emptyToUndefined(z.coerce.date().optional());

/** A `YYYY-MM` month, transformed to its numeric year and 1-based month. */
const yearMonthSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-(0[1-9]|1[0-2])$/,
    "month must use the YYYY-MM format with a month from 01 to 12",
  )
  .transform((value) => {
    const [year, month] = value.split("-").map(Number) as [number, number];
    return { year, month };
  });

/** Body for `POST /inventories`. */
export const createInventoryBodySchema = z.strictObject({
  businessId: objectIdSchema,
});

/** Path params for `GET`/`DELETE /inventories/:inventoryId` and its actions. */
export const inventoryIdParamsSchema = z.strictObject({
  inventoryId: objectIdSchema,
});

/** Path params for `GET`/`PATCH /inventories/:inventoryId/supplierGood/:supplierGoodId/...`. */
export const inventorySupplierGoodParamsSchema = z.strictObject({
  inventoryId: objectIdSchema,
  supplierGoodId: objectIdSchema,
});

/** Path params for the `GET /inventories/business/:businessId/...` routes. */
export const businessIdParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/** Query selecting the month a good snapshot is scoped to. */
export const inventoryMonthDateQuerySchema = z.strictObject({
  monthDate: optionalMonthDateSchema,
});

/**
 * Body for `PATCH /inventories/:inventoryId/supplierGood/:supplierGoodId/addCount`.
 * `quantityNeeded` and `deviationPercent` are computed by the route, not the
 * client.
 */
export const addInventoryCountBodySchema = z.strictObject({
  currentCountQuantity: coercedNumberSchema,
  countedByEmployeeId: objectIdSchema,
  comments: freeTextString().optional(),
});

/**
 * Body for `PATCH /inventories/:inventoryId/supplierGood/:supplierGoodId/updateCount`.
 * `countId` targets the count being re-edited; `reason` is required for the
 * audit trail the route records under `reedited`.
 */
export const updateInventoryCountBodySchema = z.strictObject({
  countId: objectIdSchema,
  reason: freeTextString("Reason is required!"),
  currentCountQuantity: coercedNumberSchema.optional(),
  comments: freeTextString().optional(),
});

/**
 * Query for `GET /inventories/business/:businessId/varianceReport`. A malformed
 * `month` is rejected at the boundary; an absent one defaults to the current
 * month in the route.
 */
export const varianceReportQuerySchema = z.strictObject({
  month: emptyToUndefined(yearMonthSchema.optional()),
});

export type CreateInventoryBody = z.infer<typeof createInventoryBodySchema>;
export type InventoryIdParams = z.infer<typeof inventoryIdParamsSchema>;
export type InventorySupplierGoodParams = z.infer<
  typeof inventorySupplierGoodParamsSchema
>;
export type BusinessIdParams = z.infer<typeof businessIdParamsSchema>;
export type InventoryMonthDateQuery = z.infer<
  typeof inventoryMonthDateQuerySchema
>;
export type AddInventoryCountBody = z.infer<
  typeof addInventoryCountBodySchema
>;
export type UpdateInventoryCountBody = z.infer<
  typeof updateInventoryCountBodySchema
>;
export type VarianceReportQuery = z.infer<typeof varianceReportQuerySchema>;
