import { describe, it, expect } from "vitest";
import type { z } from "zod";

import Inventory from "../../src/models/inventory.ts";
import {
  addInventoryCountBodySchema,
  businessIdParamsSchema,
  createInventoryBodySchema,
  inventoryIdParamsSchema,
  inventoryIncludeDeletedQuerySchema,
  inventoryMonthDateQuerySchema,
  inventoriesByBusinessQuerySchema,
  inventorySupplierGoodParamsSchema,
  updateInventoryCountBodySchema,
  varianceReportQuerySchema,
} from "../../src/schemas/inventories.ts";

/**
 * Parity between the inventories DTOs and the Inventory model (the domain source
 * of truth): every domain field a client may send must exist on the model, and
 * the server-owned fields (`setFinalCount`, `inventoryGoods`, timestamps, `_id`)
 * must never appear in a DTO.
 */

const inventoryOwns = (field: string): boolean =>
  Boolean(Inventory.schema.path(field));

const inventoryGoodsSchema = (
  Inventory.schema.path("inventoryGoods") as unknown as {
    schema: { path: (name: string) => unknown };
  }
).schema;

const countSchema = (
  inventoryGoodsSchema.path("monthlyCounts") as unknown as {
    schema: { path: (name: string) => unknown };
  }
).schema;

const allDtos: Record<string, z.ZodObject> = {
  createInventoryBodySchema,
  inventoryIdParamsSchema,
  inventorySupplierGoodParamsSchema,
  businessIdParamsSchema,
  inventoryMonthDateQuerySchema,
  inventoryIncludeDeletedQuerySchema,
  inventoriesByBusinessQuerySchema,
  addInventoryCountBodySchema,
  updateInventoryCountBodySchema,
  varianceReportQuerySchema,
};

describe("inventories DTO ↔ model parity", () => {
  it("the create-inventory field maps to an Inventory model field", () => {
    for (const key of Object.keys(createInventoryBodySchema.shape)) {
      expect(
        inventoryOwns(key),
        `createInventory.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("every add-count field maps to the inventory count subdocument", () => {
    for (const key of Object.keys(addInventoryCountBodySchema.shape)) {
      expect(
        Boolean(countSchema.path(key)),
        `addCount.${key} should map to a count subdocument field`,
      ).toBe(true);
    }
  });

  it("every update-count field maps to the inventory count subdocument", () => {
    const fields: Record<string, string> = {
      countId: "_id",
      reason: "reedited.reason",
      currentCountQuantity: "currentCountQuantity",
      comments: "comments",
    };

    expect(Object.keys(fields).sort()).toEqual(
      Object.keys(updateInventoryCountBodySchema.shape).sort(),
    );

    for (const [dtoField, modelField] of Object.entries(fields)) {
      expect(
        Boolean(countSchema.path(modelField)),
        `updateCount.${dtoField} should map to count.${modelField}`,
      ).toBe(true);
    }
  });

  it("server-owned fields are owned by Inventory but accepted by no DTO", () => {
    for (const field of [
      "setFinalCount",
      "inventoryGoods",
      "createdAt",
      "updatedAt",
      "_id",
    ]) {
      expect(inventoryOwns(field), `${field} should be owned by Inventory`).toBe(
        true,
      );
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });
});
