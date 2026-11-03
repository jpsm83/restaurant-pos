import { describe, it, expect } from "vitest";
import type { z } from "zod";

import Notification from "../../src/models/notification.ts";
import {
  notificationIdParamsSchema,
  notificationTypeSchema,
  notificationInboxQuerySchema,
} from "../../src/schemas/notifications.ts";
import { notificationEnums } from "restaurant-pos-packages/enums";

/**
 * Parity between the notifications DTOs and the Notification model (the domain
 * source of truth): the enum cannot drift, and the request shapes never accept
 * model-owned or copy-bearing fields.
 */

const allDtos: Record<string, z.ZodObject> = {
  notificationIdParamsSchema,
  notificationInboxQuerySchema,
};

const modelOwns = (field: string): boolean =>
  Boolean(Notification.schema.path(field));

describe("notifications DTO ↔ model parity", () => {
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

  it("the model stores machine-readable content and a legacy message fallback", () => {
    expect(modelOwns("content.kind")).toBe(true);
    expect(modelOwns("content.key")).toBe(true);
    expect(modelOwns("content.params")).toBe(true);
    expect(modelOwns("content.text")).toBe(true);
    expect(modelOwns("message")).toBe(true);
  });

  it("timestamps and copy are owned by the model but accepted by no DTO", () => {
    for (const field of [
      "createdAt",
      "updatedAt",
      "message",
      "content",
    ] as const) {
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });
});
