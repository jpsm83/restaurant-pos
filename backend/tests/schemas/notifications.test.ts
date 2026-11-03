import { describe, it, expect } from "vitest";

import {
  notificationIdParamsSchema,
  notificationTypeSchema,
  notificationInboxQuerySchema,
  NOTIFICATIONS_DEFAULT_LIMIT,
  NOTIFICATIONS_MAX_LIMIT,
} from "../../src/schemas/notifications.ts";
import { notificationEnums } from "restaurant-pos-packages/enums";

const VALID_ID = "507f1f77bcf86cd799439011";

describe("notificationTypeSchema", () => {
  it.each(notificationEnums)("accepts the shared notificationType %s", (value) => {
    expect(notificationTypeSchema.safeParse(value).success).toBe(true);
  });

  it("rejects a notificationType outside the shared enum", () => {
    expect(notificationTypeSchema.safeParse("General").success).toBe(false);
  });
});

describe("notificationInboxQuerySchema", () => {
  it("defaults page and limit when absent", () => {
    expect(notificationInboxQuerySchema.parse({})).toEqual({
      page: 1,
      limit: NOTIFICATIONS_DEFAULT_LIMIT,
    });
  });

  it("coerces numeric strings", () => {
    expect(
      notificationInboxQuerySchema.parse({ page: "2", limit: "5" }),
    ).toEqual({ page: 2, limit: 5 });
  });

  it("clamps below-minimum page to 1", () => {
    expect(notificationInboxQuerySchema.parse({ page: "0" }).page).toBe(1);
    expect(notificationInboxQuerySchema.parse({ page: "-3" }).page).toBe(1);
  });

  it("clamps above-maximum limit to the maximum", () => {
    expect(
      notificationInboxQuerySchema.parse({
        limit: String(NOTIFICATIONS_MAX_LIMIT * 5),
      }).limit,
    ).toBe(NOTIFICATIONS_MAX_LIMIT);
  });

  it("treats a below-minimum limit as the default", () => {
    expect(notificationInboxQuerySchema.parse({ limit: "0" }).limit).toBe(
      NOTIFICATIONS_DEFAULT_LIMIT,
    );
  });

  it("rejects a non-numeric page or limit", () => {
    expect(
      notificationInboxQuerySchema.safeParse({ page: "abc" }).success,
    ).toBe(false);
    expect(
      notificationInboxQuerySchema.safeParse({ limit: "abc" }).success,
    ).toBe(false);
  });

  it("rejects list-only query keys", () => {
    expect(
      notificationInboxQuerySchema.safeParse({ includeRecipients: "true" })
        .success,
    ).toBe(false);
    expect(
      notificationInboxQuerySchema.safeParse({ includeDeleted: "true" })
        .success,
    ).toBe(false);
  });
});

describe("notificationIdParamsSchema", () => {
  it("accepts a valid ObjectId and rejects junk/unknown keys", () => {
    expect(notificationIdParamsSchema.safeParse({ notificationId: VALID_ID }).success).toBe(
      true,
    );
    expect(
      notificationIdParamsSchema.safeParse({ notificationId: "invalid-id" })
        .success,
    ).toBe(false);
    expect(
      notificationIdParamsSchema.safeParse({
        notificationId: VALID_ID,
        extra: "x",
      }).success,
    ).toBe(false);
    expect(notificationIdParamsSchema.safeParse({}).success).toBe(false);
  });
});

describe("server-owned fields and copy are excluded from notifications DTOs", () => {
  const dtoSchemas = {
    notificationIdParamsSchema,
    notificationInboxQuerySchema,
  };

  it.each(Object.entries(dtoSchemas))(
    "%s has no server-owned or copy-bearing key",
    (_name, schema) => {
      const keys = Object.keys(schema.shape);
      for (const key of [
        "_id",
        "createdAt",
        "updatedAt",
        "message",
        "content",
      ]) {
        expect(keys).not.toContain(key);
      }
    },
  );
});
