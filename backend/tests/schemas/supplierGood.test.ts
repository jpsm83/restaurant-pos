import { describe, it, expect } from "vitest";

import {
  createSupplierGoodBodySchema,
  supplierGoodBySupplierParamsSchema,
  supplierGoodIdParamsSchema,
  updateSupplierGoodBodySchema,
} from "../../../packages/schemas/supplierGood.ts";

const VALID_ID = "507f1f77bcf86cd799439011";

const validCreate = {
  name: "All Purpose Flour",
  keyword: "flour",
  mainCategory: "Food",
  supplierId: VALID_ID,
  businessId: VALID_ID,
};

const { businessId: _omitBusinessId, supplierId: _omitSupplierId, ...rest } =
  validCreate;
const validUpdate = { ...rest, currentlyInUse: "true" };

describe("createSupplierGoodBodySchema", () => {
  it("accepts the required fields and treats the optional ones as absent", () => {
    const parsed = createSupplierGoodBodySchema.parse(validCreate);
    expect(parsed.name).toBe("All Purpose Flour");
    expect(parsed.subCategory).toBeUndefined();
    expect(parsed.allergens).toBeUndefined();
    expect(parsed.budgetImpact).toBeUndefined();
    expect(parsed.totalPurchasePrice).toBeUndefined();
  });

  it("coerces numeric form strings and accepts enum values", () => {
    const parsed = createSupplierGoodBodySchema.parse({
      ...validCreate,
      minimumQuantityRequired: "5",
      parLevel: "100",
      quantityInMeasurementUnit: "10",
      totalPurchasePrice: "20",
      budgetImpact: "High",
      inventorySchedule: "weekly",
      purchaseUnit: "Bag",
      measurementUnit: "kg",
    });
    expect(parsed.minimumQuantityRequired).toBe(5);
    expect(parsed.parLevel).toBe(100);
    expect(parsed.quantityInMeasurementUnit).toBe(10);
    expect(parsed.totalPurchasePrice).toBe(20);
    expect(parsed.budgetImpact).toBe("High");
    expect(parsed.inventorySchedule).toBe("weekly");
    expect(parsed.purchaseUnit).toBe("Bag");
    expect(parsed.measurementUnit).toBe("kg");
  });

  it("parses and validates the JSON-encoded allergens", () => {
    const parsed = createSupplierGoodBodySchema.parse({
      ...validCreate,
      allergens: JSON.stringify(["Gluten", "Milk"]),
    });
    expect(parsed.allergens).toEqual(["Gluten", "Milk"]);

    expect(
      createSupplierGoodBodySchema.safeParse({
        ...validCreate,
        allergens: JSON.stringify(["Unobtainium"]),
      }).success,
    ).toBe(false);

    expect(
      createSupplierGoodBodySchema.safeParse({
        ...validCreate,
        allergens: "{not json",
      }).success,
    ).toBe(false);
  });

  it("sanitizes structured text and strips markup from the description", () => {
    const parsed = createSupplierGoodBodySchema.parse({
      ...validCreate,
      name: "  <b>All Purpose</b>   Flour ",
      subCategory: "  <i>Baking</i>  ",
      description: "  <b>Fine</b>\n\n\nWhite  ",
    });
    expect(parsed.name).toBe("All Purpose Flour");
    expect(parsed.subCategory).toBe("Baking");
    expect(parsed.description).toBe("Fine\n\nWhite");
  });

  it("treats blank optional fields as not provided", () => {
    const parsed = createSupplierGoodBodySchema.parse({
      ...validCreate,
      subCategory: "  ",
      description: "",
      allergens: "",
      budgetImpact: "",
      inventorySchedule: "",
      purchaseUnit: "",
      measurementUnit: "",
      minimumQuantityRequired: "",
      totalPurchasePrice: "",
    });
    expect(parsed.subCategory).toBeUndefined();
    expect(parsed.description).toBeUndefined();
    expect(parsed.allergens).toBeUndefined();
    expect(parsed.budgetImpact).toBeUndefined();
    expect(parsed.inventorySchedule).toBeUndefined();
    expect(parsed.purchaseUnit).toBeUndefined();
    expect(parsed.measurementUnit).toBeUndefined();
    expect(parsed.minimumQuantityRequired).toBeUndefined();
    expect(parsed.totalPurchasePrice).toBeUndefined();
  });

  it("rejects a missing required field, an invalid enum and an invalid id", () => {
    const { keyword: _drop, ...withoutKeyword } = validCreate;
    expect(
      createSupplierGoodBodySchema.safeParse(withoutKeyword).success,
    ).toBe(false);

    expect(
      createSupplierGoodBodySchema.safeParse({
        ...validCreate,
        mainCategory: "InvalidCategory",
      }).success,
    ).toBe(false);
    expect(
      createSupplierGoodBodySchema.safeParse({
        ...validCreate,
        budgetImpact: "Massive",
      }).success,
    ).toBe(false);

    expect(
      createSupplierGoodBodySchema.safeParse({
        ...validCreate,
        supplierId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys and server-owned fields", () => {
    expect(
      createSupplierGoodBodySchema.safeParse({ ...validCreate, isAdmin: true })
        .success,
    ).toBe(false);

    for (const field of [
      "imagesUrl",
      "pricePerMeasurementUnit",
      "currentlyInUse",
    ]) {
      expect(
        createSupplierGoodBodySchema.safeParse({
          ...validCreate,
          [field]: "x",
        }).success,
        field,
      ).toBe(false);
    }
  });
});

describe("updateSupplierGoodBodySchema", () => {
  it("accepts the core fields, coerces currentlyInUse and the numbers", () => {
    const parsed = updateSupplierGoodBodySchema.parse(validUpdate);
    expect(parsed.name).toBe("All Purpose Flour");
    expect(parsed.currentlyInUse).toBe(true);
    expect(parsed.totalPurchasePrice).toBeUndefined();
  });

  it("requires currentlyInUse", () => {
    const { currentlyInUse: _drop, ...withoutCurrentlyInUse } = validUpdate;
    expect(
      updateSupplierGoodBodySchema.safeParse(withoutCurrentlyInUse).success,
    ).toBe(false);
  });

  it("coerces currentlyInUse from its form string", () => {
    const parsed = updateSupplierGoodBodySchema.parse({
      ...validUpdate,
      currentlyInUse: "false",
    });
    expect(parsed.currentlyInUse).toBe(false);
  });

  it("does not accept businessId, supplierId or unknown keys", () => {
    expect(updateSupplierGoodBodySchema.safeParse(validUpdate).success).toBe(
      true,
    );
    expect(
      updateSupplierGoodBodySchema.safeParse({
        ...validUpdate,
        businessId: VALID_ID,
      }).success,
    ).toBe(false);
    expect(
      updateSupplierGoodBodySchema.safeParse({
        ...validUpdate,
        supplierId: VALID_ID,
      }).success,
    ).toBe(false);
    expect(
      updateSupplierGoodBodySchema.safeParse({ ...validUpdate, isAdmin: true })
        .success,
    ).toBe(false);
  });

  it("parses the JSON-encoded allergens", () => {
    const parsed = updateSupplierGoodBodySchema.parse({
      ...validUpdate,
      allergens: JSON.stringify(["Eggs"]),
    });
    expect(parsed.allergens).toEqual(["Eggs"]);
  });
});

describe("supplierGood path params", () => {
  it("accept a valid ObjectId and reject a malformed one", () => {
    expect(
      supplierGoodIdParamsSchema.safeParse({ supplierGoodId: VALID_ID })
        .success,
    ).toBe(true);
    expect(
      supplierGoodIdParamsSchema.safeParse({ supplierGoodId: "invalid-id" })
        .success,
    ).toBe(false);

    expect(
      supplierGoodBySupplierParamsSchema.safeParse({ supplierId: VALID_ID })
        .success,
    ).toBe(true);
    expect(
      supplierGoodBySupplierParamsSchema.safeParse({ supplierId: "invalid-id" })
        .success,
    ).toBe(false);
  });

  it("reject unknown keys", () => {
    expect(
      supplierGoodIdParamsSchema.safeParse({
        supplierGoodId: VALID_ID,
        extra: "x",
      }).success,
    ).toBe(false);
  });
});
