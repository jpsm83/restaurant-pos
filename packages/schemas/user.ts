/**
 * User DTOs — the request bodies and path params the users routes accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * email-verified flag, `imageUrl`, `notifications`, `selfOrders`,
 * `verificationToken`, `resetPasswordToken`, `resetPasswordExpires` and
 * `refreshSessionVersion` never appear in a DTO, so a client that sends them
 * gets a `400`. The update body is consumed through the shared multipart
 * helper, so the JSON-encoded `address` is parsed and validated against the
 * shared `addressSchema`; the uploaded image is collected by the helper as a
 * file, not a field. Enum values (`genderEnums`) come from `packages/enums.ts`.
 */
import { z } from "zod";

import { genderEnums } from "../enums.ts";
import { addressSchema } from "./address.ts";
import {
  languagePreferenceSchema,
  objectIdSchema,
  sanitizedString,
  type EnumValues,
} from "./primitives.ts";

const genderSchema = z.enum(genderEnums as EnumValues, "Invalid gender!");

/** A blank multipart field clears the stored value. */
const blankToNull = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? null : value;

/** An optional profile string; a blank field is sent as `null` to clear it. */
const optionalProfileString = z.preprocess(
  blankToNull,
  sanitizedString().nullable().optional(),
);

/** An optional date; a blank field is sent as `null` to clear it. */
const optionalBirthDate = z.preprocess(
  (value, ctx) => {
    if (typeof value !== "string") return blankToNull(value);
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid birth date",
      });
      return z.NEVER;
    }
    return date;
  },
  z.date().nullable().optional(),
);

/** An optional gender; a blank field is sent as `null` to clear it. */
const optionalGender = z.preprocess(
  blankToNull,
  genderSchema.nullable().optional(),
);

/** An optional address object; a blank field is sent as `null` to clear it. */
const optionalAddress = z.preprocess(
  blankToNull,
  z.preprocess((value, ctx) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value.trim());
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid JSON" });
      return z.NEVER;
    }
  }, addressSchema.nullable()).optional(),
);

/** An optional language preference; a blank field is sent as `null` to clear it. */
const optionalLanguagePreference = z.preprocess(
  blankToNull,
  languagePreferenceSchema.nullable().optional(),
);

/**
 * Body for `PATCH /users/:userId` (multipart, authenticated self only). Every
 * personal-detail field is optional so a profile save can send only what
 * changed. The sign-in email, password and employment identifiers are not
 * accepted here: sign-in email change is deferred to the later email-change
 * row (10.4), and employment data belongs to the Employee membership.
 */
export const updateUserBodySchema = z.strictObject({
  username: optionalProfileString,
  firstName: optionalProfileString,
  lastName: optionalProfileString,
  phoneNumber: optionalProfileString,
  nationality: optionalProfileString,
  gender: optionalGender,
  birthDate: optionalBirthDate,
  address: optionalAddress,
  languagePreference: optionalLanguagePreference,
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

export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type MarkNotificationDeletedBody = z.infer<
  typeof markNotificationDeletedBodySchema
>;
export type UserNotificationParams = z.infer<
  typeof userNotificationParamsSchema
>;
