import type { z } from "zod";

import {
  addEmployeeBodySchema,
  createScheduleBodySchema,
  dailyScheduleQuerySchema,
  deleteEmployeeBodySchema,
  scheduleBusinessParamsSchema,
  scheduleIdParamsSchema,
  scheduleUserParamsSchema,
  updateEmployeeBodySchema,
  updateScheduleBodySchema,
} from "../../../packages/schemas/schedules.ts";

/**
 * Every schedules DTO, keyed by name, for the shared server-owned-field sweep in
 * the schema and parity tests. Keep this the single list so adding a DTO updates
 * both suites at once.
 */
export const scheduleDtoSchemas: Record<string, z.ZodObject> = {
  createScheduleBodySchema,
  scheduleIdParamsSchema,
  scheduleBusinessParamsSchema,
  scheduleUserParamsSchema,
  dailyScheduleQuerySchema,
  updateScheduleBodySchema,
  addEmployeeBodySchema,
  updateEmployeeBodySchema,
  deleteEmployeeBodySchema,
};
