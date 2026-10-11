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
 * relations, the `userIds` ObjectId array, the date-only query shape, and the
 * reference-number query coercion. Cross-field and database-dependent rules
 * stay in the route as named post-parse checks: the manager/business-match
 * guards and the `startDate <= endDate` /
 * `dailyReferenceNumberFrom <= dailyReferenceNumberTo` range rules. Resolving a
 * date-only filter to business-local UTC bounds also happens in the route, not
 * here.
 */
import { z } from "zod";

import { coercedIntSchema, objectIdSchema } from "./primitives.ts";

/** An empty query value is treated as "not provided". */
const emptyToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/**
 * A plain calendar date (`YYYY-MM-DD`). An ambiguous date-time string — with or
 * without an offset — is rejected rather than guessed: the business-local
 * resolution to UTC day bounds needs an unambiguous date, and happens in the
 * route against the business's own timezone.
 */
const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const isCalendarDate = (value: string): boolean => {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const utc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    utc.getUTCFullYear() === Number(year) &&
    utc.getUTCMonth() === Number(month) - 1 &&
    utc.getUTCDate() === Number(day)
  );
};

/** An optional `YYYY-MM-DD` query value; an empty string means "not provided". */
const calendarDateQuerySchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine(isCalendarDate, "Invalid date, expected a YYYY-MM-DD calendar date")
    .optional(),
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
 * Query for `GET /dailySalesReports/business/:businessId`. Dates are plain
 * `YYYY-MM-DD` calendar dates resolved to business-local UTC bounds in the
 * route; reference numbers are coerced to integers. The two range rules stay in
 * the route as post-parse checks.
 */
export const dailySalesReportsBusinessQuerySchema = z.strictObject({
  startDate: calendarDateQuerySchema,
  endDate: calendarDateQuerySchema,
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
