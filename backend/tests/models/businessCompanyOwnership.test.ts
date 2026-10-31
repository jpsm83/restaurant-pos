/**
 * Business → Company ownership invariant: new writes must name a Company,
 * while legacy raw-inserted orphans stay readable and unbackfilled.
 */
import { describe, it, expect } from "vitest";
import mongoose, { Types } from "mongoose";
import Business from "../../src/models/business.ts";
import {
  createTestBusiness,
  fakeBusinessRecord,
} from "../helpers/fixtures.ts";

describe("Business → Company ownership", () => {
  it("refuses to create a Business without a Company", async () => {
    await expect(
      Business.create({
        ...fakeBusinessRecord(),
        taxNumber: "TAX-OWNERSHIP-MISSING",
      }),
    ).rejects.toBeInstanceOf(mongoose.Error.ValidationError);

    const stored = await Business.findOne({
      taxNumber: "TAX-OWNERSHIP-MISSING",
    }).lean();
    expect(stored).toBeNull();
  });

  it("creates a Business that names its owning Company", async () => {
    const created = await createTestBusiness({
      ...fakeBusinessRecord(),
      country: "USA",
      taxNumber: "TAX-OWNERSHIP-LINKED",
    });

    expect(created.companyId).toBeDefined();
    const stored = await Business.findById(created._id).lean();
    expect(stored?.companyId?.toString()).toBe(created.companyId?.toString());
  });

  it("keeps a raw-inserted legacy orphan readable without backfilling it", async () => {
    const businessId = new Types.ObjectId();
    const { companyId: _companyId, ...legacy } = fakeBusinessRecord();
    await Business.collection.insertOne({
      _id: businessId,
      ...legacy,
      taxNumber: `TAX-OWNERSHIP-ORPHAN-${businessId}`,
      deleted: false,
    });

    const stored = await Business.findById(businessId).lean();
    expect(stored).not.toBeNull();
    expect(stored?.companyId).toBeUndefined();

    const hydrated = await Business.findById(businessId);
    expect(hydrated?.companyId).toBeUndefined();
    expect(hydrated?.tradeName).toBe(legacy.tradeName);
  });
});
