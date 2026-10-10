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
import { emailSchema, sanitizedString } from "./primitives.ts";

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

/** An optional profile name: sanitized, and defaulted by the route if absent. */
const optionalNameSchema = sanitizedString().optional();

export const signupBodySchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  username: optionalNameSchema,
  firstName: optionalNameSchema,
  lastName: optionalNameSchema,
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

export const confirmEmailBodySchema = z.strictObject({
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
export type ConfirmEmailBody = z.infer<typeof confirmEmailBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type SetModeBody = z.infer<typeof setModeBodySchema>;
