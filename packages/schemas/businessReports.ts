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

import {
  calendarDateSchema,
  calendarMonthSchema,
  emptyToUndefined,
  objectIdSchema,
} from "./primitives.ts";

/** An optional `YYYY-MM-DD` query value; an empty string means "not provided". */
const calendarDateQuerySchema = z.preprocess(
  emptyToUndefined,
  calendarDateSchema.optional(),
);

/** An optional `YYYY-MM` query value; an empty string means "not provided". */
const monthQuerySchema = z.preprocess(
  emptyToUndefined,
  calendarMonthSchema.optional(),
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
 * post-parse check. A JSON body means a real number is required — a `null` or
 * numeric string is rejected rather than coerced to `0`.
 */
export const updateMonthlyBusinessReportBodySchema = z.strictObject({
  totalFixedOperatingCost: z.number().optional(),
  totalExtraCost: z.number().optional(),
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
