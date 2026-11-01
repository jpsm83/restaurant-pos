/**
 * Employee DTOs — the request bodies and path params the employees routes
 * accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `_id`, `userId`, `documentsUrl`, `vacationDaysLeft`, `onDuty`,
 * `currentShiftRole`, the derived `active` mirror and the timestamps never
 * appear in a DTO, so a client that sends them gets a `400`. The create and
 * update bodies are consumed through the shared multipart helper, so the
 * JSON-encoded `allEmployeeRoles` and `salary` fields are parsed here.
 * `allEmployeeRoles` is validated against the `userRolesEnums`, the salary
 * shape against `employeePayFrequencyEnums`, and the status against the closed
 * `employmentStatusEnums`, all from `packages/enums.ts`.
 *
 * The minimal hire requires only roles, status, join date, the Business and the
 * linked User's email; contract, pay, tax, vacation and comments stay optional.
 * Update identifies the membership by path, so it cannot change the Business or
 * rebind the linked User: `businessId` and `userEmail` are create-only. The
 * `terminatedDate` / status cross-field rules stay in the route as named
 * post-parse checks, because they span two fields.
 */
import { z } from "zod";

import {
  employeePayFrequencyEnums,
  employmentStatusEnums,
  userRolesEnums,
} from "../enums.ts";
import {
  coercedBooleanSchema,
  coercedIntSchema,
  coercedNumberSchema,
  emailSchema,
  emptyToUndefined,
  type EnumValues,
  freeTextString,
  jsonField,
  objectIdSchema,
  sanitizedString,
} from "./primitives.ts";

/** An optional JSON-encoded field; a blank string is treated as "not provided". */
const optionalJsonField = <T extends z.ZodType>(schema: T) =>
  z.preprocess(emptyToUndefined, jsonField(schema).optional());

/** A number from a form string; a blank string is "not provided". */
const optionalNumberSchema = z.preprocess(
  emptyToUndefined,
  coercedNumberSchema.optional(),
);

/** An optional date; a blank string is treated as "not provided". */
const optionalDateSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.date().optional(),
);

const employeeRoleSchema = z.enum(
  userRolesEnums as EnumValues,
  "Invalid employee role!",
);

/** A non-empty list of employee roles, JSON-encoded in the multipart body. */
const employeeRolesSchema = jsonField(
  z.array(employeeRoleSchema).min(1, "At least one employee role is required!"),
);

const payFrequencySchema = z.enum(
  employeePayFrequencyEnums as EnumValues,
  "Invalid pay frequency!",
);

const employmentStatusSchema = z.enum(
  employmentStatusEnums as EnumValues,
  "Invalid employment status!",
);

/**
 * A salary, JSON-encoded in the multipart body. All three fields are required,
 * so a partial object is rejected; unknown keys are rejected by `strictObject`.
 */
const salarySchema = z.strictObject({
  payFrequency: payFrequencySchema,
  grossSalary: z.number("Gross salary must be a number!"),
  netSalary: z.number("Net salary must be a number!"),
});

/** An optional tax number; a blank string is treated as "not provided". */
const optionalTaxNumberSchema = z.preprocess(
  emptyToUndefined,
  sanitizedString().optional(),
);

/** An optional vacation allowance; a blank string is "not provided". */
const optionalVacationDaysSchema = z.preprocess(
  emptyToUndefined,
  coercedIntSchema.positive(
    "Vacation days per year must be greater than 0!",
  ).optional(),
);

/**
 * The core fields a create and update request share. Roles, status and join
 * date are required by the minimal hire; the legacy HR fields below stay
 * optional in this row.
 */
const employeeFields = {
  allEmployeeRoles: employeeRolesSchema,
  employmentStatus: employmentStatusSchema,
  joinDate: z.coerce.date(),
  contractHoursWeek: optionalNumberSchema,
  salary: optionalJsonField(salarySchema),
  comments: z.preprocess(emptyToUndefined, freeTextString().optional()),
};

/** Legacy HR fields accepted when present but not required by the hire flow. */
const legacyHrFields = {
  taxNumber: optionalTaxNumberSchema,
  vacationDaysPerYear: optionalVacationDaysSchema,
};

/**
 * Body for `POST /employees` (multipart). The linked User is identified by
 * sign-in email; uploaded documents are collected by the multipart helper as
 * files, not fields.
 */
export const createEmployeeBodySchema = z.strictObject({
  ...employeeFields,
  ...legacyHrFields,
  businessId: objectIdSchema,
  userEmail: emailSchema,
});

/**
 * Body for `PATCH /employees/:employeeId` (multipart). The employee is
 * identified by its path param, so `businessId` is not client-settable and
 * `userEmail` is absent: an update cannot rebind the membership. `active` is
 * derived from `employmentStatus`; `terminatedDate` is settable only on update.
 */
export const patchEmployeeBodySchema = z.strictObject({
  ...employeeFields,
  ...legacyHrFields,
  terminatedDate: optionalDateSchema,
});

/** Path params for `GET`/`PATCH`/`DELETE /employees/:employeeId`. */
export const employeeIdParamsSchema = z.strictObject({
  employeeId: objectIdSchema,
});

/** Path params for the `/employees/business/:businessId...` reads. */
export const employeeByBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/** Optional query for employee reads: include soft-deleted records explicitly. */
export const employeesIncludeDeletedQuerySchema = z.strictObject({
  includeDeleted: z.preprocess(emptyToUndefined, coercedBooleanSchema.optional()),
});

export type CreateEmployeeBody = z.infer<typeof createEmployeeBodySchema>;
export type UpdateEmployeeRecordBody = z.infer<typeof patchEmployeeBodySchema>;
export type EmployeeIdParams = z.infer<typeof employeeIdParamsSchema>;
export type EmployeeByBusinessParams = z.infer<
  typeof employeeByBusinessParamsSchema
>;
export type EmployeesIncludeDeletedQuery = z.infer<
  typeof employeesIncludeDeletedQuerySchema
>;
