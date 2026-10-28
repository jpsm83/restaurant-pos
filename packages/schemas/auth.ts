/**
 * Auth DTOs — the request bodies the auth routes accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * stored tokens (`verificationToken`, `resetPasswordToken`) and session values
 * (`refreshSessionVersion`, `emailVerified`) never appear in a DTO, so a client
 * that sends them gets a `400`. Routes that *do* take a client-supplied
 * one-time `token` (the emailed value) accept it only through their own DTO.
 */
import { z } from "zod";

import {
  PASSWORD_POLICY_MESSAGE,
  isValidPassword,
} from "../utils/passwordPolicy.ts";
import {
  emailSchema,
  languagePreferenceSchema,
  sanitizedString,
} from "./primitives.ts";

/** A new password that satisfies the shared password policy. */
export const passwordSchema = z
  .string({ error: "Password is required" })
  .refine(isValidPassword, PASSWORD_POLICY_MESSAGE);

/**
 * A password submitted for login. Login accepts any stored hash, so the
 * password policy does not apply; only presence is required.
 */
export const loginPasswordSchema = z
  .string({ error: "Password is required" })
  .min(1, "Password is required");

/** An optional profile name: sanitized; absent names stay unset. */
const optionalNameSchema = sanitizedString().optional();

/** An optional UI language chosen at sign-up; a blank field is ignored. */
const optionalLanguagePreferenceSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  languagePreferenceSchema.optional(),
);

export const signupBodySchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  username: optionalNameSchema,
  firstName: optionalNameSchema,
  lastName: optionalNameSchema,
  languagePreference: optionalLanguagePreferenceSchema,
});

export const loginBodySchema = z.strictObject({
  email: emailSchema,
  password: loginPasswordSchema,
});

export const requestEmailConfirmationBodySchema = z.strictObject({
  email: emailSchema,
});

export const requestPasswordResetBodySchema = z.strictObject({
  email: emailSchema,
});

/**
 * The new sign-in address for an email change. Uses the shared `emailSchema`,
 * the single server-side email rule every auth DTO already validates with.
 */
export const requestEmailChangeBodySchema = z.strictObject({
  newEmail: emailSchema,
  currentPassword: z
    .string({ error: "Current password is required" })
    .min(1, "Current password is required"),
});

export const confirmEmailBodySchema = z.strictObject({
  token: z
    .string({ error: "Please provide a confirmation token." })
    .trim()
    .min(1, "Please provide a confirmation token."),
});

/** Consumes the pending sign-in email change token emailed to the new address. */
export const confirmEmailChangeBodySchema = z.strictObject({
  token: z
    .string({ error: "Please provide a confirmation token." })
    .trim()
    .min(1, "Please provide a confirmation token."),
});

export const resetPasswordBodySchema = z.strictObject({
  token: z
    .string({ error: "Please provide a reset token." })
    .trim()
    .min(1, "Please provide a reset token."),
  newPassword: z
    .string({ error: "Please provide a new password." })
    .min(1, "Please provide a new password.")
    .refine(isValidPassword, PASSWORD_POLICY_MESSAGE),
});

export const setModeBodySchema = z.strictObject({
  mode: z.enum(["customer", "employee"], "Mode must be 'customer' or 'employee'"),
});

export type SignupBody = z.infer<typeof signupBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type RequestEmailConfirmationBody = z.infer<
  typeof requestEmailConfirmationBodySchema
>;
export type RequestPasswordResetBody = z.infer<
  typeof requestPasswordResetBodySchema
>;
export type RequestEmailChangeBody = z.infer<
  typeof requestEmailChangeBodySchema
>;
export type ConfirmEmailBody = z.infer<typeof confirmEmailBodySchema>;
export type ConfirmEmailChangeBody = z.infer<
  typeof confirmEmailChangeBodySchema
>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type SetModeBody = z.infer<typeof setModeBodySchema>;
