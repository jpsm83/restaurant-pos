import { describe, it, expect } from "vitest";
import type { z } from "zod";

import Purchase from "../../src/models/purchase.ts";
import {
  addPurchaseItemBodySchema,
  createPurchaseBodySchema,
  deletePurchaseItemBodySchema,
  editPurchaseItemBodySchema,
  purchaseBySupplierParamsSchema,
  purchaseByUserParamsSchema,
  purchaseIdParamsSchema,
  purchasesQuerySchema,
  updatePurchaseBodySchema,
} from "domain/schemas/purchase";

/**
 * Parity between the purchase DTOs and the Mongoose Purchase model (the domain
 * source of truth): every field a client may send must exist on the model, and
 * the server-owned fields (`totalAmount`, `oneTimePurchase`, `documentsUrl`,
 * timestamps, `_id`) must never appear in a DTO.
 */

const purchaseOwns = (field: string): boolean =>
  Boolean(Purchase.schema.path(field));

const itemSchema = (
  Purchase.schema.path("purchaseInventoryItems") as unknown as {
    schema: { path: (name: string) => unknown };
  }
).schema;

const itemOwns = (field: string): boolean => Boolean(itemSchema.path(field));

const allDtos: Record<string, z.ZodObject> = {
  createPurchaseBodySchema,
  updatePurchaseBodySchema,
  purchaseIdParamsSchema,
  purchaseBySupplierParamsSchema,
  purchaseByUserParamsSchema,
  purchasesQuerySchema,
  addPurchaseItemBodySchema,
  deletePurchaseItemBodySchema,
  editPurchaseItemBodySchema,
};

describe("purchase DTO ↔ model parity", () => {
  it("every top-level create field maps to a Purchase model field", () => {
    for (const key of Object.keys(createPurchaseBodySchema.shape)) {
      if (key === "purchaseInventoryItems") continue;
      expect(
        purchaseOwns(key),
        `createPurchase.${key} should map to a Purchase field`,
      ).toBe(true);
    }
  });

  it("every create line field maps to the purchase item subdocument", () => {
    const itemKeys = Object.keys(
      (createPurchaseBodySchema.shape.purchaseInventoryItems as z.ZodArray<
        z.ZodObject
      >).element.shape,
    );
    for (const key of itemKeys) {
      expect(
        itemOwns(key),
        `createPurchase line ${key} should map to a purchase item field`,
      ).toBe(true);
    }
  });

  it("every update field maps to a Purchase model field", () => {
    for (const key of Object.keys(updatePurchaseBodySchema.shape)) {
      expect(
        purchaseOwns(key),
        `updatePurchase.${key} should map to a Purchase field`,
      ).toBe(true);
    }
  });

  it("the add-line fields map to the purchase item subdocument", () => {
    for (const key of Object.keys(addPurchaseItemBodySchema.shape)) {
      expect(
        itemOwns(key),
        `addSupplierGood.${key} should map to a purchase item field`,
      ).toBe(true);
    }
  });

  it("the delete-line id maps to the item _id", () => {
    expect(Object.keys(deletePurchaseItemBodySchema.shape)).toEqual([
      "purchaseInventoryItemsId",
    ]);
    expect(itemOwns("_id")).toBe(true);
  });

  it("the edit-line fields map to the item audit fields", () => {
    const fields: Record<string, string> = {
      purchaseInventoryItemsId: "_id",
      reason: "lastEditReason",
      newQuantityPurchased: "quantityPurchased",
      newPurchasePrice: "purchasePrice",
    };

    expect(Object.keys(fields).sort()).toEqual(
      Object.keys(editPurchaseItemBodySchema.shape).sort(),
    );

    for (const [dtoField, modelField] of Object.entries(fields)) {
      expect(
        itemOwns(modelField),
        `editSupplierGood.${dtoField} should map to item.${modelField}`,
      ).toBe(true);
    }
  });

  it("server-owned fields are owned by Purchase but accepted by no DTO", () => {
    for (const field of [
      "totalAmount",
      "oneTimePurchase",
      "documentsUrl",
      "createdAt",
      "updatedAt",
      "_id",
    ]) {
      expect(purchaseOwns(field), `${field} should be on Purchase`).toBe(true);
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });

  it("path param DTOs carry only their route ids", () => {
    expect(Object.keys(purchaseIdParamsSchema.shape)).toEqual(["purchaseId"]);
    expect(Object.keys(purchaseBySupplierParamsSchema.shape)).toEqual([
      "supplierId",
    ]);
    expect(Object.keys(purchaseByUserParamsSchema.shape)).toEqual(["userId"]);
  });
});
