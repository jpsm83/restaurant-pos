import { describe, it, expect } from "vitest";
import type { z } from "zod";

import Notification from "../../src/models/notification.ts";
import {
  createNotificationBodySchema,
  notificationIdParamsSchema,
  notificationTypeSchema,
  notificationsByBusinessParamsSchema,
  notificationsByUserParamsSchema,
  notificationsPaginationQuerySchema,
  updateNotificationBodySchema,
} from "../../src/schemas/notifications.ts";
import { notificationEnums } from "../../../packages/enums.ts";

/**
 * Parity between the notifications DTOs and the Notification model (the domain
 * source of truth): every domain field a client may send must exist on the
 * model, and the server-owned fields (timestamps, `_id`) must never appear in a
 * DTO.
 */

const allDtos: Record<string, z.ZodObject> = {
  createNotificationBodySchema,
  updateNotificationBodySchema,
  notificationIdParamsSchema,
  notificationsByBusinessParamsSchema,
  notificationsByUserParamsSchema,
  notificationsPaginationQuerySchema,
};

const modelOwns = (field: string): boolean =>
  Boolean(Notification.schema.path(field));

describe("notifications DTO ↔ model parity", () => {
  it("every create/update field maps to a Notification model field", () => {
    const domainKeys = new Set([
      ...Object.keys(createNotificationBodySchema.shape),
      ...Object.keys(updateNotificationBodySchema.shape),
    ]);

    for (const key of domainKeys) {
      expect(
        modelOwns(key),
        `${key} should map to a Notification model field`,
      ).toBe(true);
    }
  });

  it("the DTO notificationType enum matches the shared and model enums", () => {
    const typePath = Notification.schema.path("notificationType") as unknown as {
      enumValues?: string[];
    };

    expect([...(typePath.enumValues ?? [])].sort()).toEqual(
      [...notificationEnums].sort(),
    );

    for (const value of notificationEnums) {
      expect(
        notificationTypeSchema.safeParse(value).success,
        `${value} should be accepted`,
      ).toBe(true);
    }
    expect(notificationTypeSchema.safeParse("General").success).toBe(false);
  });

  it("timestamps are owned by the model but accepted by no DTO", () => {
    for (const field of ["createdAt", "updatedAt"] as const) {
      expect(modelOwns(field), `model should own ${field}`).toBe(true);
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });
});
