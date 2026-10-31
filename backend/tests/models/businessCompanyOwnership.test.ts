/**
 * Business → Company ownership invariant: new writes must name a Company,
 * while legacy raw-inserted orphans stay readable and unbackfilled.
 */
import { describe, it, expect } from "vitest";
import mongoose, { Types } from "mongoose";
import Business from "../../src/models/business.ts";
import { createTestOwnerCompany } from "../helpers/fixtures.ts";

function businessFields(taxNumber: string) {
  return {
    tradeName: "Ownership Test Bistro",
    legalName: "Ownership Test Bistro LLC",
    email: "ownership-test@example.com",
    phoneNumber: "1234567890",
    taxNumber,
    currencyTrade: "USD",
    address: {
      country: "USA",
      state: "CA",
      city: "LA",
      street: "Main St",
      buildingNumber: "1",
      postCode: "90001",
    },
  };
}

describe("Business → Company ownership", () => {
  it("refuses to create a Business without a Company", async () => {
    await expect(
      Business.create(businessFields("TAX-OWNERSHIP-MISSING")),
    ).rejects.toMatchObject({
      name: "ValidationError",
      errors: {
        companyId: expect.objectContaining({
          message: expect.stringMatching(/Company id is required/i),
        }),
      },
    });

    const stored = await Business.findOne({
      taxNumber: "TAX-OWNERSHIP-MISSING",
    }).lean();
    expect(stored).toBeNull();
  });

  it("creates a Business that names its owning Company", async () => {
    const { company } = await createTestOwnerCompany({ country: "USA" });

    const created = await Business.create({
      ...businessFields("TAX-OWNERSHIP-LINKED"),
      companyId: company._id,
    });

    expect(created.companyId?.toString()).toBe(company._id.toString());
    const stored = await Business.findById(created._id).lean();
    expect(stored?.companyId?.toString()).toBe(company._id.toString());
  });

  it("keeps a raw-inserted legacy orphan readable without backfilling it", async () => {
    const businessId = new Types.ObjectId();
    await Business.collection.insertOne({
      _id: businessId,
      ...businessFields(`TAX-OWNERSHIP-ORPHAN-${businessId}`),
      deleted: false,
    });

    const stored = await Business.findById(businessId).lean();
    expect(stored).not.toBeNull();
    expect(stored?.companyId).toBeUndefined();

    const hydrated = await Business.findById(businessId);
    expect(hydrated?.companyId).toBeUndefined();
    expect(hydrated?.tradeName).toBe("Ownership Test Bistro");
  });

  it("reports the ownership path as a required schema field", () => {
    const path = Business.schema.path("companyId");
    expect(path).toBeDefined();
    expect(path).toBeInstanceOf(mongoose.Schema.Types.ObjectId);
    expect(path.options.required).toBeTruthy();
  });
});
