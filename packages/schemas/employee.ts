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
 * `userRolesEnums` from `packages/enums.ts`. The salary shape and the
 * `terminatedDate > joinDate` rule stay in the route as named post-parse checks.
 */
import { z } from "zod";

import { userRolesEnums } from "../enums.ts";
import {
  coercedBooleanSchema,
  coercedIntSchema,
  coercedNumberSchema,
  emailSchema,
  emptyToUndefined,
  freeTextString,
  jsonField,
  objectIdSchema,
  sanitizedString,
} from "./primitives.ts";

/** The literal tuple `z.enum` needs to carry the value union into `z.infer`. */
type EnumValues = [string, ...string[]];

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

/**
 * The fields a create and update request share. `salary` is JSON-parsed here
 * and its shape is checked by the route's `validateSalary` post-parse check.
 */
const employeeFields = {
  allEmployeeRoles: employeeRolesSchema,
  taxNumber: sanitizedString("Tax number is required!"),
  joinDate: z.coerce.date(),
  vacationDaysPerYear: coercedIntSchema.positive(
    "Vacation days per year must be greater than 0!",
  ),
  userEmail: emailSchema,
  contractHoursWeek: optionalNumberSchema,
  salary: optionalJsonField(z.record(z.string(), z.unknown())),
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
