import { describe, it, expect } from "vitest";
import type { z } from "zod";

import Order from "../../src/models/order.ts";
import { allergensEnums } from "../../../packages/enums.ts";
import {
  createOrderBodySchema,
  orderItemSchema,
  orderIdParamsSchema,
  ordersBySalesInstanceParamsSchema,
  ordersByUserParamsSchema,
} from "../../../packages/schemas/orders.ts";

/**
 * Parity between the orders DTOs and the Order model (the domain source of
 * truth): every field a client may send must exist on the model, and every
 * server-owned field must exist on the model but never in a DTO.
 */

const orderOwns = (field: string): boolean => Boolean(Order.schema.path(field));

const VALID_ID = "507f1f77bcf86cd799439011";

const allDtos: Record<string, z.ZodObject> = {
  createOrderBodySchema,
  orderIdParamsSchema,
  ordersBySalesInstanceParamsSchema,
  ordersByUserParamsSchema,
};

describe("orders DTO ↔ model parity", () => {
  it("every order-item field maps to an Order model field", () => {
    for (const key of Object.keys(orderItemSchema.shape)) {
      expect(
        orderOwns(key),
        `orderItem.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("every top-level create-order field except ordersArr maps to a model field", () => {
    for (const key of Object.keys(createOrderBodySchema.shape)) {
      if (key === "ordersArr") continue;
      expect(
        orderOwns(key),
        `createOrder.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("server-owned fields are owned by Order but accepted by no DTO", () => {
    const serverOwned = [
      "createdByUserId",
      "createdAsRole",
      "billingStatus",
      "orderStatus",
      "discountPercentage",
    ];

    for (const field of serverOwned) {
      expect(orderOwns(field), `${field} should be owned by Order`).toBe(true);
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
      expect(
        Object.keys(orderItemSchema.shape),
        `orderItem should not accept ${field}`,
      ).not.toContain(field);
    }
  });

  it("the DTO allergens match the shared allergens enum", () => {
    for (const allergen of allergensEnums) {
      const result = createOrderBodySchema.safeParse({
        ordersArr: [
          {
            businessGoodId: VALID_ID,
            orderGrossPrice: 1,
            orderNetPrice: 1,
            orderCostPrice: 1,
            allergens: [allergen],
          },
        ],
        salesInstanceId: VALID_ID,
        businessId: VALID_ID,
        dailyReferenceNumber: 1,
      });
      expect(result.success, `allergen ${allergen} should be accepted`).toBe(
        true,
      );
    }
  });
});
