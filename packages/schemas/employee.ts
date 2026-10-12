/**
 * Employee DTOs — the request bodies and path params the employees routes
 * accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `_id`, `userId`, `documentsUrl`, `vacationDaysLeft`, `onDuty`,
 * `currentShiftRole` and the timestamps never appear in a DTO, so a client that
 * sends them gets a `400`. The create and update bodies are consumed through
 * the shared multipart helper, so the JSON-encoded `allEmployeeRoles` and
 * `salary` fields are parsed here. `allEmployeeRoles` is validated against the
 * `userRolesEnums` and the salary shape against `employeePayFrequencyEnums`,
 * both from `packages/enums.ts`. The `terminatedDate > joinDate` rule stays in
 * the route as a named post-parse check, because it spans two fields.
 */
import { z } from "zod";

import { employeePayFrequencyEnums, userRolesEnums } from "../enums.ts";
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

/**
 * A salary, JSON-encoded in the multipart body. All three fields are required,
 * so a partial object is rejected; unknown keys are rejected by `strictObject`.
 */
const salarySchema = z.strictObject({
  payFrequency: payFrequencySchema,
  grossSalary: z.number("Gross salary must be a number!"),
  netSalary: z.number("Net salary must be a number!"),
});

/** The fields a create and update request share. `salary` is JSON-parsed here. */
const employeeFields = {
  allEmployeeRoles: employeeRolesSchema,
  taxNumber: sanitizedString("Tax number is required!"),
  joinDate: z.coerce.date(),
  vacationDaysPerYear: coercedIntSchema.positive(
    "Vacation days per year must be greater than 0!",
  ),
  userEmail: emailSchema,
  contractHoursWeek: optionalNumberSchema,
  salary: optionalJsonField(salarySchema),
  comments: z.preprocess(emptyToUndefined, freeTextString().optional()),
};

/**
 * Body for `POST /employees` (multipart). Uploaded documents are collected by
 * the multipart helper as files, not fields.
 */
export const createEmployeeBodySchema = z.strictObject({
  ...employeeFields,
  businessId: objectIdSchema,
});

/**
 * Body for `PATCH /employees/:employeeId` (multipart). The employee is
 * identified by its path param, so `businessId` is not client-settable;
 * `active` and `terminatedDate` are settable only on update, and `active` is
 * required so the client always states whether the employee is active.
 */
export const patchEmployeeBodySchema = z.strictObject({
  ...employeeFields,
  active: coercedBooleanSchema,
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

export type CreateEmployeeBody = z.infer<typeof createEmployeeBodySchema>;
export type UpdateEmployeeRecordBody = z.infer<typeof patchEmployeeBodySchema>;
export type EmployeeIdParams = z.infer<typeof employeeIdParamsSchema>;
export type EmployeeByBusinessParams = z.infer<
  typeof employeeByBusinessParamsSchema
>;
