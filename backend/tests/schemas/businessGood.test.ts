import { describe, it, expect } from "vitest";

import {
  businessGoodByBusinessParamsSchema,
  businessGoodIdParamsSchema,
  createBusinessGoodBodySchema,
  ingredientSchema,
  updateBusinessGoodBodySchema,
} from "restaurant-pos-packages/schemas/businessGood";

const VALID_ID = "507f1f77bcf86cd799439011";
const VALID_SUPPLIER_GOOD_ID = "507f191e810c19729de860ea";

const validCreate = {
  name: "Cheese Burger",
  keyword: "cheese burger",
  mainCategory: "Food",
  onMenu: "true",
  available: "true",
  sellingPrice: "12.99",
  businessId: VALID_ID,
};

const { businessId: _omitBusinessId, ...validUpdate } = validCreate;

describe("ingredientSchema", () => {
  it("accepts a valid ingredient and coerces the quantity", () => {
    const parsed = ingredientSchema.parse({
      supplierGoodId: VALID_SUPPLIER_GOOD_ID,
      measurementUnit: "g",
      requiredQuantity: "250",
    });
    expect(parsed).toEqual({
      supplierGoodId: VALID_SUPPLIER_GOOD_ID,
      measurementUnit: "g",
      requiredQuantity: 250,
    });
  });

  it("rejects an invalid supplier good id, measurement unit and extra keys", () => {
    expect(
      ingredientSchema.safeParse({
        supplierGoodId: "not-an-id",
        measurementUnit: "g",
        requiredQuantity: 1,
      }).success,
    ).toBe(false);
    expect(
      ingredientSchema.safeParse({
        supplierGoodId: VALID_SUPPLIER_GOOD_ID,
        measurementUnit: "stone",
        requiredQuantity: 1,
      }).success,
    ).toBe(false);
    expect(
      ingredientSchema.safeParse({
        supplierGoodId: VALID_SUPPLIER_GOOD_ID,
        measurementUnit: "g",
        requiredQuantity: 1,
        costOfRequiredQuantity: 2,
      }).success,
    ).toBe(false);
  });
});

describe("createBusinessGoodBodySchema", () => {
  it("accepts the required fields and coerces form strings", () => {
    const parsed = createBusinessGoodBodySchema.parse(validCreate);
    expect(parsed.onMenu).toBe(true);
    expect(parsed.available).toBe(true);
    expect(parsed.sellingPrice).toBe(12.99);
    expect(parsed.ingredients).toBeUndefined();
    expect(parsed.setMenuIds).toBeUndefined();
  });

  it("sanitizes structured text and strips markup from the description", () => {
    const parsed = createBusinessGoodBodySchema.parse({
      ...validCreate,
      name: "  <b>Cheese</b>   Burger ",
      subCategory: "  <i>Burger</i>  ",
      description: "  <b>Fresh</b>   and  <i>tasty</i>  ",
    });
    expect(parsed.name).toBe("Cheese Burger");
    expect(parsed.subCategory).toBe("Burger");
    expect(parsed.description).toBe("Fresh and tasty");
  });

  it("rejects a missing required field", () => {
    const { keyword: _drop, ...withoutKeyword } = validCreate;
    expect(
      createBusinessGoodBodySchema.safeParse(withoutKeyword).success,
    ).toBe(false);
  });

  it("rejects an invalid main category and unknown keys", () => {
    expect(
      createBusinessGoodBodySchema.safeParse({
        ...validCreate,
        mainCategory: "InvalidCategory",
      }).success,
    ).toBe(false);
    expect(
      createBusinessGoodBodySchema.safeParse({ ...validCreate, isAdmin: true })
        .success,
    ).toBe(false);
  });

  it("rejects a non-positive selling price and an invalid business id", () => {
    expect(
      createBusinessGoodBodySchema.safeParse({
        ...validCreate,
        sellingPrice: "0",
      }).success,
    ).toBe(false);
    expect(
      createBusinessGoodBodySchema.safeParse({
        ...validCreate,
        businessId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("parses and validates the JSON-encoded ingredients", () => {
    const parsed = createBusinessGoodBodySchema.parse({
      ...validCreate,
      ingredients: JSON.stringify([
        {
          supplierGoodId: VALID_SUPPLIER_GOOD_ID,
          measurementUnit: "kg",
          requiredQuantity: 2,
        },
      ]),
    });
    expect(parsed.ingredients).toHaveLength(1);
    expect(parsed.ingredients?.[0].requiredQuantity).toBe(2);

    expect(
      createBusinessGoodBodySchema.safeParse({
        ...validCreate,
        ingredients: JSON.stringify([
          {
            supplierGoodId: VALID_SUPPLIER_GOOD_ID,
            measurementUnit: "stone",
            requiredQuantity: 2,
          },
        ]),
      }).success,
    ).toBe(false);

    expect(
      createBusinessGoodBodySchema.safeParse({
        ...validCreate,
        ingredients: "{not json",
      }).success,
    ).toBe(false);
  });

  it("parses and validates the JSON-encoded setMenuIds", () => {
    const parsed = createBusinessGoodBodySchema.parse({
      ...validCreate,
      setMenuIds: JSON.stringify([VALID_SUPPLIER_GOOD_ID]),
    });
    expect(parsed.setMenuIds).toEqual([VALID_SUPPLIER_GOOD_ID]);

    expect(
      createBusinessGoodBodySchema.safeParse({
        ...validCreate,
        setMenuIds: JSON.stringify(["nope"]),
      }).success,
    ).toBe(false);
  });

  it("parses and validates the JSON-encoded allergens", () => {
    const parsed = createBusinessGoodBodySchema.parse({
      ...validCreate,
      allergens: JSON.stringify(["Gluten", "Milk"]),
    });
    expect(parsed.allergens).toEqual(["Gluten", "Milk"]);

    expect(
      createBusinessGoodBodySchema.safeParse({
        ...validCreate,
        allergens: JSON.stringify(["Unobtainium"]),
      }).success,
    ).toBe(false);
  });

  it("treats blank JSON fields as not provided", () => {
    const parsed = createBusinessGoodBodySchema.parse({
      ...validCreate,
      ingredients: "",
      setMenuIds: "",
      allergens: "",
    });
    expect(parsed.ingredients).toBeUndefined();
    expect(parsed.setMenuIds).toBeUndefined();
    expect(parsed.allergens).toBeUndefined();
  });

  it("rejects server-owned fields", () => {
    for (const field of [
      "costPrice",
      "suggestedSellingPrice",
      "imagesUrl",
    ]) {
      expect(
        createBusinessGoodBodySchema.safeParse({
          ...validCreate,
          [field]: 1,
        }).success,
        field,
      ).toBe(false);
    }
  });
});

describe("updateBusinessGoodBodySchema", () => {
  it("accepts the core fields and treats the rest as optional", () => {
    const parsed = updateBusinessGoodBodySchema.parse(validUpdate);
    expect(parsed.sellingPrice).toBe(12.99);
    expect(parsed.ingredients).toBeUndefined();
    expect(parsed.grossProfitMarginDesired).toBeUndefined();
    expect(parsed.deliveryTime).toBeUndefined();
  });

  it("does not accept businessId or unknown keys", () => {
    expect(
      updateBusinessGoodBodySchema.safeParse(validUpdate).success,
    ).toBe(true);

    expect(
      updateBusinessGoodBodySchema.safeParse({ ...validUpdate, businessId: VALID_ID })
        .success,
    ).toBe(false);

    expect(
      updateBusinessGoodBodySchema.safeParse({ ...validUpdate, isAdmin: true })
        .success,
    ).toBe(false);
  });

  it("coerces the JSON-encoded ingredients and allergens", () => {
    const parsed = updateBusinessGoodBodySchema.parse({
      ...validUpdate,
      ingredients: JSON.stringify([
        {
          supplierGoodId: VALID_SUPPLIER_GOOD_ID,
          measurementUnit: "unit",
          requiredQuantity: 1,
        },
      ]),
      allergens: JSON.stringify(["Eggs"]),
    });
    expect(parsed.ingredients).toHaveLength(1);
    expect(parsed.allergens).toEqual(["Eggs"]);
  });
});

describe("businessGood path params", () => {
  it("accept a valid ObjectId and reject a malformed one", () => {
    expect(
      businessGoodIdParamsSchema.safeParse({ businessGoodId: VALID_ID }).success,
    ).toBe(true);
    expect(
      businessGoodIdParamsSchema.safeParse({ businessGoodId: "invalid-id" })
        .success,
    ).toBe(false);

    expect(
      businessGoodByBusinessParamsSchema.safeParse({ businessId: VALID_ID })
        .success,
    ).toBe(true);
    expect(
      businessGoodByBusinessParamsSchema.safeParse({ businessId: "invalid-id" })
        .success,
    ).toBe(false);
  });

  it("reject unknown keys", () => {
    expect(
      businessGoodIdParamsSchema.safeParse({
        businessGoodId: VALID_ID,
        extra: "x",
      }).success,
    ).toBe(false);
  });
});
