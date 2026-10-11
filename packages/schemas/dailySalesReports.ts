/**
 * DailySalesReports DTOs — the request bodies, path params and query the
 * `dailySalesReports` routes accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the report document
 * fields — `dailyReferenceNumber` as a value to set, `isDailyReportOpen`, the
 * actor report buckets (`employeesDailySalesReport`,
 * `deliveryDailySalesReport`, `selfOrderingSalesReport`), the business totals
 * and the timestamps — never appear as writable DTO fields, so a client that
 * sends them gets a `400`. The query DTO exposes `dailyReferenceNumber*` only as
 * read-only filters. The DTOs own per-field shape and types — ObjectId
 * relations, the `userIds` ObjectId array, and the date/reference-number query
 * coercion. Cross-field and database-dependent rules stay in the route as named
 * post-parse checks: the manager/business-match guards and the `startDate <=
 * endDate` / `dailyReferenceNumberFrom <= dailyReferenceNumberTo` range rules.
 */
import { z } from "zod";

import { coercedIntSchema, objectIdSchema } from "./primitives.ts";

/** An empty query value is treated as "not provided". */
const emptyToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/** The UTC instant at the start of the calendar day the client sent. */
const startOfUtcDay = (date: Date): Date =>
  new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);

/** The UTC instant at the end of the calendar day the client sent. */
const endOfUtcDay = (date: Date): Date =>
  new Date(`${date.toISOString().slice(0, 10)}T23:59:59.999Z`);

/** An optional `startDate`, coerced to the start of that UTC calendar day. */
const startDateQuerySchema = z.preprocess(
  emptyToUndefined,
  z.coerce.date().transform(startOfUtcDay).optional(),
);

/** An optional `endDate`, coerced to the end of that UTC calendar day. */
const endDateQuerySchema = z.preprocess(
  emptyToUndefined,
  z.coerce.date().transform(endOfUtcDay).optional(),
);

/** An optional integer reference number; an empty string means "not provided". */
const referenceNumberQuerySchema = z.preprocess(
  emptyToUndefined,
  coercedIntSchema.optional(),
);

/** Path params for `GET`/`DELETE` and the report-mutating `PATCH` routes. */
export const dailySalesReportIdParamsSchema = z.strictObject({
  dailySalesReportId: objectIdSchema,
});

/** Path params for `GET /dailySalesReports/business/:businessId`. */
export const dailySalesReportsBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/**
 * Body for `PATCH /dailySalesReports/:dailySalesReportId/calculateUsersReport`.
 * `userIds` must be a non-empty array of ObjectIds.
 */
export const calculateUsersReportBodySchema = z.strictObject({
  userIds: z.array(objectIdSchema).min(1, "User IDs must be a non-empty array!"),
});

/**
 * Query for `GET /dailySalesReports/business/:businessId`. Dates are coerced to
 * the boundaries of the UTC calendar day and reference numbers to integers; the
 * two range rules stay in the route as post-parse checks.
 */
export const dailySalesReportsBusinessQuerySchema = z.strictObject({
  startDate: startDateQuerySchema,
  endDate: endDateQuerySchema,
  dailyReferenceNumber: referenceNumberQuerySchema,
  dailyReferenceNumberFrom: referenceNumberQuerySchema,
  dailyReferenceNumberTo: referenceNumberQuerySchema,
});

export type DailySalesReportIdParams = z.infer<
  typeof dailySalesReportIdParamsSchema
>;
export type DailySalesReportsBusinessParams = z.infer<
  typeof dailySalesReportsBusinessParamsSchema
>;
export type CalculateUsersReportBody = z.infer<
  typeof calculateUsersReportBodySchema
>;
export type DailySalesReportsBusinessQuery = z.infer<
  typeof dailySalesReportsBusinessQuerySchema
>;
