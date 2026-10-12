import { describe, it, expect } from "vitest";

import {
  createSupplierBodySchema,
  supplierByBusinessParamsSchema,
  supplierIdParamsSchema,
  updateSupplierBodySchema,
} from "../../../packages/schemas/supplier.ts";
import { addressSchema } from "../../../packages/schemas/address.ts";

const VALID_ID = "507f1f77bcf86cd799439011";

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

const validCreate = {
  tradeName: "Fresh Foods",
  legalName: "Fresh Foods LLC",
  email: "Sales@FreshFoods.com",
  phoneNumber: "1234567890",
  taxNumber: "TAX-001",
  currentlyInUse: "true",
  address: JSON.stringify(validAddress),
  businessId: VALID_ID,
};

const { businessId: _omitBusinessId, ...validUpdate } = validCreate;

describe("addressSchema", () => {
  it("requires the six location fields", () => {
    expect(addressSchema.safeParse(validAddress).success).toBe(true);

    for (const key of Object.keys(validAddress)) {
      const copy: Record<string, unknown> = { ...validAddress };
      delete copy[key];
      expect(addressSchema.safeParse(copy).success, `missing ${key}`).toBe(
        false,
      );
    }
  });

  it("accepts and sanitizes the optional fields and rejects unknown keys", () => {
    const parsed = addressSchema.parse({
      ...validAddress,
      region: "  <b>West</b>  ",
      coordinates: ["40.71", "-74.0"],
    });
    expect(parsed.region).toBe("West");
    expect(parsed.coordinates).toEqual([40.71, -74.0]);

    expect(
      addressSchema.safeParse({ ...validAddress, extra: "x" }).success,
    ).toBe(false);
  });
});

describe("createSupplierBodySchema", () => {
  it("accepts the required fields, coerces currentlyInUse and lowercases the email", () => {
    const parsed = createSupplierBodySchema.parse(validCreate);
    expect(parsed.currentlyInUse).toBe(true);
    expect(parsed.email).toBe("sales@freshfoods.com");
    expect(parsed.contactPerson).toBeUndefined();
  });

  it("parses and validates the JSON-encoded address", () => {
    const parsed = createSupplierBodySchema.parse(validCreate);
    expect(parsed.address.city).toBe("Los Angeles");

    expect(
      createSupplierBodySchema.safeParse({
        ...validCreate,
        address: "{not json",
      }).success,
    ).toBe(false);

    expect(
      createSupplierBodySchema.safeParse({
        ...validCreate,
        address: JSON.stringify({ ...validAddress, city: undefined }),
      }).success,
    ).toBe(false);

    expect(
      createSupplierBodySchema.safeParse({
        ...validCreate,
        address: JSON.stringify({ ...validAddress, extra: "x" }),
      }).success,
    ).toBe(false);
  });

  it("sanitizes structured text and treats a blank contactPerson as absent", () => {
    const parsed = createSupplierBodySchema.parse({
      ...validCreate,
      tradeName: "  <b>Fresh</b>   Foods ",
      contactPerson: "   ",
    });
    expect(parsed.tradeName).toBe("Fresh Foods");
    expect(parsed.contactPerson).toBeUndefined();
  });

  it("rejects a missing required field and an invalid email", () => {
    const { taxNumber: _drop, ...withoutTaxNumber } = validCreate;
    expect(createSupplierBodySchema.safeParse(withoutTaxNumber).success).toBe(
      false,
    );

    expect(
      createSupplierBodySchema.safeParse({
        ...validCreate,
        email: "invalid-email",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid business id and unknown keys", () => {
    expect(
      createSupplierBodySchema.safeParse({
        ...validCreate,
        businessId: "invalid-id",
      }).success,
    ).toBe(false);

    expect(
      createSupplierBodySchema.safeParse({ ...validCreate, isAdmin: true })
        .success,
    ).toBe(false);
  });

  it("rejects the server-owned imageUrl field", () => {
    expect(
      createSupplierBodySchema.safeParse({
        ...validCreate,
        imageUrl: "https://example.com/logo.png",
      }).success,
    ).toBe(false);
  });
});

describe("updateSupplierBodySchema", () => {
  it("accepts the core fields and does not accept businessId", () => {
    expect(updateSupplierBodySchema.safeParse(validUpdate).success).toBe(true);

    expect(
      updateSupplierBodySchema.safeParse({ ...validUpdate, businessId: VALID_ID })
        .success,
    ).toBe(false);
  });

  it("coerces currentlyInUse and parses the address", () => {
    const parsed = updateSupplierBodySchema.parse({
      ...validUpdate,
      currentlyInUse: "false",
    });
    expect(parsed.currentlyInUse).toBe(false);
    expect(parsed.address.city).toBe("Los Angeles");
  });
});

describe("supplier path params", () => {
  it("accept a valid ObjectId and reject a malformed one", () => {
    expect(
      supplierIdParamsSchema.safeParse({ supplierId: VALID_ID }).success,
    ).toBe(true);
    expect(
      supplierIdParamsSchema.safeParse({ supplierId: "invalid-id" }).success,
    ).toBe(false);

    expect(
      supplierByBusinessParamsSchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(true);
    expect(
      supplierByBusinessParamsSchema.safeParse({ businessId: "invalid-id" })
        .success,
    ).toBe(false);
  });

  it("reject unknown keys", () => {
    expect(
      supplierIdParamsSchema.safeParse({ supplierId: VALID_ID, extra: "x" })
        .success,
    ).toBe(false);
  });
});
