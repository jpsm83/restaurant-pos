import type { z } from "zod";

import {
  addEmployeeBodySchema,
  createScheduleBodySchema,
  dailyScheduleQuerySchema,
  deleteEmployeeBodySchema,
  scheduleBusinessParamsSchema,
  scheduleIdParamsSchema,
  schedulesIncludeDeletedQuerySchema,
  scheduleUserParamsSchema,
  updateEmployeeBodySchema,
  updateScheduleBodySchema,
} from "restaurant-pos-packages/schemas/schedules";

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
  schedulesIncludeDeletedQuerySchema,
  updateScheduleBodySchema,
  addEmployeeBodySchema,
  updateEmployeeBodySchema,
  deleteEmployeeBodySchema,
};

/** Server-owned top-level Schedule fields a client must never set. */
export const scheduleServerOwnedFields = [
  "weekNumber",
  "employeesSchedules",
  "totalEmployeesScheduled",
  "totalEmployeesVacation",
  "totalDayEmployeesCost",
  "createdAt",
  "updatedAt",
] as const;

/** Server-owned fields inside each `employeesSchedules` entry. */
export const employeeScheduleServerOwnedFields = [
  "shiftHours",
  "employeeCost",
] as const;
