import { describe, it, expect } from "vitest";
import type { z } from "zod";

import User from "../../src/models/user.ts";
import Business from "../../src/models/business.ts";
import {
  confirmEmailBodySchema,
  loginBodySchema,
  requestEmailConfirmationBodySchema,
  requestPasswordResetBodySchema,
  resetPasswordBodySchema,
  setModeBodySchema,
  signupBodySchema,
} from "../../../packages/schemas/auth.ts";

/**
 * Parity between the auth DTOs and the Mongoose models (the domain source of
 * truth): every domain field a client may send must exist on a model, and every
 * server-owned field must exist on a model but never in a DTO.
 */

const SERVER_OWNED_FIELDS = [
  "emailVerified",
  "verificationToken",
  "resetPasswordToken",
  "resetPasswordExpires",
  "refreshSessionVersion",
] as const;

const allDtos: Record<string, z.ZodObject> = {
  signupBodySchema,
  loginBodySchema,
  requestEmailConfirmationBodySchema,
  requestPasswordResetBodySchema,
  confirmEmailBodySchema,
  resetPasswordBodySchema,
  setModeBodySchema,
};

const modelOwns = (field: string): boolean =>
  Boolean(User.schema.path(field)) ||
  Boolean(User.schema.path(`personalDetails.${field}`)) ||
  Boolean(Business.schema.path(field));

describe("auth DTO ↔ model parity", () => {
  it("every signup field maps to a model field", () => {
    for (const key of Object.keys(signupBodySchema.shape)) {
      expect(modelOwns(key), `signup.${key} should map to a model field`).toBe(
        true,
      );
    }
  });

  it("login only uses model-backed credential fields", () => {
    expect(Object.keys(loginBodySchema.shape).sort()).toEqual([
      "email",
      "password",
    ]);
    expect(modelOwns("email")).toBe(true);
    expect(modelOwns("password")).toBe(true);
  });

  it.each(SERVER_OWNED_FIELDS)(
    "%s is owned by a model but accepted by no DTO",
    (field) => {
      expect(modelOwns(field), `models should own ${field}`).toBe(true);
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(Object.keys(schema.shape), `${name} should not accept ${field}`)
          .not.toContain(field);
      }
    },
  );

  it("email DTOs are backed by the model email fields", () => {
    expect(User.schema.path("personalDetails.email")).toBeTruthy();
    expect(Business.schema.path("email")).toBeTruthy();
  });
});
