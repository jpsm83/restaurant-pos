/**
 * SalesPoints DTOs — the request bodies and path params the salesPoints routes
 * accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `qrCode` (and the timestamps) never appear in a DTO, so a client that sends
 * them gets a `400`. `salesPointType` is sourced from the shared
 * `salesPointTypeEnums` and normalized to lower case; the delivery-uniqueness
 * and duplicate-name rules depend on the database and stay in the route as
 * named post-parse checks.
 */
import { z } from "zod";

import { salesPointTypeEnums } from "../enums.ts";
import {
  coercedBooleanSchema,
  objectIdSchema,
  sanitizedString,
} from "./primitives.ts";

const salesPointTypeEnumValues = salesPointTypeEnums as [string, ...string[]];

/**
 * A `salesPointType` from the shared enum, trimmed and lower-cased so the
 * existing case-insensitive contract is preserved.
 */
const salesPointTypeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z.enum(
      salesPointTypeEnumValues,
      `salesPointType must be one of: ${salesPointTypeEnums.join(", ")}`,
    ),
  );

/**
 * An optional `salesPointType`. An empty string is treated as "not provided",
 * matching the previous handler's `!== ""` guard.
 */
const optionalSalesPointTypeSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  salesPointTypeSchema.optional(),
);

/** Body for `POST /salesPoints`. */
export const createSalesPointBodySchema = z.strictObject({
  salesPointName: sanitizedString("SalesPointName is required!"),
  salesPointType: optionalSalesPointTypeSchema,
  selfOrdering: coercedBooleanSchema.optional(),
  businessId: objectIdSchema,
});

/** Path params for `GET`/`PATCH`/`DELETE /salesPoints/:salesPointId`. */
export const salesPointIdParamsSchema = z.strictObject({
  salesPointId: objectIdSchema,
});

/** Body for `PATCH /salesPoints/:salesPointId` — every field is optional. */
export const updateSalesPointBodySchema = z.strictObject({
  salesPointName: sanitizedString().optional(),
  salesPointType: optionalSalesPointTypeSchema,
  selfOrdering: coercedBooleanSchema.optional(),
});

/** Optional query for sales-point reads: include soft-deleted records explicitly. */
export const salesPointsIncludeDeletedQuerySchema = z.strictObject({
  includeDeleted: coercedBooleanSchema.optional(),
});

export type CreateSalesPointBody = z.infer<typeof createSalesPointBodySchema>;
export type UpdateSalesPointBody = z.infer<typeof updateSalesPointBodySchema>;
export type SalesPointIdParams = z.infer<typeof salesPointIdParamsSchema>;
export type SalesPointsIncludeDeletedQuery = z.infer<
  typeof salesPointsIncludeDeletedQuerySchema
>;
