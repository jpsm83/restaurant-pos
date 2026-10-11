/**
 * Schedules DTOs — the request bodies, path params and query the schedules
 * routes accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `weekNumber`, the `employeesSchedules` array and its computed `shiftHours` /
 * `employeeCost`, the running totals and the timestamps never appear in a DTO,
 * so a client that sends them gets a `400`. The DTOs own per-field shape and
 * types — the `date` / time-range coercion, the `vacation` boolean and the
 * `dayKey` `YYYY-MM-DD` format. Cross-field and database-dependent rules stay in
 * the route as named post-parse checks: `employeesValidation` and the
 * `isScheduleOverlapping` overlap rule.
 */
import { z } from "zod";

import {
  coercedBooleanSchema,
  freeTextString,
  objectIdSchema,
  sanitizedString,
} from "./primitives.ts";

/** `dayKey` is a server-local calendar day in `YYYY-MM-DD` form. */
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * An optional `dayKey`; an empty string is treated as "not provided" so the
 * route falls back to the current server-local day.
 */
const dayKeySchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z
    .string()
    .trim()
    .regex(DAY_KEY_PATTERN, "dayKey must be in YYYY-MM-DD format")
    .optional(),
);

/** The shift time range a client may submit. */
const timeRangeSchema = z.strictObject({
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});

/**
 * A single employee schedule as submitted by a client. `_id`, `shiftHours` and
 * `employeeCost` are server-owned and not accepted. The `startTime <= endTime`
 * rule is enforced by the route's `employeesValidation` post-parse check.
 */
export const employeeScheduleSchema = z.strictObject({
  employeeId: objectIdSchema,
  role: sanitizedString("Role is required!"),
  timeRange: timeRangeSchema,
  vacation: coercedBooleanSchema.optional(),
});

/** Body for `POST /schedules`. `weekNumber` is derived from `date` server-side. */
export const createScheduleBodySchema = z.strictObject({
  date: z.coerce.date(),
  businessId: objectIdSchema,
  comments: freeTextString().optional(),
});

/** Path params for `GET`/`PATCH`/`DELETE /schedules/:scheduleId`. */
export const scheduleIdParamsSchema = z.strictObject({
  scheduleId: objectIdSchema,
});

/** Path params for `GET /schedules/business/:businessId[/daily]`. */
export const scheduleBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/** Path params for `GET /schedules/user/:userId`. */
export const scheduleUserParamsSchema = z.strictObject({
  userId: objectIdSchema,
});

/** Query for `GET /schedules/business/:businessId/daily`. */
export const dailyScheduleQuerySchema = z.strictObject({
  dayKey: dayKeySchema,
});

/** Body for `PATCH /schedules/:scheduleId` — only `comments` is client-settable. */
export const updateScheduleBodySchema = z.strictObject({
  comments: freeTextString().optional(),
});

/** Body for `PATCH /schedules/:scheduleId/addEmployee`. */
export const addEmployeeBodySchema = z.strictObject({
  employeeSchedule: employeeScheduleSchema,
});

/** Body for `PATCH /schedules/:scheduleId/updateEmployee`. */
export const updateEmployeeBodySchema = z.strictObject({
  employeeSchedule: employeeScheduleSchema,
  employeeScheduleId: objectIdSchema,
});

/** Body for `PATCH /schedules/:scheduleId/deleteEmployee`. */
export const deleteEmployeeBodySchema = z.strictObject({
  employeeId: objectIdSchema,
  employeeScheduleId: objectIdSchema,
});

export type EmployeeSchedule = z.infer<typeof employeeScheduleSchema>;
export type CreateScheduleBody = z.infer<typeof createScheduleBodySchema>;
export type ScheduleIdParams = z.infer<typeof scheduleIdParamsSchema>;
export type ScheduleBusinessParams = z.infer<typeof scheduleBusinessParamsSchema>;
export type ScheduleUserParams = z.infer<typeof scheduleUserParamsSchema>;
export type DailyScheduleQuery = z.infer<typeof dailyScheduleQuerySchema>;
export type UpdateScheduleBody = z.infer<typeof updateScheduleBodySchema>;
export type AddEmployeeBody = z.infer<typeof addEmployeeBodySchema>;
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeBodySchema>;
export type DeleteEmployeeBody = z.infer<typeof deleteEmployeeBodySchema>;
