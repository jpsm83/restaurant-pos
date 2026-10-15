import { describe, it, expect } from "vitest";

import SalesInstance from "../../src/models/salesInstance.ts";
import { addressSchema } from "../../src/models/address.ts";
import {
  billingStatusEnums,
  orderStatusEnums,
  salesInstanceStatusEnums,
} from "domain/enums";
import {
  createDeliveryOrderBodySchema,
  createSalesInstanceBodySchema,
  createSelfOrderBodySchema,
  deliveryAddressSchema,
  openSelfOrderingTableBodySchema,
  ordersNewBillingStatusValues,
  ordersNewStatusValues,
  salesInstanceIdParamsSchema,
  salesInstanceStatusValues,
  updateSalesInstanceBodySchema,
} from "domain/schemas/salesInstances";
import { salesInstanceDtoSchemas } from "../helpers/salesInstanceDtos.ts";

/**
 * Parity between the core salesInstances DTOs and the SalesInstance model (the
 * domain source of truth): every field a client may send must exist on the
 * model, and every server-owned field must exist on the model but never in a
 * DTO. The PATCH body also carries operation parameters (order ids, payment
 * methods, transfer target) that are not model fields; those are listed
 * explicitly so an accidental new field is still caught.
 */

const VALID_ID = "507f1f77bcf86cd799439011";

/** PATCH-body keys that are operation parameters, not SalesInstance fields. */
const OPERATION_FIELDS = new Set([
  "ordersIdsArr",
  "discountPercentage",
  "comments",
  "cancel",
  "ordersNewBillingStatus",
  "voidReason",
  "ordersNewStatus",
  "paymentMethodArr",
  "toSalesInstanceId",
]);

const salesInstanceOwns = (field: string): boolean =>
  Boolean(SalesInstance.schema.path(field));

describe("salesInstances DTO ↔ model parity", () => {
  it("every create-salesInstance field maps to a SalesInstance model field", () => {
    for (const key of Object.keys(createSalesInstanceBodySchema.shape)) {
      expect(
        salesInstanceOwns(key),
        `createSalesInstance.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("every update-salesInstance field maps to a model field or is an operation parameter", () => {
    for (const key of Object.keys(updateSalesInstanceBodySchema.shape)) {
      if (OPERATION_FIELDS.has(key)) continue;
      expect(
        salesInstanceOwns(key),
        `updateSalesInstance.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("server-owned fields are owned by SalesInstance but accepted by no DTO", () => {
    for (const field of [
      "dailyReferenceNumber",
      "openedByUserId",
      "openedAsRole",
      "closedByUserId",
      "closedAt",
      "salesGroup",
      "paymentId",
      "reservationId",
      "createdAt",
      "updatedAt",
    ]) {
      expect(
        salesInstanceOwns(field),
        `${field} should be owned by SalesInstance`,
      ).toBe(true);
      for (const [name, schema] of Object.entries(salesInstanceDtoSchemas)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });

  it("the DTO status accepts every value of the shared enum", () => {
    for (const status of salesInstanceStatusEnums) {
      const result = createSalesInstanceBodySchema.safeParse({
        salesPointId: VALID_ID,
        guests: 1,
        businessId: VALID_ID,
        salesInstanceStatus: status,
      });
      expect(result.success, `status ${status} should be accepted`).toBe(true);
    }
  });

  it("the DTO status rejects a value outside the shared enum", () => {
    const result = createSalesInstanceBodySchema.safeParse({
      salesPointId: VALID_ID,
      guests: 1,
      businessId: VALID_ID,
      salesInstanceStatus: "Bogus",
    });
    expect(result.success).toBe(false);
  });

  it("the pinned status values match the shared enums", () => {
    expect([...salesInstanceStatusValues]).toEqual([...salesInstanceStatusEnums]);
    expect([...ordersNewBillingStatusValues]).toEqual([...billingStatusEnums]);
    expect([...ordersNewStatusValues]).toEqual([...orderStatusEnums]);
  });

  it("the operation status enums accept every shared-enum value", () => {
    for (const billingStatus of billingStatusEnums) {
      const result = updateSalesInstanceBodySchema.safeParse({
        ordersNewBillingStatus: billingStatus,
      });
      expect(
        result.success,
        `ordersNewBillingStatus ${billingStatus} should be accepted`,
      ).toBe(true);
    }
    for (const orderStatus of orderStatusEnums) {
      const result = updateSalesInstanceBodySchema.safeParse({
        ordersNewStatus: orderStatus,
      });
      expect(
        result.success,
        `ordersNewStatus ${orderStatus} should be accepted`,
      ).toBe(true);
    }
  });

  it("the DTO ObjectId relations map to model ObjectId paths", () => {
    for (const field of [
      "salesPointId",
      "businessId",
      "responsibleByUserId",
    ]) {
      expect(
        salesInstanceOwns(field),
        `${field} should be owned by SalesInstance`,
      ).toBe(true);
    }
  });

  it("the params schemas expose no server-owned keys", () => {
    for (const schema of [salesInstanceIdParamsSchema]) {
      expect(Object.keys(schema.shape)).not.toContain("paymentId");
      expect(Object.keys(schema.shape)).not.toContain("salesGroup");
    }
  });

  describe("delivery and self-ordering flow DTOs", () => {
    /** Flow-body keys that are operation parameters, not SalesInstance fields. */
    const FLOW_OPERATION_FIELDS = new Set([
      "ordersArr",
      "paymentMethodArr",
      "deliveryAddress",
    ]);

    it("the openTable body maps to model fields", () => {
      for (const key of Object.keys(openSelfOrderingTableBodySchema.shape)) {
        expect(
          salesInstanceOwns(key),
          `openSelfOrderingTableBody.${key} should map to a model field`,
        ).toBe(true);
      }
    });

    it("delivery/self-order keys map to model fields or are flow operation params", () => {
      for (const schema of [
        createDeliveryOrderBodySchema,
        createSelfOrderBodySchema,
      ]) {
        for (const key of Object.keys(schema.shape)) {
          if (FLOW_OPERATION_FIELDS.has(key)) continue;
          expect(
            salesInstanceOwns(key),
            `${key} should map to a model field`,
          ).toBe(true);
        }
      }
    });

    it("the flows accept the intentionally client-settable paymentId key", () => {
      expect(Object.keys(createDeliveryOrderBodySchema.shape)).toContain(
        "paymentId",
      );
      expect(Object.keys(createSelfOrderBodySchema.shape)).toContain("paymentId");
    });

    it("server-owned fields other than paymentId are rejected by the flow bodies", () => {
      const flowBodies = [
        ["openSelfOrderingTable", openSelfOrderingTableBodySchema],
        ["createDeliveryOrder", createDeliveryOrderBodySchema],
        ["createSelfOrder", createSelfOrderBodySchema],
      ] as const;

      for (const ownedField of [
        "dailyReferenceNumber",
        "openedByUserId",
        "openedAsRole",
        "closedByUserId",
        "closedAt",
        "salesGroup",
        "reservationId",
        "salesInstanceStatus",
      ]) {
        for (const [name, schema] of flowBodies) {
          expect(
            Object.keys(schema.shape),
            `${name} should not accept ${ownedField}`,
          ).not.toContain(ownedField);
        }
      }
    });

    it("the delivery address DTO mirrors the Address model fields", () => {
      for (const key of Object.keys(deliveryAddressSchema.shape)) {
        expect(
          Boolean(addressSchema.path(key)),
          `deliveryAddress.${key} should map to an Address model field`,
        ).toBe(true);
      }
    });
  });
});
