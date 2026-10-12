/**
 * User DTOs — the request bodies and path params the users routes accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `imageUrl`, `notifications`, `employeeDetails`, `selfOrders`, `emailVerified`,
 * `verificationToken`, `resetPasswordToken`, `resetPasswordExpires` and
 * `refreshSessionVersion` never appear in a DTO, so a client that sends them
 * gets a `400`. The create and update bodies are consumed through the shared
 * multipart helper, so the JSON-encoded `address` is parsed and validated
 * against the shared `addressSchema`; the uploaded image is collected by the
 * helper as a file, not a field. Enum values (`idEnums`, `genderEnums`) come
 * from `packages/enums.ts`.
 */
import { z } from "zod";

import { genderEnums, idEnums } from "../enums.ts";
import { passwordSchema } from "./auth.ts";
import { addressSchema } from "./address.ts";
import {
  emailSchema,
  emptyToUndefined,
  type EnumValues,
  jsonField,
  objectIdSchema,
  sanitizedString,
} from "./primitives.ts";

const idTypeSchema = z.enum(idEnums as EnumValues, "Invalid id type!");
const genderSchema = z.enum(genderEnums as EnumValues, "Invalid gender!");

/** An optional password; a blank string is treated as "not provided". */
const optionalPasswordSchema = z.preprocess(
  emptyToUndefined,
  passwordSchema.optional(),
);

/**
 * The personal-detail fields a create and update request share. `address` is
 * JSON-encoded over multipart. `birthDate` is coerced to a `Date`.
 */
const personalDetailFields = {
  username: sanitizedString("Username is required!"),
  email: emailSchema,
  idType: idTypeSchema,
  idNumber: sanitizedString("Id number is required!"),
  address: jsonField(addressSchema),
  firstName: sanitizedString("First name is required!"),
  lastName: sanitizedString("Last name is required!"),
  nationality: sanitizedString("Nationality is required!"),
  gender: genderSchema,
  birthDate: z.coerce.date("Birth date is required!"),
  phoneNumber: sanitizedString("Phone number is required!"),
};

/**
 * Body for `POST /users` (multipart). The password must satisfy the shared
 * policy; the uploaded image is collected by the multipart helper as a file.
 */
export const createUserBodySchema = z.strictObject({
  ...personalDetailFields,
  password: passwordSchema,
});

/**
 * Body for `PATCH /users/:userId` (multipart, authenticated self only). The
 * identity fields are required (the profile form always submits them);
 * `password` is optional so a profile update that does not change it leaves the
 * stored hash untouched.
 */
export const updateUserBodySchema = z.strictObject({
  ...personalDetailFields,
  password: optionalPasswordSchema,
});

/** Path params for `GET`/`PATCH`/`DELETE /users/:userId`. */
export const userIdParamsSchema = z.strictObject({
  userId: objectIdSchema,
});

/** Body for `PATCH /users/:userId/markNotificationAsDeleted`. */
export const markNotificationDeletedBodySchema = z.strictObject({
  notificationId: objectIdSchema,
});

/** Path params for `PATCH /users/:userId/updateReadFlag/:notificationId`. */
export const userNotificationParamsSchema = z.strictObject({
  userId: objectIdSchema,
  notificationId: objectIdSchema,
});

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type MarkNotificationDeletedBody = z.infer<
  typeof markNotificationDeletedBodySchema
>;
export type UserNotificationParams = z.infer<
  typeof userNotificationParamsSchema
>;
