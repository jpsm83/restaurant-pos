import { describe, it, expect } from "vitest";
import type { z } from "zod";

import User from "../../src/models/user.ts";
import {
  createUserBodySchema,
  markNotificationDeletedBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
  userNotificationParamsSchema,
} from "restaurant-pos-packages/schemas/user";

/**
 * Parity between the user DTOs and the Mongoose User model (the domain source
 * of truth): every domain field a client may send must exist on the model, and
 * every server-owned field must exist on the model but never in a DTO.
 */

const allDtos: Record<string, z.ZodObject> = {
  createUserBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
  markNotificationDeletedBodySchema,
  userNotificationParamsSchema,
};

const userOwns = (field: string): boolean =>
  Boolean(User.schema.path(field)) ||
  Boolean(User.schema.path(`personalDetails.${field}`));

describe("user DTO ↔ model parity", () => {
  it("every personal-detail body field maps to a User model field", () => {
    for (const schema of [createUserBodySchema, updateUserBodySchema]) {
      for (const key of Object.keys(schema.shape)) {
        expect(userOwns(key), `${key} should map to a User model field`).toBe(
          true,
        );
      }
    }
  });

  it("password is client-settable on create and update", () => {
    expect(userOwns("password")).toBe(true);
    expect(Object.keys(createUserBodySchema.shape)).toContain("password");
    expect(Object.keys(updateUserBodySchema.shape)).toContain("password");
  });

  it("server-owned fields are on the model but in no DTO", () => {
    for (const field of [
      "imageUrl",
      "emailVerified",
      "verificationToken",
      "resetPasswordToken",
      "resetPasswordExpires",
      "refreshSessionVersion",
    ]) {
      expect(userOwns(field), `${field} should be on the model`).toBe(true);
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });

  it("the verified flag lives only on personalDetails", () => {
    expect(User.schema.path("emailVerified")).toBeUndefined();
    expect(User.schema.path("personalDetails.emailVerified")).toBeTruthy();
  });

  it("path param DTOs carry only their route ids", () => {
    expect(Object.keys(userIdParamsSchema.shape)).toEqual(["userId"]);
    expect(Object.keys(userNotificationParamsSchema.shape)).toEqual([
      "userId",
      "notificationId",
    ]);
    expect(Object.keys(markNotificationDeletedBodySchema.shape)).toEqual([
      "notificationId",
    ]);
  });
});
