/**
 * BusinessReports DTOs — the path params, query and body the weekly and monthly
 * business report routes accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the report documents
 * are server-derived, so the model fields — references, summaries, cost
 * breakdowns, the goods/waste/metrics buckets and the timestamps — never appear
 * in a DTO, and a client that sends them gets a `400`. The one exception is the
 * monthly PATCH body, whose `totalFixedOperatingCost` and `totalExtraCost` are
 * the sole client-settable fields (they map to nested `costBreakdown` paths).
 * The DTOs own per-field shape and format — ObjectId params, the `YYYY-MM-DD`
 * week query and the `YYYY-MM` month query. Cross-field and database-dependent
 * rules stay in the routes as named post-parse checks: the week/month ordering
 * rules and the monthly PATCH at-least-one-field rule.
 */
import { z } from "zod";

import { coercedNumberSchema, objectIdSchema } from "./primitives.ts";

/** An empty query value is treated as "not provided". */
const emptyToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/**
 * A plain calendar date (`YYYY-MM-DD`). An ambiguous date-time string is
 * rejected rather than guessed: the route resolves the week's local start from
 * an unambiguous date.
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

/** A calendar month (`YYYY-MM`), month 01–12. */
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

const isCalendarMonth = (value: string): boolean => {
  const match = MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
};

/** An optional `YYYY-MM-DD` query value; an empty string means "not provided". */
const calendarDateQuerySchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine(
      isCalendarDate,
      "Invalid date, expected a YYYY-MM-DD calendar date",
    )
    .optional(),
);

/** An optional `YYYY-MM` query value; an empty string means "not provided". */
const monthQuerySchema = z.preprocess(
  emptyToUndefined,
  z.string().refine(isCalendarMonth, "Invalid month, expected YYYY-MM").optional(),
);

/** An optional ObjectId query value; an empty string means "not provided". */
const objectIdQuerySchema = z.preprocess(
  emptyToUndefined,
  objectIdSchema.optional(),
);

/** Path params for `GET /weeklyBusinessReport/:weeklyReportId`. */
export const weeklyReportIdParamsSchema = z.strictObject({
  weeklyReportId: objectIdSchema,
});

/** Path params for `GET /weeklyBusinessReport/business/:businessId`. */
export const weeklyBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/**
 * Query for `GET /weeklyBusinessReport`. `businessId` narrows to one business;
 * `startWeek`/`endWeek` are plain `YYYY-MM-DD` calendar dates. The
 * `startWeek <= endWeek` ordering rule stays in the route as a post-parse check.
 */
export const weeklyBusinessReportListQuerySchema = z.strictObject({
  businessId: objectIdQuerySchema,
  startWeek: calendarDateQuerySchema,
  endWeek: calendarDateQuerySchema,
});

/** Query for `GET /weeklyBusinessReport/business/:businessId`. */
export const weeklyBusinessReportRangeQuerySchema = z.strictObject({
  startWeek: calendarDateQuerySchema,
  endWeek: calendarDateQuerySchema,
});

/** Path params for `GET`/`PATCH /monthlyBusinessReport/:monthlyReportId`. */
export const monthlyReportIdParamsSchema = z.strictObject({
  monthlyReportId: objectIdSchema,
});

/**
 * Path params for `GET /monthlyBusinessReport/business/:businessId` and its
 * `/calculateOnDemand` child.
 */
export const monthlyBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/**
 * Query for `GET /monthlyBusinessReport`. `businessId` narrows to one business;
 * `startMonth`/`endMonth` are `YYYY-MM` calendar months. The
 * `startMonth <= endMonth` ordering rule stays in the route as a post-parse
 * check.
 */
export const monthlyBusinessReportListQuerySchema = z.strictObject({
  businessId: objectIdQuerySchema,
  startMonth: monthQuerySchema,
  endMonth: monthQuerySchema,
});

/** Query for `GET /monthlyBusinessReport/business/:businessId`. */
export const monthlyBusinessReportRangeQuerySchema = z.strictObject({
  startMonth: monthQuerySchema,
  endMonth: monthQuerySchema,
});

/**
 * Query for
 * `GET /monthlyBusinessReport/business/:businessId/calculateOnDemand`. A missing
 * or empty `month` means "the current month", resolved in the route.
 */
export const calculateMonthlyReportQuerySchema = z.strictObject({
  month: monthQuerySchema,
});

/**
 * Body for `PATCH /monthlyBusinessReport/:monthlyReportId`. The two costs are
 * the only client-settable fields; the at-least-one rule stays in the route as a
 * post-parse check.
 */
export const updateMonthlyBusinessReportBodySchema = z.strictObject({
  totalFixedOperatingCost: coercedNumberSchema.optional(),
  totalExtraCost: coercedNumberSchema.optional(),
});

export type WeeklyReportIdParams = z.infer<typeof weeklyReportIdParamsSchema>;
export type WeeklyBusinessParams = z.infer<typeof weeklyBusinessParamsSchema>;
export type WeeklyBusinessReportListQuery = z.infer<
  typeof weeklyBusinessReportListQuerySchema
>;
export type WeeklyBusinessReportRangeQuery = z.infer<
  typeof weeklyBusinessReportRangeQuerySchema
>;
export type MonthlyReportIdParams = z.infer<typeof monthlyReportIdParamsSchema>;
export type MonthlyBusinessParams = z.infer<typeof monthlyBusinessParamsSchema>;
export type MonthlyBusinessReportListQuery = z.infer<
  typeof monthlyBusinessReportListQuerySchema
>;
export type MonthlyBusinessReportRangeQuery = z.infer<
  typeof monthlyBusinessReportRangeQuerySchema
>;
export type CalculateMonthlyReportQuery = z.infer<
  typeof calculateMonthlyReportQuerySchema
>;
export type UpdateMonthlyBusinessReportBody = z.infer<
  typeof updateMonthlyBusinessReportBodySchema
>;
