import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  createNotificationBodySchema,
  notificationIdParamsSchema,
  notificationsByBusinessParamsSchema,
  notificationsByUserParamsSchema,
  notificationsIncludeDeletedQuerySchema,
  notificationsPaginationQuerySchema,
  updateNotificationBodySchema,
  NOTIFICATIONS_DEFAULT_LIMIT,
  NOTIFICATIONS_MAX_LIMIT,
} from "../../src/schemas/notifications.ts";
import { notificationEnums } from "restaurant-pos-packages/enums";

const VALID_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f191e810c19729de860ea";

describe("createNotificationBodySchema", () => {
  const valid = {
    notificationType: "Info",
    message: "Test notification message",
    businessId: VALID_ID,
    employeesRecipientsIds: [OTHER_ID],
  };

  it("accepts the minimum required fields", () => {
    expect(createNotificationBodySchema.safeParse(valid).success).toBe(true);
  });

  it.each(notificationEnums)("accepts the notificationType %s", (value) => {
    expect(
      createNotificationBodySchema.safeParse({
        ...valid,
        notificationType: value,
      }).success,
    ).toBe(true);
  });

  it("rejects a notificationType outside the shared enum", () => {
    expect(
      createNotificationBodySchema.safeParse({
        ...valid,
        notificationType: "General",
      }).success,
    ).toBe(false);
  });

  it("requires notificationType, message and businessId", () => {
    for (const key of ["notificationType", "message", "businessId"] as const) {
      const payload: Record<string, unknown> = { ...valid };
      delete payload[key];
      expect(
        createNotificationBodySchema.safeParse(payload).success,
        `missing ${key} should fail`,
      ).toBe(false);
    }
  });

  it("trims an ObjectId", () => {
    const parsed = createNotificationBodySchema.parse({
      ...valid,
      businessId: `  ${VALID_ID}  `,
    });
    expect(parsed.businessId).toBe(VALID_ID);
  });

  it("rejects a malformed businessId", () => {
    expect(
      createNotificationBodySchema.safeParse({
        ...valid,
        businessId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("accepts ObjectId recipient arrays", () => {
    const parsed = createNotificationBodySchema.parse({
      ...valid,
      customersRecipientsIds: [VALID_ID, OTHER_ID],
    });
    expect(parsed.customersRecipientsIds).toEqual([VALID_ID, OTHER_ID]);
  });

  it("rejects a malformed recipient id", () => {
    expect(
      createNotificationBodySchema.safeParse({
        ...valid,
        employeesRecipientsIds: ["nope"],
      }).success,
    ).toBe(false);
  });

  it("accepts an optional senderId and rejects a malformed one", () => {
    expect(
      createNotificationBodySchema.safeParse({ ...valid, senderId: OTHER_ID })
        .success,
    ).toBe(true);
    expect(
      createNotificationBodySchema.safeParse({ ...valid, senderId: "nope" })
        .success,
    ).toBe(false);
  });

  it("sanitizes the message as free text (HTML stripped, newlines kept)", () => {
    const parsed = createNotificationBodySchema.parse({
      ...valid,
      message: "  <b>Hello</b> world\n\n\nthanks  ",
    });
    expect(parsed.message).toBe("Hello world\n\nthanks");
  });

  it("rejects an empty message", () => {
    expect(
      createNotificationBodySchema.safeParse({ ...valid, message: "   " })
        .success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      createNotificationBodySchema.safeParse({ ...valid, isAdmin: true })
        .success,
    ).toBe(false);
  });
});

describe("updateNotificationBodySchema", () => {
  it("accepts an empty body", () => {
    expect(updateNotificationBodySchema.safeParse({}).success).toBe(true);
  });

  it("accepts a partial update", () => {
    expect(
      updateNotificationBodySchema.safeParse({
        message: "Updated",
        employeesRecipientsIds: [VALID_ID],
      }).success,
    ).toBe(true);
  });

  it("rejects the server-owned businessId", () => {
    expect(
      updateNotificationBodySchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      updateNotificationBodySchema.safeParse({ createdAt: new Date() }).success,
    ).toBe(false);
  });
});

describe("notification params schemas", () => {
  it.each([
    [notificationIdParamsSchema, "notificationId"],
    [notificationsByBusinessParamsSchema, "businessId"],
    [notificationsByUserParamsSchema, "userId"],
  ] as const)("accepts a valid ObjectId and rejects junk/unknown keys", (schema, key) => {
    expect(schema.safeParse({ [key]: VALID_ID }).success).toBe(true);
    expect(schema.safeParse({ [key]: "invalid-id" }).success).toBe(false);
    expect(schema.safeParse({ [key]: VALID_ID, extra: "x" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("notificationsPaginationQuerySchema", () => {
  it("defaults page and limit when absent", () => {
    expect(notificationsPaginationQuerySchema.parse({})).toEqual({
      page: 1,
      limit: NOTIFICATIONS_DEFAULT_LIMIT,
    });
  });

  it("coerces numeric strings", () => {
    expect(
      notificationsPaginationQuerySchema.parse({ page: "2", limit: "5" }),
    ).toMatchObject({ page: 2, limit: 5 });
  });

  it("clamps below-minimum page to 1", () => {
    expect(notificationsPaginationQuerySchema.parse({ page: "0" }).page).toBe(1);
    expect(notificationsPaginationQuerySchema.parse({ page: "-3" }).page).toBe(1);
  });

  it("clamps above-maximum limit to the maximum", () => {
    expect(
      notificationsPaginationQuerySchema.parse({
        limit: String(NOTIFICATIONS_MAX_LIMIT * 5),
      }).limit,
    ).toBe(NOTIFICATIONS_MAX_LIMIT);
  });

  it("treats a below-minimum limit as the default", () => {
    expect(notificationsPaginationQuerySchema.parse({ limit: "0" }).limit).toBe(
      NOTIFICATIONS_DEFAULT_LIMIT,
    );
  });

  it("rejects a non-numeric page or limit", () => {
    expect(
      notificationsPaginationQuerySchema.safeParse({ page: "abc" }).success,
    ).toBe(false);
    expect(
      notificationsPaginationQuerySchema.safeParse({ limit: "abc" }).success,
    ).toBe(false);
  });

  it("coerces includeRecipients string forms to a boolean", () => {
    expect(
      notificationsPaginationQuerySchema.parse({ includeRecipients: "true" })
        .includeRecipients,
    ).toBe(true);
    expect(
      notificationsPaginationQuerySchema.parse({ includeRecipients: "false" })
        .includeRecipients,
    ).toBe(false);
    expect(
      notificationsPaginationQuerySchema.safeParse({ includeRecipients: "maybe" })
        .success,
    ).toBe(false);
  });

  it("coerces includeDeleted string forms to a boolean", () => {
    expect(
      notificationsPaginationQuerySchema.parse({ includeDeleted: "true" })
        .includeDeleted,
    ).toBe(true);
    expect(
      notificationsPaginationQuerySchema.parse({ includeDeleted: "false" })
        .includeDeleted,
    ).toBe(false);
    expect(
      notificationsPaginationQuerySchema.safeParse({ includeDeleted: "maybe" })
        .success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      notificationsPaginationQuerySchema.safeParse({ sort: "asc" }).success,
    ).toBe(false);
  });
});

describe("notificationsIncludeDeletedQuerySchema", () => {
  it("accepts an omitted includeDeleted", () => {
    const parsed = notificationsIncludeDeletedQuerySchema.parse({});
    expect(parsed.includeDeleted).toBeUndefined();
  });

  it("coerces string booleans", () => {
    expect(
      notificationsIncludeDeletedQuerySchema.parse({ includeDeleted: "true" })
        .includeDeleted,
    ).toBe(true);
    expect(
      notificationsIncludeDeletedQuerySchema.parse({ includeDeleted: "false" })
        .includeDeleted,
    ).toBe(false);
  });

  it("rejects a non-boolean includeDeleted", () => {
    expect(
      notificationsIncludeDeletedQuerySchema.safeParse({
        includeDeleted: "maybe",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      notificationsIncludeDeletedQuerySchema.safeParse({
        includeDeleted: true,
        createdAt: "x",
      }).success,
    ).toBe(false);
  });
});

describe("server-owned fields are excluded from every notifications DTO", () => {
  const dtoSchemas: Record<string, z.ZodObject> = {
    createNotificationBodySchema,
    updateNotificationBodySchema,
    notificationIdParamsSchema,
    notificationsByBusinessParamsSchema,
    notificationsByUserParamsSchema,
    notificationsIncludeDeletedQuerySchema,
    notificationsPaginationQuerySchema,
  };

  it.each(Object.entries(dtoSchemas))(
    "%s has no server-owned key",
    (_name, schema) => {
      const keys = Object.keys(schema.shape);
      expect(keys).not.toContain("_id");
      expect(keys).not.toContain("createdAt");
      expect(keys).not.toContain("updatedAt");
    },
  );
});
